"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Fuse from "fuse.js";
import { useTranscript } from "../../components/TranscriptProvider";
import SpeakerBadge, { getSpeakerBorderColor } from "../../components/SpeakerBadge";
import { AudioProvider, useAudio, StickyPlayer } from "../../components/AudioPlayer";
import { formatTimestamp } from "../../lib/format";
import { getSpeakerName } from "../../lib/speakers";

function TranscriptContent() {
  const { data } = useTranscript();
  const { seekTo, currentTime, isPlaying } = useAudio();
  const [filterSpeaker, setFilterSpeaker] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const activeRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const fuse = useMemo(() => {
    if (!data) return null;
    return new Fuse(
      data.paragraphs.map((p, i) => ({ ...p, _idx: i })),
      {
        keys: ["text"],
        threshold: 0.3,
        includeScore: true,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }
    );
  }, [data]);

  const uniqueEntities = useMemo(() => {
    if (!data) return [];
    return Array.from(new Map(data.entities.map((e) => [e.value, e])).values()).sort(
      (a, b) => a.value.localeCompare(b.value)
    );
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];

    // Start with search or all paragraphs
    let results: { para: (typeof data.paragraphs)[0]; idx: number }[];

    if (query.trim() && fuse) {
      results = fuse.search(query).map((r) => ({
        para: r.item,
        idx: r.item._idx,
      }));
    } else {
      results = data.paragraphs.map((p, i) => ({ para: p, idx: i }));
    }

    // Speaker filter
    if (filterSpeaker !== null) {
      results = results.filter((r) => r.para.speaker === filterSpeaker);
    }

    // Entity filter
    if (filterEntity) {
      results = results.filter((r) =>
        r.para.text.toLowerCase().includes(filterEntity.toLowerCase())
      );
    }

    return results;
  }, [data, query, fuse, filterSpeaker, filterEntity]);

  // Disable auto-scroll when user is searching
  const isSearching = query.trim().length > 0 || filterSpeaker !== null || filterEntity !== "";

  // Auto-scroll to active paragraph when playing
  useEffect(() => {
    if (isPlaying && autoScroll && !isSearching && activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentTime, isPlaying, autoScroll, isSearching]);

  const highlightText = useCallback(
    (text: string) => {
      if (!query.trim()) return text;
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(${escaped})`, "gi");
      const parts = text.split(regex);
      return parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-800">
            {part}
          </mark>
        ) : (
          part
        )
      );
    },
    [query]
  );

  if (!data) return null;

  return (
    <div className="pb-8">
      {/* Sticky toolbar: player + search + filters */}
      <div className="sticky top-14 z-40 -mx-4 border-b border-zinc-200 bg-white/95 backdrop-blur-sm px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="space-y-3">
          {/* Audio player row */}
          <StickyPlayer />

          {/* Search + filters row */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search transcript..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-10 pr-4 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <select
              value={filterSpeaker === null ? "all" : String(filterSpeaker)}
              onChange={(e) =>
                setFilterSpeaker(e.target.value === "all" ? null : Number(e.target.value))
              }
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="all">All speakers</option>
              {data.speakers.map((s) => (
                <option key={s} value={s}>
                  {getSpeakerName(s)}
                </option>
              ))}
            </select>

            {uniqueEntities.length > 0 && (
              <select
                value={filterEntity}
                onChange={(e) => setFilterEntity(e.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">All entities</option>
                {uniqueEntities.map((e, i) => (
                  <option key={i} value={e.value}>
                    {e.value} ({e.label})
                  </option>
                ))}
              </select>
            )}

            <label className="flex shrink-0 items-center gap-2 text-sm text-zinc-500">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded"
              />
              Auto-scroll
            </label>
          </div>

          {/* Result count */}
          <div className="text-xs text-zinc-400">
            {filtered.length} paragraph{filtered.length !== 1 ? "s" : ""}
            {isSearching ? " matching" : ""}
            {" — click to jump to audio"}
          </div>
        </div>
      </div>

      {/* Paragraph list */}
      <div className="mt-4 space-y-3">
        {filtered.map((r) => {
          const isActive =
            isPlaying && currentTime >= r.para.start && currentTime < r.para.end;

          return (
            <div
              key={r.idx}
              ref={isActive ? activeRef : undefined}
              onClick={() => seekTo(r.para.start)}
              className={`cursor-pointer rounded-lg border bg-white p-4 border-l-4 transition-all ${getSpeakerBorderColor(r.para.speaker)} dark:bg-zinc-900 ${
                isActive
                  ? "border-zinc-400 ring-2 ring-zinc-300 dark:border-zinc-500 dark:ring-zinc-600"
                  : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
              }`}
            >
              <div className="mb-2 flex items-center gap-3">
                <SpeakerBadge speaker={r.para.speaker} />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    seekTo(r.para.start);
                  }}
                  className="font-mono text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                  title="Jump to this timestamp"
                >
                  {formatTimestamp(r.para.start)} — {formatTimestamp(r.para.end)}
                </button>
                {isActive && (
                  <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
                    Playing
                  </span>
                )}
              </div>
              <p className="leading-relaxed text-zinc-800 dark:text-zinc-200">
                {highlightText(r.para.text)}
              </p>
            </div>
          );
        })}
        {filtered.length === 0 && query && (
          <div className="py-12 text-center text-zinc-500">
            No results found for &quot;{query}&quot;
          </div>
        )}
      </div>
    </div>
  );
}

export default function TranscriptPage() {
  const { data, loading, error } = useTranscript();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-zinc-500">Loading transcript...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-red-500">Error: {error || "No data"}</div>
      </div>
    );
  }

  return (
    <AudioProvider src="/api/audio">
      <TranscriptContent />
    </AudioProvider>
  );
}
