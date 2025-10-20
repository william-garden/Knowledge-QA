from functools import lru_cache

from app.core.config import Settings, get_settings
from app.services.conversations import ConversationStore
from app.services.metadata import MetadataStore


def get_app_settings() -> Settings:
    return get_settings()


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
