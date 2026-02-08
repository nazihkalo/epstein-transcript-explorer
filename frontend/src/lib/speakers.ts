/** Hardcoded speaker name mapping from Deepgram diarization IDs */
export const SPEAKER_NAMES: Record<number, string> = {
  0: "Epstein",
  1: "Ehud",
};

export function getSpeakerName(speaker: number | null): string {
  if (speaker === null) return "Unknown";
  return SPEAKER_NAMES[speaker] ?? "Other";
}
