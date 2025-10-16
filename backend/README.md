## Backend Setup

### 1. Create a virtual environment
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install --upgrade pip
pip install -e .[dev]
```

### 2. Configure environment variables
Copy `.env.example` to `.env` and provide your Doubao Ark credentials. Key fields:
```
PKB_OPENAI_API_KEY=your-doubao-api-key
PKB_API_BASE=https://ark.cn-beijing.volces.com/api/v3
PKB_CHAT_MODEL=doubao-seed-1-6-251015
PKB_EMBEDDING_MODEL=text-embedding-v1
PKB_CHUNK_SIZE=800
PKB_CHUNK_OVERLAP=200
PKB_MAX_UPLOAD_SIZE_MB=15
```

### 3. Run the server
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. API summary
- `POST /api/upload` ¨C ingest PDF/TXT files, chunk with LangChain, embed, and persist to Chroma.
- `GET /api/knowledge-base` ¨C list ingested documents and metadata.
- `POST /api/qa` ¨C stream an answer generated from retrieved context.

### 5. Testing
```bash
pytest
```
