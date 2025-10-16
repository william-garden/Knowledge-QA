from __future__ import annotations

from typing import Iterable, List, Sequence

from openai import OpenAI
from langchain_core.embeddings import Embeddings


def _to_text(value: object) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="ignore")
    if isinstance(value, (list, tuple)):
        return _join_sequence(value)
    return str(value)


class DoubaoEmbeddings(Embeddings):
    def __init__(self, base_url: str, api_key: str, model: str) -> None:
        self.client = OpenAI(base_url=base_url, api_key=api_key)
        self.model = model

    def embed_documents(self, texts: Iterable[str]) -> List[List[float]]:
        payload = [_sanitize_text(text) for text in texts]
        response = self.client.embeddings.create(model=self.model, input=payload)
        return [item.embedding for item in response.data]

    def embed_query(self, text: str) -> List[float]:
        payload = _sanitize_text(text)
        response = self.client.embeddings.create(model=self.model, input=[payload])
        return response.data[0].embedding


def _sanitize_text(text: str | bytes | object) -> str:
    output = _to_text(text)
    return " ".join(output.split()).strip()


def _join_sequence(values: Sequence[object]) -> str:
    chars: list[str] = []
    for item in values:
        if isinstance(item, (int, float)):
            codepoint = int(item)
            if 0 <= codepoint <= 0x10FFFF:
                try:
                    chars.append(chr(codepoint))
                    continue
                except ValueError:
                    pass
        chars.append(str(item))
    return "".join(chars)
