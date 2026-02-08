"""
Transcription pipeline: reads MP4, sends to Deepgram, saves raw + structured JSON,
then precomputes OpenAI embeddings for semantic search.
"""

import json
import os
from pathlib import Path

from dotenv import load_dotenv
from deepgram import DeepgramClient

load_dotenv()

DATA_DIR = Path(__file__).parent / "data"
MP4_PATH = DATA_DIR / "epstein_ehud_recording.mp4"
RAW_OUTPUT = DATA_DIR / "transcription.json"
STRUCTURED_OUTPUT = DATA_DIR / "transcript_structured.json"
EMBEDDINGS_OUTPUT = DATA_DIR / "embeddings.json"


def transcribe(mp4_path: Path = MP4_PATH) -> dict:
    """Send MP4 to Deepgram and return the raw response dict."""
    api_key = os.getenv("DEEPGRAM_API_KEY")
    if not api_key:
        raise RuntimeError("DEEPGRAM_API_KEY not set. Copy .env.example to .env and fill it in.")

    deepgram = DeepgramClient(api_key=api_key, timeout=600)

    print(f"Reading {mp4_path} ({mp4_path.stat().st_size / 1e6:.1f} MB)...")
    with open(mp4_path, "rb") as f:
        buffer_data = f.read()

    print("Sending to Deepgram (nova-3) with diarize, entities, summarize, topics...")
    response = deepgram.listen.v1.media.transcribe_file(
        request=buffer_data,
        model="nova-3",
        language="en",
        smart_format=True,
        diarize=True,
        detect_entities=True,
        summarize="v2",
        topics=True,
        paragraphs=True,
    )

    # mode="json" ensures datetimes etc. are serialized to strings
    raw = response.model_dump(mode="json")

    # Save immediately so we never re-transcribe on subsequent errors
    with open(RAW_OUTPUT, "w") as f:
        json.dump(raw, f, indent=2)
    print(f"Raw transcription saved to {RAW_OUTPUT}")

    return raw


def build_structured(raw: dict) -> dict:
    """
    Parse the raw Deepgram response into a cleaner structure:
    - paragraphs with speaker labels and timestamps
    - entities
    - summary
    - topics
    """
    channel = raw["results"]["channels"][0]
    alternative = channel["alternatives"][0]

    # --- Paragraphs with speaker labels ---
    paragraphs = []
    if "paragraphs" in alternative and "paragraphs" in alternative["paragraphs"]:
        for para in alternative["paragraphs"]["paragraphs"]:
            sentences_text = " ".join(s["text"] for s in para.get("sentences", []))
            paragraphs.append({
                "speaker": para.get("speaker", None),
                "start": para.get("start", 0),
                "end": para.get("end", 0),
                "num_words": para.get("num_words", 0),
                "text": sentences_text,
                "sentences": para.get("sentences", []),
            })

    # --- Words with speaker info (for fine-grained search) ---
    words = []
    for w in alternative.get("words", []):
        words.append({
            "word": w["word"],
            "start": w["start"],
            "end": w["end"],
            "confidence": w["confidence"],
            "speaker": w.get("speaker", None),
            "punctuated_word": w.get("punctuated_word", w["word"]),
        })

    # --- Entities ---
    entities = []
    if "entities" in raw["results"]:
        for ent in raw["results"]["entities"].get("entities", []):
            entities.append({
                "label": ent.get("label", ""),
                "value": ent.get("value", ""),
                "confidence": ent.get("confidence", 0),
                "start_word": ent.get("start_word", 0),
                "end_word": ent.get("end_word", 0),
            })

    # --- Summary ---
    summary = ""
    if "summary" in raw["results"]:
        summary = raw["results"]["summary"].get("short", "")

    # --- Topics ---
    topics = []
    if "topics" in raw["results"]:
        segments = raw["results"]["topics"].get("segments", [])
        for seg in segments:
            for topic in seg.get("topics", []):
                topics.append({
                    "topic": topic.get("topic", ""),
                    "confidence": topic.get("confidence", 0),
                    "start": seg.get("start_word", 0),
                    "end": seg.get("end_word", 0),
                })

    # --- Unique speakers ---
    speaker_ids = sorted(set(p["speaker"] for p in paragraphs if p["speaker"] is not None))

    # --- Full transcript ---
    full_transcript = alternative.get("transcript", "")

    structured = {
        "metadata": {
            "duration": raw.get("metadata", {}).get("duration", 0),
            "channels": raw.get("metadata", {}).get("channels", 1),
            "model": raw.get("metadata", {}).get("model_info", {}),
        },
        "summary": summary,
        "topics": topics,
        "entities": entities,
        "speakers": speaker_ids,
        "paragraphs": paragraphs,
        "words": words,
        "full_transcript": full_transcript,
    }
    return structured


def compute_embeddings(structured: dict) -> list[list[float]]:
    """Compute OpenAI embeddings for each paragraph. Returns list of vectors."""
    from openai import OpenAI
    from speaker_map import get_speaker_name

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set. Add it to .env to precompute embeddings.")

    client = OpenAI(api_key=api_key)

    # Build embed texts: "[SpeakerName] paragraph text"
    texts = []
    for para in structured["paragraphs"]:
        name = get_speaker_name(para["speaker"])
        texts.append(f"[{name}] {para['text']}")

    print(f"Computing embeddings for {len(texts)} paragraphs (text-embedding-3-small)...")

    all_embeddings: list[list[float]] = []
    batch_size = 2048
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        print(f"  Batch {i // batch_size + 1} ({len(batch)} paragraphs)...")
        resp = client.embeddings.create(
            model="text-embedding-3-small",
            input=batch,
        )
        all_embeddings.extend([d.embedding for d in resp.data])

    return all_embeddings


def main():
    # Step 1: Transcribe
    if RAW_OUTPUT.exists():
        try:
            with open(RAW_OUTPUT) as f:
                raw = json.load(f)
            print(f"Raw transcription loaded from {RAW_OUTPUT} (cached)")
        except (json.JSONDecodeError, KeyError):
            print(f"Existing {RAW_OUTPUT} is corrupt, re-transcribing...")
            RAW_OUTPUT.unlink()
            raw = transcribe()
    else:
        raw = transcribe()

    # Step 2: Build structured data
    structured = build_structured(raw)
    with open(STRUCTURED_OUTPUT, "w") as f:
        json.dump(structured, f, indent=2)
    print(f"Structured transcription saved to {STRUCTURED_OUTPUT}")

    # Step 3: Precompute embeddings
    if EMBEDDINGS_OUTPUT.exists():
        print(f"Embeddings already exist at {EMBEDDINGS_OUTPUT} (cached)")
    else:
        embeddings = compute_embeddings(structured)
        with open(EMBEDDINGS_OUTPUT, "w") as f:
            json.dump(embeddings, f)
        print(f"Embeddings saved to {EMBEDDINGS_OUTPUT} ({len(embeddings)} vectors)")

    # Quick summary
    print(f"\n--- Summary ---")
    print(f"Duration: {structured['metadata']['duration']:.1f}s")
    print(f"Speakers: {len(structured['speakers'])}")
    print(f"Paragraphs: {len(structured['paragraphs'])}")
    print(f"Entities: {len(structured['entities'])}")
    print(f"Topics: {len(structured['topics'])}")
    print(f"\nSummary: {structured['summary'][:500]}")


if __name__ == "__main__":
    main()
