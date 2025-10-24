from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.core.config import Settings
from app.dependencies import get_conversation_store, get_runtime_settings
from app.schemas.qa import QuestionRequest
from app.schemas.qa import QuestionRequest
from app.services.conversations import ConversationStore, new_message
from app.services.qa import stream_answer

router = APIRouter()


@router.post("/qa")
async def ask_question(
    payload: QuestionRequest,
    settings: Settings = Depends(get_runtime_settings),
    conversation_store: ConversationStore = Depends(get_conversation_store)
) -> StreamingResponse:
    conversation_id = payload.conversation_id
    if conversation_id:
        conversation = conversation_store.get(conversation_id)
        if conversation is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    else:
        conversation = conversation_store.create()
        conversation_id = conversation.id

    conversation_store.append_message(conversation_id, new_message("user", payload.question))

    generator = stream_answer(payload.question, settings, payload.top_k)

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
