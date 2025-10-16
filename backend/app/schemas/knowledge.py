from datetime import datetime
from pydantic import BaseModel, Field


class KnowledgeDocument(BaseModel):
    id: str
    filename: str
    size: int = Field(ge=0)
    chunk_count: int = Field(ge=0)
    ingested_at: datetime


class UploadResponse(BaseModel):
    documents: list[KnowledgeDocument]


class KnowledgeListResponse(BaseModel):
    documents: list[KnowledgeDocument]
