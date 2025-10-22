from __future__ import annotations

import json
from typing import AsyncGenerator, Iterable

import httpx

from app.schemas.provider import ProviderId, ProviderRuntimeConfig


async def stream_completion(
    provider: ProviderRuntimeConfig,
    messages: Iterable[dict[str, str]],
) -> AsyncGenerator[str, None]:
    if provider.id == ProviderId.GEMINI.value:
        async for chunk in _stream_gemini(provider, messages):
            yield chunk
        return
    if provider.id in {ProviderId.DOU_BAO.value, ProviderId.CHATGPT.value, ProviderId.GROK.value}:
        async for chunk in _stream_openai_compatible(provider, messages):
            yield chunk
        return
    raise ValueError(f"Unsupported provider: {provider.id}")


async def _stream_openai_compatible(
    provider: ProviderRuntimeConfig,
    messages: Iterable[dict[str, str]],
) -> AsyncGenerator[str, None]:
    if not provider.base_url or not provider.api_key or not provider.model:
        raise ValueError("Provider configuration is incomplete for OpenAI compatible streaming.")

    url = f"{provider.base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {provider.api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": provider.model,
        "messages": list(messages),
        "temperature": 0.2,
        "stream": True,
    }

    timeout = httpx.Timeout(120.0, read=120.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line or not line.startswith("data:"):
                    continue
                raw = line[5:].strip()
                if not raw:
                    continue
                if raw == "[DONE]":
                    break
                try:
                    payload = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                choices = payload.get("choices") or []
                if not choices:
                    continue
                delta = choices[0].get("delta") or {}
                content = delta.get("content")
                if content:
                    yield content


async def _stream_gemini(
    provider: ProviderRuntimeConfig,
    messages: Iterable[dict[str, str]],
) -> AsyncGenerator[str, None]:
    if not provider.base_url or not provider.api_key or not provider.model:
        raise ValueError("Provider configuration is incomplete for Gemini streaming.")

    url = f"{provider.base_url.rstrip('/')}/models/{provider.model}:generateContent"
    params = {"key": provider.api_key}
    contents: list[dict[str, object]] = []
    for message in messages:
        role = message.get("role", "user")
        translated_role = "user" if role != "assistant" else "model"
        contents.append(
            {
                "role": translated_role,
                "parts": [{"text": message.get("content", "")}],
            }
        )

    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.2,
            "topP": 0.9,
        },
    }

    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, read=120.0)) as client:
        response = await client.post(url, params=params, json=payload)
        response.raise_for_status()
        data = response.json()

    candidates = data.get("candidates") or []
    for candidate in candidates:
        content = candidate.get("content") or {}
        for part in content.get("parts", []):
            text = part.get("text")
            if text:
                yield text
