"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { TranscriptData } from "../types";
import { fetchTranscript } from "../lib/api";

interface TranscriptContextValue {
  data: TranscriptData | null;
  loading: boolean;
  error: string | null;
}

const TranscriptContext = createContext<TranscriptContextValue>({
  data: null,
  loading: true,
  error: null,
});

export function useTranscript() {
  return useContext(TranscriptContext);
}

export default function TranscriptProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<TranscriptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTranscript()
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <TranscriptContext.Provider value={{ data, loading, error }}>
      {children}
    </TranscriptContext.Provider>
  );
}
