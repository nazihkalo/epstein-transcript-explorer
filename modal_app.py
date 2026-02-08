"""
Modal deployment: FastAPI backend + Next.js static frontend.

Run locally:  modal serve modal_app.py
Deploy:       modal deploy modal_app.py
"""

from pathlib import Path

import fastapi
import fastapi.responses
import fastapi.staticfiles
import modal

# ---------------------------------------------------------------------------
# Speaker name mapping
# ---------------------------------------------------------------------------
SPEAKER_NAMES: dict[int, str] = {0: "Epstein", 1: "Ehud"}


def get_speaker_name(speaker: int | None) -> str:
    if speaker is None:
        return "Unknown"
    return SPEAKER_NAMES.get(speaker, "Other")


# ---------------------------------------------------------------------------
# Modal app + image
# ---------------------------------------------------------------------------
app = modal.App("epstein-transcript-explorer")

image = (
    modal.Image.debian_slim(python_version="3.12")
    .uv_pip_install(
        "fastapi[standard]==0.128.5",
        "openai",
    )
    .add_local_file(
        Path(__file__).parent / "data" / "transcript_structured.json",
        remote_path="/data/transcript_structured.json",
    )
    .add_local_file(
        Path(__file__).parent / "data" / "embeddings.json",
        remote_path="/data/embeddings.json",
    )
    .add_local_file(
        Path(__file__).parent / "data" / "detailed_summary.json",
        remote_path="/data/detailed_summary.json",
    )
    .add_local_file(
        Path(__file__).parent / "data" / "epstein_ehud_recording.mp4",
        remote_path="/data/epstein_ehud_recording.mp4",
    )
    .add_local_dir(
        Path(__file__).parent / "frontend" / "out",
        remote_path="/assets",
    )
)

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
web_app = fastapi.FastAPI()

_transcript_cache: dict | None = None
_embeddings_cache: list[list[float]] | None = None
_summary_cache: dict | None = None


def _load_transcript() -> dict:
    import json

    global _transcript_cache
    if _transcript_cache is None:
        with open("/data/transcript_structured.json") as f:
            _transcript_cache = json.load(f)
    return _transcript_cache


def _load_embeddings() -> list[list[float]]:
    import json

    global _embeddings_cache
    if _embeddings_cache is None:
        with open("/data/embeddings.json") as f:
            _embeddings_cache = json.load(f)
    return _embeddings_cache


def _load_summary() -> dict:
    import json

    global _summary_cache
    if _summary_cache is None:
        with open("/data/detailed_summary.json") as f:
            _summary_cache = json.load(f)
    return _summary_cache


def _cosine_sim(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


# ---- GET /api/transcript ----
@web_app.get("/api/transcript")
async def get_transcript():
    return _load_transcript()


# ---- GET /api/summary ----
@web_app.get("/api/summary")
async def get_summary():
    return _load_summary()


# ---- GET /api/audio ----
@web_app.get("/api/audio")
async def get_audio():
    return fastapi.responses.FileResponse(
        "/data/epstein_ehud_recording.mp4",
        media_type="video/mp4",
        headers={"Accept-Ranges": "bytes"},
    )


# ---- GET /api/search ----
@web_app.get("/api/search")
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


# ---- POST /api/ask ----
@web_app.post("/api/ask")
async def ask_question(request: fastapi.Request):
    import os
    from openai import OpenAI

    body = await request.json()
    question = body.get("question", "").strip()
    if not question:
        return {"answer": "Please provide a question.", "sources": []}

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {
            "answer": "OpenAI API key not configured. Set the OPENAI_API_KEY secret in Modal.",
            "sources": [],
        }

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


# ---------------------------------------------------------------------------
# Modal function: serve the app
# ---------------------------------------------------------------------------
@app.function(
    image=image,
    secrets=[modal.Secret.from_name("openai-secret")],
)
@modal.concurrent(max_inputs=100)
@modal.asgi_app()
def serve():
    web_app.mount(
        "/",
        fastapi.staticfiles.StaticFiles(directory="/assets", html=True),
    )
    return web_app
