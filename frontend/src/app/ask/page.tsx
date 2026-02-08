"use client";

import { useState, useRef, useEffect } from "react";
import { askQuestion } from "../../lib/api";
import SpeakerBadge from "../../components/SpeakerBadge";
import { formatTimestamp } from "../../lib/format";

interface Source {
  text: string;
  speaker: number | null;
  start: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

export default function AskPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || isLoading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setIsLoading(true);

    try {
      const result = await askQuestion(question);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.answer,
          sources: result.sources || [],
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error processing your question. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Ask About the Transcript</h1>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-medium text-zinc-400">Ask a question about the transcript</p>
              <p className="mt-2 text-sm text-zinc-400">
                Try: &quot;What are the main topics discussed?&quot; or &quot;What did Epstein say about...&quot;
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-white border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700"
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-600">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Sources:
                  </p>
                  {msg.sources.map((src, j) => (
                    <div
                      key={j}
                      className="rounded-lg bg-zinc-50 p-2 text-sm dark:bg-zinc-700/50"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <SpeakerBadge speaker={src.speaker} />
                        <span className="font-mono text-xs text-zinc-400">
                          {formatTimestamp(src.start)}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300 line-clamp-3">
                        {src.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-white border border-zinc-200 px-4 py-3 dark:bg-zinc-800 dark:border-zinc-700">
              <div className="flex gap-1">
                <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "0ms" }} />
                <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "150ms" }} />
                <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="mt-4 flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          disabled={isLoading}
          className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-xl bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
