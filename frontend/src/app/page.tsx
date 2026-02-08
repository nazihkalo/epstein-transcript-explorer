"use client";

import { useState, useEffect } from "react";
import { useTranscript } from "../components/TranscriptProvider";
import SpeakerBadge from "../components/SpeakerBadge";
import { formatDuration } from "../lib/format";
import { getSpeakerName } from "../lib/speakers";
import { fetchSummary } from "../lib/api";
import Link from "next/link";
import Image from "next/image";

interface Section {
  title: string;
  timestamp_start: string;
  timestamp_end: string;
  summary: string;
  key_points: string[];
  speakers_involved: string[];
}

interface KeyFigure {
  name: string;
  context: string;
}

interface DetailedSummary {
  headline: string;
  overview: string;
  sections: Section[];
  key_figures_mentioned: KeyFigure[];
  key_themes: string[];
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-5 w-5 shrink-0 text-zinc-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function CollapsibleSection({
  section,
  defaultOpen = false,
}: {
  section: Section;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-zinc-200 last:border-b-0 dark:border-zinc-700">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      >
        <ChevronIcon open={open} />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-zinc-900 dark:text-zinc-100">{section.title}</div>
          <div className="text-xs text-zinc-400 mt-0.5">
            {section.timestamp_start} — {section.timestamp_end}
            {section.speakers_involved.length > 0 && (
              <span className="ml-2">
                ({section.speakers_involved.join(", ")})
              </span>
            )}
          </div>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pl-12">
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {section.summary}
          </p>
          {section.key_points.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {section.key_points.map((point, i) => (
                <li key={i} className="flex gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                  {point}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function OverviewPage() {
  const { data, loading, error } = useTranscript();
  const [summary, setSummary] = useState<DetailedSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [showAllFigures, setShowAllFigures] = useState(false);

  useEffect(() => {
    fetchSummary()
      .then(setSummary)
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-zinc-500">Loading transcript data...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-red-500">Error: {error || "No data available"}</div>
      </div>
    );
  }

  const uniqueTopics = Array.from(
    new Map(data.topics.map((t) => [t.topic, t])).values()
  ).sort((a, b) => b.confidence - a.confidence);

  const uniqueEntities = Array.from(
    new Map(data.entities.map((e) => [e.value, e])).values()
  ).sort((a, b) => b.confidence - a.confidence);

  const visibleFigures = showAllFigures
    ? summary?.key_figures_mentioned ?? []
    : (summary?.key_figures_mentioned ?? []).slice(0, 12);

  return (
    <div className="-mx-4 -mt-8">
      {/* Hero section */}
      <div className="relative h-64 sm:h-80 overflow-hidden">
        <Image
          src="/hero.jpg"
          alt="Recording frame"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight max-w-3xl">
            {summary?.headline || "Epstein Transcript Explorer"}
          </h1>
          <p className="mt-2 text-zinc-300 text-sm sm:text-base">
            Epstein-Ehud Recording — {formatDuration(data.metadata.duration)} — {data.paragraphs.length} paragraphs
          </p>
        </div>
      </div>

      <div className="px-4 space-y-8 mt-8 max-w-6xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Duration", value: formatDuration(data.metadata.duration) },
            { label: "Speakers", value: data.speakers.length },
            { label: "Paragraphs", value: data.paragraphs.length },
            { label: "Key Figures", value: summary?.key_figures_mentioned?.length ?? uniqueEntities.length },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="text-sm text-zinc-500 dark:text-zinc-400">{stat.label}</div>
              <div className="mt-1 text-2xl font-semibold">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Executive Overview */}
        {summary?.overview && (
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">Executive Summary</h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              {summary.overview.split("\n").filter(Boolean).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>
        )}

        {/* Table of Contents — collapsible sections */}
        {summary?.sections && summary.sections.length > 0 && (
          <section className="rounded-xl border border-zinc-200 bg-white overflow-hidden dark:border-zinc-800 dark:bg-zinc-900">
            <div className="px-6 pt-6 pb-3">
              <h2 className="text-lg font-semibold">Table of Contents</h2>
              <p className="mt-1 text-sm text-zinc-500">
                {summary.sections.length} sections — click to expand
              </p>
            </div>
            <div>
              {summary.sections.map((section, i) => (
                <CollapsibleSection
                  key={i}
                  section={section}
                  defaultOpen={i === 0}
                />
              ))}
            </div>
          </section>
        )}

        {/* Key Themes */}
        {summary?.key_themes && summary.key_themes.length > 0 && (
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">Key Themes</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {summary.key_themes.map((theme, i) => (
                <span
                  key={i}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {theme}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Key Figures Mentioned */}
        {summary?.key_figures_mentioned && summary.key_figures_mentioned.length > 0 && (
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">Key Figures Mentioned</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {visibleFigures.map((fig, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-zinc-50 px-3 py-2.5 dark:bg-zinc-800/50"
                >
                  <div className="font-medium text-sm">{fig.name}</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">
                    {fig.context}
                  </div>
                </div>
              ))}
            </div>
            {(summary.key_figures_mentioned.length > 12) && (
              <button
                onClick={() => setShowAllFigures(!showAllFigures)}
                className="mt-3 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              >
                {showAllFigures
                  ? "Show less"
                  : `Show all ${summary.key_figures_mentioned.length} figures`}
              </button>
            )}
          </section>
        )}

        {/* Speakers */}
        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold">Speakers</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {data.speakers.map((s) => {
              const count = data.paragraphs.filter((p) => p.speaker === s).length;
              return (
                <div key={s} className="flex items-center gap-2">
                  <SpeakerBadge speaker={s} />
                  <span className="text-sm text-zinc-500">
                    {getSpeakerName(s)} — {count} paragraphs
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Topics from Deepgram (if no key_themes from summary) */}
        {(!summary?.key_themes || summary.key_themes.length === 0) && uniqueTopics.length > 0 && (
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">Topics</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {uniqueTopics.slice(0, 20).map((t, i) => (
                <span
                  key={i}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {t.topic}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Entities */}
        {uniqueEntities.length > 0 && !summary?.key_figures_mentioned?.length && (
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-lg font-semibold">Detected Entities</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {uniqueEntities.slice(0, 30).map((e, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50"
                >
                  <span className="font-medium">{e.value}</span>
                  <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                    {e.label}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Quick links */}
        <div className="flex gap-4 pb-8">
          <Link
            href="/transcript"
            className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            View Transcript
          </Link>
          <Link
            href="/ask"
            className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Ask a Question
          </Link>
        </div>
      </div>
    </div>
  );
}
