from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.schemas.provider import ProviderId


class Settings(BaseSettings):
    # Pydantic doesn't accept Path default to relative; convert to absolute in post init.
    project_name: str = "Personal Knowledge Base QA"
    api_prefix: str = "/api"

    uploads_dir: Path = Field(default=Path("storage/uploads"))
    chroma_dir: Path = Field(default=Path("storage/chroma"))
    metadata_file: Path = Field(default=Path("storage/metadata.json"))
    conversations_file: Path = Field(default=Path("storage/conversations.json"))

    # Legacy defaults (retained for backwards compatibility with existing deployments)
    openai_api_key: str | None = None
    api_base: str = "https://ark.cn-beijing.volces.com/api/v3"
    embedding_model: str = "text-embedding-v1"
    chat_model: str = "doubao-seed-1-6-251015"

    # Provider-specific defaults
    doubao_api_key: str | None = None
    doubao_base_url: str | None = None
    doubao_model: str | None = None

    chatgpt_api_key: str | None = None
    chatgpt_base_url: str = "https://api.openai.com/v1"
    chatgpt_model: str = "gpt-4o-mini"

    gemini_api_key: str | None = None
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    gemini_model: str = "gemini-1.5-pro-latest"

    grok_api_key: str | None = None
    grok_base_url: str = "https://api.x.ai/v1"
    grok_model: str = "grok-beta"

    chunk_size: int = 800
    chunk_overlap: int = 200
    top_k: int = 8

    max_upload_size_mb: int = 15

    model_config = SettingsConfigDict(env_prefix="PKB_", env_file=".env", env_file_encoding="utf-8")

    def resolve_paths(self) -> None:
        self.uploads_dir = self._ensure_dir(self.uploads_dir)
        self.chroma_dir = self._ensure_dir(self.chroma_dir)
        self.metadata_file = (
            self.metadata_file if self.metadata_file.is_absolute() else Path.cwd() / self.metadata_file
        )
        if not self.metadata_file.parent.exists():
            self.metadata_file.parent.mkdir(parents=True, exist_ok=True)
        self.conversations_file = (
            self.conversations_file
            if self.conversations_file.is_absolute()
            else Path.cwd() / self.conversations_file
        )
        if not self.conversations_file.parent.exists():
            self.conversations_file.parent.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def _ensure_dir(path: Path) -> Path:
        absolute = path if path.is_absolute() else Path.cwd() / path
        absolute.mkdir(parents=True, exist_ok=True)
        return absolute

    def provider_defaults(self, provider_id: str) -> dict[str, Any]:
        if provider_id == ProviderId.DOU_BAO.value:
            return {
                "api_key": self.doubao_api_key or self.openai_api_key,
                "base_url": self.doubao_base_url or self.api_base,
                "model": self.doubao_model or self.chat_model,
            }
        if provider_id == ProviderId.CHATGPT.value:
            return {
                "api_key": self.chatgpt_api_key or self.openai_api_key,
                "base_url": self.chatgpt_base_url,
                "model": self.chatgpt_model,
            }
        if provider_id == ProviderId.GEMINI.value:
            return {
                "api_key": self.gemini_api_key,
                "base_url": self.gemini_base_url,
                "model": self.gemini_model,
            }
        if provider_id == ProviderId.GROK.value:
            return {
                "api_key": self.grok_api_key,
                "base_url": self.grok_base_url,
                "model": self.grok_model,
            }
        return {
            "api_key": None,
            "base_url": None,
            "model": None,
        }


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    settings.resolve_paths()
    return settings
