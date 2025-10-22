from pydantic import BaseModel, Field

from app.schemas.provider import ProviderRuntimeConfig


class QuestionRequest(BaseModel):
    question: str = Field(..., min_length=1)
    top_k: int | None = Field(default=None, ge=1, le=10)
    conversation_id: str | None = Field(default=None, min_length=1)
    provider: ProviderRuntimeConfig
