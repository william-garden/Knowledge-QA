from datetime import datetime
from pydantic import BaseModel, Field


class KnowledgeDocument(BaseModel):
    id: str
    filename: str
    size: int = Field(ge=0)
    chunk_count: int = Field(ge=0)
    ingested_at: datetime
    source_path: str | None = None


class UploadResponse(BaseModel):
    documents: list[KnowledgeDocument]


class KnowledgeListResponse(BaseModel):
    documents: list[KnowledgeDocument]


class KnowledgeChunksResponse(BaseModel):
    chunks: list[str]
