"use client";

import { useState, useMemo, useCallback } from "react";
import Fuse from "fuse.js";
import { useTranscript } from "../../components/TranscriptProvider";
import SpeakerBadge, { getSpeakerBorderColor } from "../../components/SpeakerBadge";
import { formatTimestamp } from "../../lib/format";
import { getSpeakerName } from "../../lib/speakers";
import type { Paragraph, Entity } from "../../types";

interface SearchResult {
  paragraph: Paragraph;
  index: number;
}

export default function SearchPage() {
  const { data, loading, error } = useTranscript();
  const [query, setQuery] = useState("");
  const [filterSpeaker, setFilterSpeaker] = useState<number | null>(null);
  const [filterEntity, setFilterEntity] = useState<string>("");

  const fuse = useMemo(() => {
    if (!data) return null;
    return new Fuse(
      data.paragraphs.map((p, i) => ({ ...p, index: i })),
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

  const results = useMemo(() => {
    if (!data) return [];

    let matches: SearchResult[];

    if (query.trim() && fuse) {
      matches = fuse.search(query).map((r) => ({
        paragraph: r.item,
        index: r.item.index,
      }));
    } else {
      matches = data.paragraphs.map((p, i) => ({ paragraph: p, index: i }));
    }

    // Filter by speaker
    if (filterSpeaker !== null) {
      matches = matches.filter((m) => m.paragraph.speaker === filterSpeaker);
    }

    // Filter by entity (check if entity value appears in paragraph text)
    if (filterEntity) {
      matches = matches.filter((m) =>
        m.paragraph.text.toLowerCase().includes(filterEntity.toLowerCase())
      );
    }

    return matches.slice(0, 100);
  }, [data, query, fuse, filterSpeaker, filterEntity]);

  const highlightText = useCallback(
    (text: string) => {
      if (!query.trim()) return text;
      const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
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

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-zinc-500">Loading...</div>
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Search Transcript</h1>

      {/* Search + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="Search transcript..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          value={filterSpeaker === null ? "all" : String(filterSpeaker)}
          onChange={(e) =>
            setFilterSpeaker(e.target.value === "all" ? null : Number(e.target.value))
          }
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="all">All speakers</option>
          {data.speakers.map((s) => (
            <option key={s} value={s}>
              {getSpeakerName(s)}
            </option>
          ))}
        </select>
        <select
          value={filterEntity}
          onChange={(e) => setFilterEntity(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="">All entities</option>
          {uniqueEntities.map((e, i) => (
            <option key={i} value={e.value}>
              {e.value} ({e.label})
            </option>
          ))}
        </select>
      </div>

      <div className="text-sm text-zinc-500">
        {results.length} result{results.length !== 1 ? "s" : ""}
        {results.length === 100 ? " (showing first 100)" : ""}
      </div>

      {/* Results */}
      <div className="space-y-3">
        {results.map((r) => (
          <div
            key={r.index}
            className={`rounded-lg border border-zinc-200 bg-white p-4 border-l-4 ${getSpeakerBorderColor(r.paragraph.speaker)} dark:border-zinc-800 dark:bg-zinc-900`}
          >
            <div className="mb-2 flex items-center gap-3">
              <SpeakerBadge speaker={r.paragraph.speaker} />
              <span className="font-mono text-xs text-zinc-400">
                {formatTimestamp(r.paragraph.start)} — {formatTimestamp(r.paragraph.end)}
              </span>
              <span className="text-xs text-zinc-400">#{r.index + 1}</span>
            </div>
            <p className="leading-relaxed text-zinc-800 dark:text-zinc-200">
              {highlightText(r.paragraph.text)}
            </p>
          </div>
        ))}
        {results.length === 0 && query && (
          <div className="py-12 text-center text-zinc-500">
            No results found for &quot;{query}&quot;
          </div>
        )}
      </div>
    </div>
  );
}
