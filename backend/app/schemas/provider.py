from __future__ import annotations

from enum import Enum
from typing import ClassVar

from pydantic import BaseModel, Field


class ProviderId(str, Enum):
    DOU_BAO = "doubao"
    CHATGPT = "chatgpt"
    GEMINI = "gemini"
    GROK = "grok"


class ConversationProvider(BaseModel):
    id: str = Field(default=ProviderId.DOU_BAO.value, min_length=1)
    name: str = Field(default="豆包", min_length=1)
    model: str | None = None


class ProviderRuntimeConfig(BaseModel):
    id: str = Field(..., min_length=1)
    label: str | None = None
    model: str | None = None
    api_key: str | None = Field(default=None, min_length=1)
    base_url: str | None = None


DEFAULT_PROVIDER = ConversationProvider()
