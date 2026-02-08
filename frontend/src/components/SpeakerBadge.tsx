"use client";

import { getSpeakerName } from "../lib/speakers";

const SPEAKER_COLORS: Record<number, string> = {
  0: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  1: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
};
const DEFAULT_COLOR = "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";

const SPEAKER_BORDERS: Record<number, string> = {
  0: "border-l-blue-400",
  1: "border-l-emerald-400",
};
const DEFAULT_BORDER = "border-l-gray-400";

export function getSpeakerColor(speaker: number | null): string {
  if (speaker === null) return DEFAULT_COLOR;
  return SPEAKER_COLORS[speaker] ?? DEFAULT_COLOR;
}

export function getSpeakerBorderColor(speaker: number | null): string {
  if (speaker === null) return DEFAULT_BORDER;
  return SPEAKER_BORDERS[speaker] ?? DEFAULT_BORDER;
}

export default function SpeakerBadge({ speaker }: { speaker: number | null }) {
  const color = getSpeakerColor(speaker);
  const name = getSpeakerName(speaker);
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {name}
    </span>
  );
}
