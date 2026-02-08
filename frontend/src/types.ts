export interface Sentence {
  text: string;
  start: number;
  end: number;
}

export interface Paragraph {
  speaker: number | null;
  start: number;
  end: number;
  num_words: number;
  text: string;
  sentences: Sentence[];
}

export interface Word {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker: number | null;
  punctuated_word: string;
}

export interface Entity {
  label: string;
  value: string;
  confidence: number;
  start_word: number;
  end_word: number;
}

export interface Topic {
  topic: string;
  confidence: number;
  start: number;
  end: number;
}

export interface TranscriptData {
  metadata: {
    duration: number;
    channels: number;
    model: Record<string, unknown>;
  };
  summary: string;
  topics: Topic[];
  entities: Entity[];
  speakers: number[];
  paragraphs: Paragraph[];
  words: Word[];
  full_transcript: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: { text: string; speaker: number | null; start: number }[];
}
