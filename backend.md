## Backend Development Brief (Senior-Level)

### Tech Stack & Dependencies
- FastAPI + Uvicorn for ASGI server; structure app with modular routers.
- LangChain for document loading, text splitting (e.g., `RecursiveCharacterTextSplitter`), and vector store integration.
- Use Chroma DB (local persistent) for embeddings storage; configure path under `./backend/chroma_store`.
- OpenAI (or Azure/Gemini equivalent) for embeddings (`text-embedding-3-small` or latest) and chat completions with streaming support.
- Async-first implementation leveraging `async def` endpoints, `aiofiles` for disk IO, and `httpx` for outbound HTTP requests if needed.

### Service Architecture
- **Routers**:
  - `/upload` (POST): Accepts multiple PDF/TXT files, persists originals under `uploads/`, extracts text, chunks via LangChain splitter, computes embeddings, and upserts into Chroma. Returns consolidated knowledge base metadata (identifier, filename, chunk stats, ingestion timestamp).
  - `/qa` (POST, streaming): Accepts `{ "question": "...", "top_k": 4 }`, embeds query, performs similarity search, builds prompt with retrieved context, and streams model response tokens (Server-Sent Events or chunked transfer).
  - `/knowledge-base` (GET): Optional helper returning current ingested documents and metadata (rely on Chroma collection metadata or companion store).
- **Services**:
  - `ingest.py`: Pipeline for file validation, text extraction (PDF -> `pypdf`/`pdfminer`), chunking, embedding, and vector store persistence.
  - `qa.py`: Retrieval-augmented generation pipeline with prompt template, context window management, and LLM call abstraction.
- **Config**:
  - `.env` for `OPENAI_API_KEY`, `CHROMA_PERSIST_DIR`, model names, chunk size/overlap.
  - Pydantic settings module to centralize configuration with environment overrides.

### Operational Considerations
- Ensure idempotent ingestion: same file should update existing entries rather than duplicate (hash by filename + size).
- Implement file size/type guards and return descriptive errors (FastAPI `HTTPException`).
- Add background tasks for long-running ingestion if upload latency becomes high; respond with task ID and progress polling (future enhancement).
- Provide CORS middleware for the frontend (allow localhost dev origins).
- Testing: use `pytest` + `httpx.AsyncClient` for endpoint tests; mock embedding/LLM calls to avoid external dependencies.
- Logging: structured logs (standard logging module) for upload lifecycle and QA requests; include correlation IDs if feasible.
