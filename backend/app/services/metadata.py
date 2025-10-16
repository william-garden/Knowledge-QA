from __future__ import annotations

import json
from pathlib import Path
from threading import Lock
from typing import Iterable

from app.schemas.knowledge import KnowledgeDocument


class MetadataStore:
    def __init__(self, path: Path):
        self.path = path
        self._lock = Lock()

    def list(self) -> list[KnowledgeDocument]:
        if not self.path.exists():
            return []
        with self.path.open("r", encoding="utf-8") as file:
            payload = json.load(file)
        documents = [KnowledgeDocument.model_validate(item) for item in payload]
        documents.sort(key=lambda doc: doc.ingested_at, reverse=True)
        return documents

    def upsert_many(self, documents: Iterable[KnowledgeDocument]) -> list[KnowledgeDocument]:
        with self._lock:
            existing = {doc.id: doc for doc in self.list()}
            for document in documents:
                existing[document.id] = document
            payload = list(existing.values())
            payload.sort(key=lambda doc: doc.ingested_at, reverse=True)
            self._write(payload)
        return payload

    def _write(self, documents: Iterable[KnowledgeDocument]) -> None:
        serializable = [
            document.model_dump(mode="json") for document in documents
        ]
        self.path.write_text(json.dumps(serializable, ensure_ascii=False, indent=2), encoding="utf-8")
