from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.provider import ConversationProvider

DEFAULT_CONVERSATION_TITLE = "New conversation"


class ConversationMessage(BaseModel):
    id: str
    role: Literal["user", "assistant", "system"]
    content: str = Field(..., min_length=1)
    created_at: datetime


class Conversation(BaseModel):
    id: str
    title: str = Field(default=DEFAULT_CONVERSATION_TITLE)
    created_at: datetime
    updated_at: datetime
    provider: ConversationProvider = Field(default_factory=ConversationProvider)
    messages: list[ConversationMessage] = Field(default_factory=list)


class ConversationSummary(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    provider: ConversationProvider


class ConversationListResponse(BaseModel):
    conversations: list[ConversationSummary]


class ConversationDetailResponse(BaseModel):
    conversation: Conversation


class ConversationCreateRequest(BaseModel):
    title: str | None = None
    provider: ConversationProvider


class ConversationRenameRequest(BaseModel):
    title: str = Field(..., min_length=1)
