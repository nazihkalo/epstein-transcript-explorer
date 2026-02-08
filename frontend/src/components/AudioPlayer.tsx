"use client";

import { useRef, useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react";
import { formatTimestamp } from "../lib/format";

interface AudioContextValue {
  seekTo: (seconds: number) => void;
  togglePlay: () => void;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

const AudioCtx = createContext<AudioContextValue>({
  seekTo: () => {},
  togglePlay: () => {},
  currentTime: 0,
  duration: 0,
  isPlaying: false,
});

export function useAudio() {
  return useContext(AudioCtx);
}

export function AudioProvider({
  src,
  children,
}: {
  src: string;
  children: ReactNode;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    audio.play();
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play();
    else audio.pause();
  }, []);

  return (
    <AudioCtx.Provider value={{ seekTo, togglePlay, currentTime, duration, isPlaying }}>
      <audio ref={audioRef} src={src} preload="metadata" />
      {children}
    </AudioCtx.Provider>
  );
}

/** Standalone sticky player bar — place anywhere in the tree under AudioProvider */
export function StickyPlayer() {
  const { togglePlay, currentTime, duration, isPlaying } = useAudio();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // We need a ref to the actual audio element for seeking via the range input.
  // Since we can't get it from context easily, we'll query the DOM.
  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = document.querySelector("audio");
    if (audio) audio.currentTime = Number(e.target.value);
  }, []);

  return (
    <div className="flex items-center gap-3 w-full">
      <button
        onClick={togglePlay}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isPlaying ? (
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <span className="font-mono text-xs text-zinc-500 w-11 text-right shrink-0">
        {formatTimestamp(currentTime)}
      </span>

      <input
        type="range"
        min={0}
        max={duration || 0}
        value={currentTime}
        onChange={handleSeek}
        className="flex-1 h-1.5 cursor-pointer appearance-none rounded-full bg-zinc-200 accent-zinc-900 dark:bg-zinc-700 dark:accent-zinc-300"
      />

      <span className="font-mono text-xs text-zinc-500 w-11 shrink-0">
        {formatTimestamp(duration)}
      </span>
    </div>
  );
}
