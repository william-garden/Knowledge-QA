from __future__ import annotations

import logging
import re
from typing import AsyncGenerator, Iterable

import httpx
from fastapi import HTTPException
from langchain_core.messages import BaseMessage
from langchain_core.prompts import ChatPromptTemplate
from starlette.concurrency import run_in_threadpool

from app.core.config import Settings
from app.schemas.provider import ProviderRuntimeConfig
from app.services.providers import stream_completion
from app.services.vector_store import get_vector_store

_HEADING_PATTERN = re.compile(r'^(?P<hashes>(?:#\s*){1,6})\s*(?P<title>\S.*)?$')


def _normalize_heading_line(line: str) -> tuple[bool, str]:
    """Ensure headings have a space after # and return whether the line is a heading."""
    stripped = line.lstrip()
    leading = line[: len(line) - len(stripped)]
    match = _HEADING_PATTERN.match(stripped)
    if not match:
        return False, line
    raw_hashes = match.group("hashes")
    hashes = raw_hashes.replace(" ", "")
    if len(hashes) > 6:
        hashes = hashes[:6]
    title = match.group("title")
    formatted = f"{leading}{hashes}"
    if title:
        formatted = f"{formatted} {title.strip()}"
    return True, formatted


def _drain_markdown_buffer(buffer: str) -> tuple[str, str]:
    if not buffer:
        return "", ""

    last_newline = buffer.rfind("\n")
    if last_newline == -1:
        _, pending = _normalize_heading_line(buffer)
        return "", pending

    consume = buffer[: last_newline + 1]
    remainder = buffer[last_newline + 1 :]
    parts: list[str] = []

    for segment in consume.splitlines(keepends=True):
        if segment.endswith("\n"):
            line = segment[:-1]
            has_heading, formatted = _normalize_heading_line(line)
            if has_heading:
                parts.append(formatted + "\n\n")
            else:
                parts.append(line + "\n")
        else:
            line = segment
            has_heading, formatted = _normalize_heading_line(line)
            parts.append(formatted if has_heading else line)

    _, pending = _normalize_heading_line(remainder)
    return "".join(parts), pending


RESPONSE_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            (
                "You are a careful retrieval-augmented assistant. Always answer in Simplified Chinese. "
                "Prioritise the provided knowledge snippets. If the snippets do not contain enough information, "
                "supplement the answer with well-established medical knowledge and clearly label that portion as "
                '"通用医学说明". Do not fabricate data.'
            ),
        ),
        (
            "user",
            (
                "Question: {question}\n\n"
                "Context:\n{context}\n\n"
                "Instructions:\n"
                "1. 先引用知识库中的要点作答，并在句末加上【来自知识库】。\n"
                "2. 若问题仍未解答完整，可追加一段以“通用医学说明：”开头的补充解释。\n"
                "3. 如果既没有知识库内容也没有可靠常识，请坦诚说明无法回答，并建议咨询专业人士。\n"
                "4. 输出使用 Markdown，并确保所有标题在 # 号后紧跟一个空格，例如 “## 标题”。\n"
            ),
        ),
    ]
)


async def stream_answer(
    question: str,
    settings: Settings,
    provider: ProviderRuntimeConfig,
    top_k: int | None = None
) -> AsyncGenerator[str, None]:
    vector_store = get_vector_store(settings)
    limit = top_k or settings.top_k
    fetch_limit = max(limit * 2, limit + 4)
    documents = await run_in_threadpool(
        vector_store.max_marginal_relevance_search,
        question,
        k=limit,
        fetch_k=fetch_limit
    )

    if not documents:
        documents = await run_in_threadpool(vector_store.similarity_search, question, k=limit)

    logger = logging.getLogger("personal-knowledge-base")
    logger.info(
        "Retrieved %s documents (k=%s, fetch_k=%s) for question: %s",
        len(documents),
        limit,
        fetch_limit,
        question,
    )
    for index, document in enumerate(documents[:3]):
        preview = (
            document.page_content[:80]
            if isinstance(document.page_content, str)
            else str(document.page_content)[:80]
        )
        logger.info("Document %s preview: %s", index + 1, preview)

    if not documents:
        yield "data: Sorry, the knowledge base does not contain relevant information for this question.\n\n"
        yield "data: [DONE]\n\n"
        return

    context = "\n\n".join(
        f"[Snippet {index + 1}]\n{doc.page_content}"
        for index, doc in enumerate(documents)
    )

    prompt_messages = RESPONSE_PROMPT.format_messages(question=question, context=context)
    openai_messages = _as_openai_messages(prompt_messages)

    buffer = ""
    try:
        async for chunk in stream_completion(provider, openai_messages):
            if not chunk:
                continue
            buffer += chunk
            normalized_output, buffer = _drain_markdown_buffer(buffer)
            if normalized_output:
                yield f"data: {normalized_output}\n\n"
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text
        raise HTTPException(
            status_code=exc.response.status_code,
            detail=f"Provider request failed: {detail}"
        ) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if buffer:
        has_heading, formatted = _normalize_heading_line(buffer)
        if has_heading:
            yield f"data: {formatted}\n\n"
        else:
            yield f"data: {buffer}\n\n"

    yield "data: [DONE]\n\n"


def _as_openai_messages(messages: Iterable[BaseMessage]) -> list[dict[str, str]]:
    converted: list[dict[str, str]] = []
    for message in messages:
        role = _map_role(getattr(message, "type", "user"))
        content = _extract_content(message.content)
        converted.append({"role": role, "content": content})
    return converted


def _map_role(message_type: str) -> str:
    if message_type == "system":
        return "system"
    if message_type in {"ai", "assistant"}:
        return "assistant"
    return "user"


def _extract_content(content: object) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                text = item.get("text") or item.get("content")
                if text:
                    parts.append(str(text))
            else:
                parts.append(str(item))
        return "\n".join(parts)
    return str(content)
