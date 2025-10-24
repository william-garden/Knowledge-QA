from functools import lru_cache

from fastapi import Header

from app.core.config import Settings, get_settings
from app.services.conversations import ConversationStore
from app.services.metadata import MetadataStore


def get_runtime_settings(
    llm_api_key: str | None = Header(default=None, alias="X-LLM-Api-Key"),
    llm_api_base: str | None = Header(default=None, alias="X-LLM-Api-Base"),
    llm_embedding_model: str | None = Header(default=None, alias="X-LLM-Embedding-Model"),
    llm_chat_model: str | None = Header(default=None, alias="X-LLM-Chat-Model"),
) -> Settings:
    settings = get_settings().model_copy(deep=True)
    if llm_api_key:
        settings.openai_api_key = llm_api_key
    if llm_api_base:
        settings.api_base = llm_api_base
    if llm_embedding_model:
        settings.embedding_model = llm_embedding_model
    if llm_chat_model:
        settings.chat_model = llm_chat_model
    settings.resolve_paths()
    return settings


@lru_cache(maxsize=1)
def _metadata_store() -> MetadataStore:
    settings = get_settings()
    return MetadataStore(settings.metadata_file)


def get_metadata_store() -> MetadataStore:
    return _metadata_store()


@lru_cache(maxsize=1)
def _conversation_store() -> ConversationStore:
    settings = get_settings()
    return ConversationStore(settings.conversations_file)


def get_conversation_store() -> ConversationStore:
    return _conversation_store()
