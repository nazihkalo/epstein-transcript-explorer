"""Shared speaker name mapping."""

SPEAKER_NAMES: dict[int, str] = {
    0: "Epstein",
    1: "Ehud",
}


def get_speaker_name(speaker: int | None) -> str:
    if speaker is None:
        return "Unknown"
    return SPEAKER_NAMES.get(speaker, "Other")
