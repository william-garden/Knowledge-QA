from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Iterable
from uuid import uuid4

from app.schemas.conversation import (
    Conversation,
    ConversationDetailResponse,
    ConversationListResponse,
    ConversationMessage,
    ConversationSummary,
    DEFAULT_CONVERSATION_TITLE,
)


def _derive_title(content: str) -> str:
    line = content.strip().splitlines()[0] if content.strip() else DEFAULT_CONVERSATION_TITLE
    return line[:48]


class ConversationStore:
    def __init__(self, path: Path):
        self.path = path
        self._lock = Lock()

    # Internal helpers -------------------------------------------------
    def _read(self) -> list[Conversation]:
        if not self.path.exists():
            return []
        with self.path.open("r", encoding="utf-8") as file:
            payload = json.load(file)
        return [Conversation.model_validate(item) for item in payload]

    def _write(self, conversations: Iterable[Conversation]) -> None:
        serializable = [
            conversation.model_dump(mode="json") for conversation in conversations
        ]
        self.path.write_text(
            json.dumps(serializable, ensure_ascii=False, indent=2),
            encoding="utf-8"
        )

    # Public API -------------------------------------------------------
    def list(self) -> list[ConversationSummary]:
        conversations = sorted(
            self._read(),
            key=lambda item: item.updated_at,
            reverse=True
        )
        return [
            ConversationSummary(
                id=item.id,
                title=item.title,
                created_at=item.created_at,
                updated_at=item.updated_at,
            )
            for item in conversations
        ]

    def get(self, conversation_id: str) -> Conversation | None:
        for conversation in self._read():
            if conversation.id == conversation_id:
                return conversation
        return None

    def create(self, title: str | None = None) -> Conversation:
        now = datetime.now(timezone.utc)
        conversation = Conversation(
            id=uuid4().hex,
            title=title.strip() if title and title.strip() else DEFAULT_CONVERSATION_TITLE,
            created_at=now,
            updated_at=now,
            messages=[],
        )
        with self._lock:
            conversations = self._read()
            conversations.append(conversation)
            self._write(conversations)
        return conversation

    def rename(self, conversation_id: str, title: str) -> Conversation | None:
        with self._lock:
            conversations = self._read()
            updated_conversation: Conversation | None = None
            for idx, conversation in enumerate(conversations):
                if conversation.id == conversation_id:
                    conversation.title = title
                    conversation.updated_at = datetime.now(timezone.utc)
                    conversations[idx] = conversation
                    updated_conversation = conversation
                    break
            if updated_conversation is None:
                return None
            self._write(conversations)
            return updated_conversation

    def append_message(self, conversation_id: str, message: ConversationMessage) -> Conversation | None:
        with self._lock:
            conversations = self._read()
            updated_conversation: Conversation | None = None
            for idx, conversation in enumerate(conversations):
                if conversation.id == conversation_id:
                    conversation.messages.append(message)
                    conversation.updated_at = message.created_at
                    if (
                        len(conversation.messages) == 1
                        and conversation.title == DEFAULT_CONVERSATION_TITLE
                    ):
                        conversation.title = _derive_title(message.content)
                    conversations[idx] = conversation
                    updated_conversation = conversation
                    break
            if updated_conversation is None:
                return None
            self._write(conversations)
            return updated_conversation

    def delete(self, conversation_id: str) -> bool:
        with self._lock:
            conversations = self._read()
            remaining = [item for item in conversations if item.id != conversation_id]
            if len(remaining) == len(conversations):
                return False
            self._write(remaining)
            return True

    def clear(self) -> None:
        with self._lock:
            self._write([])

    # Response helpers -------------------------------------------------
    def detail_response(self, conversation_id: str) -> ConversationDetailResponse | None:
        conversation = self.get(conversation_id)
        if conversation is None:
            return None
        return ConversationDetailResponse(conversation=conversation)

    def list_response(self) -> ConversationListResponse:
        return ConversationListResponse(conversations=self.list())


def new_message(role: str, content: str, created_at: datetime | None = None) -> ConversationMessage:
    return ConversationMessage(
        id=uuid4().hex,
        role=role,  # type: ignore[arg-type]
        content=content,
        created_at=created_at or datetime.now(timezone.utc),
    )
