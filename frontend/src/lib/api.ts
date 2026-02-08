const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export async function fetchTranscript() {
  const res = await fetch(`${API_BASE}/api/transcript`);
  if (!res.ok) throw new Error("Failed to fetch transcript");
  return res.json();
}

export async function searchTranscript(
  query: string,
  speaker?: number | null,
) {
  const params = new URLSearchParams({ q: query });
  if (speaker !== null && speaker !== undefined) {
    params.set("speaker", String(speaker));
  }
  const res = await fetch(`${API_BASE}/api/search?${params}`);
  if (!res.ok) throw new Error("Failed to search");
  return res.json();
}

export async function fetchSummary() {
  const res = await fetch(`${API_BASE}/api/summary`);
  if (!res.ok) throw new Error("Failed to fetch summary");
  return res.json();
}

export async function askQuestion(question: string) {
  const res = await fetch(`${API_BASE}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error("Failed to get answer");
  return res.json();
}
