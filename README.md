# Epstein Transcript Explorer

Transcription, search, and Q&A over the Epstein-Ehud recording. Uses Deepgram for transcription with speaker diarization and entity detection, a Next.js frontend for exploration, and Modal for deployment.

## Setup

### 1. Install Python deps

```bash
uv sync
```

### 2. Configure API keys

```bash
cp .env.example .env
# Edit .env with your DEEPGRAM_API_KEY and OPENAI_API_KEY
```

### 3. Run transcription

```bash
uv run python main.py
```

This reads the MP4, sends it to Deepgram, and writes:
- `data/transcription.json` — raw Deepgram response
- `data/transcript_structured.json` — cleaned structured data

### 4. Local development

Run the backend and frontend in two terminals:

```bash
# Terminal 1: FastAPI backend on :8000
uv run uvicorn server:app --reload --port 8000

# Terminal 2: Next.js dev server on :3000
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 — API calls are proxied to the backend automatically.

### 5. Build frontend (for deployment)

```bash
cd frontend
npm run build
cd ..
```

### 6. Set Modal secrets

```bash
modal secret create openai-secret OPENAI_API_KEY=your_key_here
```

### 7. Deploy to Modal

```bash
# Development (hot reload)
modal serve modal_app.py

# Production
modal deploy modal_app.py
```

## Architecture

- **`main.py`** — Deepgram transcription pipeline (run once)
- **`server.py`** — Local FastAPI dev server (same endpoints as Modal)
- **`modal_app.py`** — FastAPI backend + static file serving on Modal
- **`frontend/`** — Next.js app (static export)
- **`data/`** — Source MP4 + generated transcript JSON

## API Endpoints

- `GET /api/transcript` — Full structured transcript
- `GET /api/search?q=...&speaker=...` — Search with optional speaker filter
- `POST /api/ask` — Q&A with RAG over transcript (requires OpenAI key)
