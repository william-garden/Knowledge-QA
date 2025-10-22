# Personal Knowledge Base QA Robot

This repository delivers a full-stack personal knowledge assistant capable of ingesting local documents and answering questions grounded in their content. It now includes a cross-platform Tauri desktop shell that orchestrates the existing frontend and backend while persisting secrets locally.

- `frontend/` – React + Vite + TypeScript SPA with chat UI, knowledge management, streaming answers, and multi-provider controls.
- `backend/` – FastAPI service that ingests files with LangChain, stores embeddings in Chroma, and exposes upload plus retrieval-augmented QA endpoints.
- `app/` – Tauri workspace wrapping the web client and Python backend into a Windows/macOS desktop app.
- `frontend.md` / `backend.md` – senior-level engineering briefs outlining architecture and implementation guidelines.
- `tarui.md` – detailed design notes for the Tauri integration and release plan.

## Quick Start

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -e .[dev]
copy .env.example .env  # Windows shell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Desktop App (Tauri)
```bash
cd app
npm install            # installs @tauri-apps/cli (requires Rust toolchain)
npm run dev            # launches the desktop shell together with the Vite dev server
```

To ship native bundles:
```bash
npm run build          # builds the web assets and produces platform-specific installers
```
> ⚠️ Before running the desktop shell, configure provider API keys through the in-app “Manage APIs” dialog (stored locally via Tauri), or preload them with `tauri invoke upsert_provider_secret`.

## Development Notes
- The Vite dev server (port 5173) proxies `/api/*` to the FastAPI backend; override via `VITE_API_BASE`.
- Uploaded binaries persist under `backend/storage/uploads`; embeddings live in `backend/storage/chroma`.
- The QA endpoint streams tokens with Server-Sent Events; the React client appends chunks in real time.
- Conversations are bound to a single AI provider (Doubao, ChatGPT, Gemini, Grok). Provider API keys and preferences are stored on-device through the Tauri layer.

## Testing
- Backend: `pytest`
- Frontend: `npm run test` (Vitest)
- Desktop shell: `npm run lint` / `npm run build` inside `app`
