"""
Local dev server — runs the same FastAPI endpoints as modal_app.py
but reads data from the local filesystem instead of Modal volumes.

Usage:
    uv run uvicorn server:app --reload --port 8000
"""

import json
import os
from functools import lru_cache
from pathlib import Path

import fastapi
import fastapi.middleware.cors
import fastapi.responses
from dotenv import load_dotenv

from speaker_map import get_speaker_name

load_dotenv()

DATA_DIR = Path(__file__).parent / "data"
DATA_PATH = DATA_DIR / "transcript_structured.json"
EMBEDDINGS_PATH = DATA_DIR / "embeddings.json"
SUMMARY_PATH = DATA_DIR / "detailed_summary.json"
AUDIO_PATH = DATA_DIR / "epstein_ehud_recording.mp4"

app = fastapi.FastAPI(title="Transcript Explorer API (local)")

# Allow Next.js dev server (port 3000) to hit this
app.add_middleware(
    fastapi.middleware.cors.CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@lru_cache(maxsize=1)
def _load_transcript() -> dict:
    with open(DATA_PATH) as f:
        return json.load(f)


@lru_cache(maxsize=1)
def _load_embeddings() -> list[list[float]]:
    with open(EMBEDDINGS_PATH) as f:
        return json.load(f)


def _cosine_sim(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


@lru_cache(maxsize=1)
def _load_summary() -> dict:
    if not SUMMARY_PATH.exists():
        return {}
    with open(SUMMARY_PATH) as f:
        return json.load(f)


@app.get("/api/transcript")
async def get_transcript():
    return _load_transcript()


@app.get("/api/summary")
async def get_summary():
    return _load_summary()


@app.get("/api/audio")
async def get_audio():
    """Serve the source audio/video file for playback."""
    if not AUDIO_PATH.exists():
        raise fastapi.HTTPException(404, "Audio file not found")
    return fastapi.responses.FileResponse(
        AUDIO_PATH,
        media_type="video/mp4",
        headers={"Accept-Ranges": "bytes"},
    )


@app.get("/api/search")
async def search_transcript(q: str = "", speaker: int | None = None):
    data = _load_transcript()
    results = []

    for i, para in enumerate(data["paragraphs"]):
        if speaker is not None and para["speaker"] != speaker:
            continue
        if q and q.lower() not in para["text"].lower():
            continue
        results.append({"paragraph": para, "index": i})
        if len(results) >= 100:
            break

    return {"results": results, "total": len(results)}


@app.post("/api/ask")
async def ask_question(request: fastapi.Request):
    from openai import OpenAI

    body = await request.json()
    question = body.get("question", "").strip()
    if not question:
        return {"answer": "Please provide a question.", "sources": []}

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"answer": "OPENAI_API_KEY not set in .env", "sources": []}

    data = _load_transcript()
    paragraph_embeddings = _load_embeddings()
    client = OpenAI(api_key=api_key)

    # Only embed the question (paragraphs are precomputed)
    q_response = client.embeddings.create(
        model="text-embedding-3-small",
        input=question,
    )
    q_vec = q_response.data[0].embedding

    # Score each paragraph by cosine similarity
    scored = []
    for i, (para, emb) in enumerate(zip(data["paragraphs"], paragraph_embeddings)):
        sim = _cosine_sim(q_vec, emb)
        scored.append((sim, i, para))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:10]

    # Build context
    context_parts = []
    if data.get("summary"):
        context_parts.append(f"Summary: {data['summary']}")
    for _, _, para in top:
        name = get_speaker_name(para["speaker"])
        context_parts.append(f"[{name}] {para['text']}")
    context = "\n\n".join(context_parts)

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an assistant that answers questions about an audio transcript "
                    "of a conversation between Jeffrey Epstein and Ehud Barak. "
                    "Use ONLY the provided transcript excerpts to answer. "
                    "If the answer isn't in the excerpts, say so. "
                    "Be concise and cite which speaker said what when relevant. "
                    "Use their actual names (Epstein, Ehud) not speaker numbers."
                ),
            },
            {
                "role": "user",
                "content": f"Transcript excerpts:\n\n{context}\n\nQuestion: {question}",
            },
        ],
        max_tokens=1000,
    )

    answer = completion.choices[0].message.content or "No answer generated."
    sources = [
        {"text": p["text"][:300], "speaker": p["speaker"], "start": p["start"]}
        for _, _, p in top[:5]
    ]
    return {"answer": answer, "sources": sources}
