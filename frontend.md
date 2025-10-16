## Frontend Development Brief (Senior-Level)

### Tech Stack & Tooling
- Vite + React 18 + TypeScript; enable SWC for fast HMR during development.
- UI styling with Tailwind CSS for rapid iteration; augment with headless UI primitives where necessary.
- State coordination via React Query for server data (uploads, knowledge base list, chat history) and Zustand or Context for transient UI state.
- Adopt ESLint + Prettier with TypeScript-aware configs; integrate testing-library and Vitest for component tests.

### Architecture Overview
- **Layout shell**: Split-pane UI with a persistent sidebar for knowledge base management and a main chat workspace.
- **Sidebar modules**:
  - Knowledge base list with status indicators and actions (refresh, delete placeholder for future).
  - File upload panel that supports PDF/TXT drag & drop, multi-file queue, and per-file progress bars that reflect `/upload` responses.
  - Upload service should stream `FormData` entries and consume backend progress events via SSE or polling fallback.
- **Chat workspace**:
  - Message list with role-based styling; maintain scroll anchoring for streaming responses.
  - Composer supporting multiline input, keyboard shortcuts (Enter to send, Shift+Enter newline), and disabled state while awaiting response.
  - Typing indicator and incremental rendering of streaming AI responses using Fetch streaming or WebSocket fallback.
- **Data layer**:
  - Abstracted API client module handling `/upload`, `/qa` (streaming), and `/knowledge-base` (if backend exposes list endpoint; otherwise reuse upload response payload).
  - Normalized store for knowledge base metadata; optimistic updates during upload completion.
- **Error handling & UX**:
  - Toast notifications (e.g., `sonner` or custom hook) for failures/success.
  - Guard against duplicate uploads, unsupported MIME types, and large file sizes (configurable limit).
  - Empty states and skeletons for first-time users.

### Development Workflow
- Configure `.env` for backend base URL; default to `http://localhost:8000`.
- Vite dev server runs on port 5173; use proxy to backend for `/api/*` routes if CORS becomes cumbersome.
- Implement component-driven development; storybook optional but recommended if time allows.
- Prioritize accessibility (semantic HTML, focus management) and responsive layout (mobile/desktop).
