# Personal Knowledge Base QA Robot

This repository delivers a full-stack personal knowledge assistant capable of ingesting local documents and answering questions grounded in their content.

- `frontend/` – React + Vite + TypeScript SPA with a chat interface, document upload dashboard, and streaming answer rendering.
- `backend/` – FastAPI service that ingests files with LangChain, stores embeddings in Chroma, and exposes upload plus retrieval-augmented QA endpoints.
- `frontend.md` / `backend.md` – senior-level engineering briefs outlining architecture and implementation guidelines.

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

## Development Notes
- The Vite dev server (port 5173) proxies `/api/*` to the FastAPI backend; override via `VITE_API_BASE`.
- Uploaded binaries persist under `backend/storage/uploads`; embeddings live in `backend/storage/chroma`.
- The QA endpoint streams tokens with Server-Sent Events; the React client appends chunks in real time.

## Testing
- Backend: `pytest`
- Frontend: `npm run test` (Vitest)
