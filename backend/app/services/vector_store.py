from __future__ import annotations

from functools import lru_cache
from typing import Optional

try:
    # Preferred path with LangChain 1.0 split packages.
    from langchain_chroma import Chroma  # type: ignore
except ImportError:  # pragma: no cover - fallback for older LangChain
    from langchain_community.vectorstores import Chroma  # type: ignore

from app.core.config import Settings
from app.services.embeddings import DoubaoEmbeddings


@lru_cache(maxsize=1)
def _get_embeddings(model: str, api_key: Optional[str], base_url: str) -> DoubaoEmbeddings:
    if not api_key:
        raise ValueError("Doubao API key is required for embeddings.", model, api_key, base_url)
    return DoubaoEmbeddings(base_url=base_url, api_key=api_key, model=model)


def get_vector_store(settings: Settings) -> Chroma:
    embeddings = _get_embeddings(settings.embedding_model, settings.openai_api_key, settings.api_base)
    return Chroma(
        persist_directory=str(settings.chroma_dir),
        embedding_function=embeddings,
        collection_name="personal_knowledge_base"
    )
