from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.core.config import Settings
from app.dependencies import get_app_settings, get_conversation_store
from app.schemas.conversation import Conversation
from app.schemas.provider import ConversationProvider
from app.schemas.qa import QuestionRequest
from app.services.conversations import ConversationStore, new_message
from app.services.qa import stream_answer

router = APIRouter()


@router.post("/qa")
async def ask_question(
    payload: QuestionRequest,
    settings: Settings = Depends(get_app_settings),
    conversation_store: ConversationStore = Depends(get_conversation_store)
) -> StreamingResponse:
    provider_config = payload.provider
    defaults = settings.provider_defaults(provider_config.id)
    resolved_provider = provider_config.model_copy(
        update={
            "api_key": provider_config.api_key or defaults.get("api_key"),
            "base_url": provider_config.base_url or defaults.get("base_url"),
            "model": provider_config.model or defaults.get("model"),
        }
    )
    if not resolved_provider.api_key:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provider API key is required.")
    if not resolved_provider.base_url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provider base URL is not configured.")
    if not resolved_provider.model:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provider model is not configured.")

    conversation_id = payload.conversation_id
    conversation: Conversation | None
    if conversation_id:
        conversation = conversation_store.get(conversation_id)
        if conversation is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
        if conversation.provider.id != resolved_provider.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Conversation provider differs from the requested provider."
            )
    else:
        conversation_meta = ConversationProvider(
            id=resolved_provider.id,
            name=provider_config.label or resolved_provider.id.title(),
            model=resolved_provider.model,
        )
        conversation = conversation_store.create(provider=conversation_meta)
        conversation_id = conversation.id

    conversation_store.append_message(conversation_id, new_message("user", payload.question))

    generator = stream_answer(payload.question, settings, resolved_provider, payload.top_k)

    async def event_stream():
        collected: list[str] = []
        async for chunk in generator:
            yield chunk
            if chunk.startswith("data:"):
                payload_text = chunk[5:]
                if payload_text.startswith(" "):
                    payload_text = payload_text[1:]
                if payload_text.endswith("\n\n"):
                    body = payload_text[:-2]
                else:
                    body = payload_text
                if body == "[DONE]":
                    break
                collected.append(body)

        final_text = "".join(collected).strip()
        if final_text:
            conversation_store.append_message(conversation_id, new_message("assistant", final_text))

    headers = {"X-Conversation-Id": conversation_id}
    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=headers)
