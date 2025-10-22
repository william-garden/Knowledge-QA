from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.dependencies import get_conversation_store
from app.schemas.conversation import (
    ConversationCreateRequest,
    ConversationDetailResponse,
    ConversationListResponse,
    ConversationRenameRequest,
)
from app.services.conversations import ConversationStore

router = APIRouter()


@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(store: ConversationStore = Depends(get_conversation_store)) -> ConversationListResponse:
    return store.list_response()


@router.post("/conversations", response_model=ConversationDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    payload: ConversationCreateRequest,
    store: ConversationStore = Depends(get_conversation_store)
) -> ConversationDetailResponse:
    conversation = store.create(provider=payload.provider, title=payload.title)
    return ConversationDetailResponse(conversation=conversation)


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationDetailResponse,
)
async def get_conversation(
    conversation_id: str,
    store: ConversationStore = Depends(get_conversation_store)
) -> ConversationDetailResponse:
    conversation = store.detail_response(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return conversation


@router.patch(
    "/conversations/{conversation_id}",
    response_model=ConversationDetailResponse,
)
async def rename_conversation(
    conversation_id: str,
    payload: ConversationRenameRequest,
    store: ConversationStore = Depends(get_conversation_store)
) -> ConversationDetailResponse:
    conversation = store.rename(conversation_id, payload.title)
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return ConversationDetailResponse(conversation=conversation)


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: str,
    store: ConversationStore = Depends(get_conversation_store)
) -> Response:
    deleted = store.delete(conversation_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/conversations", status_code=status.HTTP_204_NO_CONTENT)
async def clear_conversations(store: ConversationStore = Depends(get_conversation_store)) -> Response:
    store.clear()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
