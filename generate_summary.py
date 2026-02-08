"""
One-time script: generate a detailed table-of-contents style summary
of the transcript using GPT-5.1. Saves to data/detailed_summary.json.

Usage:
    uv run python generate_summary.py
"""

import json
import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

from speaker_map import get_speaker_name

load_dotenv()

DATA_DIR = Path(__file__).parent / "data"
TRANSCRIPT_PATH = DATA_DIR / "transcript_structured.json"
OUTPUT_PATH = DATA_DIR / "detailed_summary.json"


def main():
    if OUTPUT_PATH.exists():
        print(f"Detailed summary already exists at {OUTPUT_PATH}. Delete it to regenerate.")
        return

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set in .env")

    with open(TRANSCRIPT_PATH) as f:
        data = json.load(f)

    # Build a condensed version of the transcript for the prompt
    # Include speaker names and timestamps
    lines = []
    for para in data["paragraphs"]:
        name = get_speaker_name(para["speaker"])
        minutes = int(para["start"] // 60)
        seconds = int(para["start"] % 60)
        ts = f"{minutes}:{seconds:02d}"
        lines.append(f"[{ts}] {name}: {para['text']}")

    transcript_text = "\n".join(lines)

    # Truncate if extremely long (GPT-5.1 has large context but let's be safe)
    # text-embedding tokens ~ 4 chars per token, 200k context
    max_chars = 600_000
    if len(transcript_text) > max_chars:
        transcript_text = transcript_text[:max_chars] + "\n\n[TRANSCRIPT TRUNCATED]"

    print(f"Transcript: {len(transcript_text):,} chars, {len(data['paragraphs'])} paragraphs")
    print("Sending to GPT-5.1 for detailed summary generation...")

    client = OpenAI(api_key=api_key)
    completion = client.chat.completions.create(
        model="gpt-5.1",
        messages=[
            {
                "role": "system",
                "content": """You are an expert analyst creating a detailed table of contents and summary for an audio transcript of a conversation between Jeffrey Epstein and Ehud Barak.

Produce a JSON object with this exact structure:
{
  "headline": "A single compelling headline summarizing the entire conversation",
  "overview": "A 2-3 paragraph executive summary of the conversation, covering the key themes, context, and significance",
  "sections": [
    {
      "title": "Section title (e.g., 'Opening Remarks and Context Setting')",
      "timestamp_start": "approximate start time like '0:00'",
      "timestamp_end": "approximate end time like '12:30'",
      "summary": "2-4 sentence summary of this section",
      "key_points": ["bullet point 1", "bullet point 2", ...],
      "speakers_involved": ["Epstein", "Ehud"]
    }
  ],
  "key_figures_mentioned": [
    {"name": "Person Name", "context": "Brief description of how they're referenced"}
  ],
  "key_themes": ["theme 1", "theme 2", ...]
}

Break the conversation into 8-15 logical sections based on topic shifts. Be thorough and specific — include names, places, and concrete details from the conversation. Do not editorialize or add moral judgments.""",
            },
            {
                "role": "user",
                "content": f"Here is the full transcript:\n\n{transcript_text}",
            },
        ],
        max_completion_tokens=16000,
        response_format={"type": "json_object"},
    )

    result_text = completion.choices[0].message.content
    if not result_text:
        raise RuntimeError("Empty response from GPT-5.1")

    summary = json.loads(result_text)

    with open(OUTPUT_PATH, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"Detailed summary saved to {OUTPUT_PATH}")
    print(f"Sections: {len(summary.get('sections', []))}")
    print(f"Key figures: {len(summary.get('key_figures_mentioned', []))}")
    print(f"Headline: {summary.get('headline', 'N/A')}")


if __name__ == "__main__":
    main()
