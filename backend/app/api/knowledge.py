from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.core.config import Settings
from app.dependencies import get_metadata_store, get_runtime_settings
from app.schemas.knowledge import KnowledgeChunksResponse, KnowledgeListResponse
from app.services.metadata import MetadataStore
from app.services.vector_store import get_vector_store

router = APIRouter()


@router.get("/knowledge-base", response_model=KnowledgeListResponse)
async def knowledge_base(metadata_store: MetadataStore = Depends(get_metadata_store)) -> KnowledgeListResponse:
    documents = metadata_store.list()
    return KnowledgeListResponse(documents=documents)


@router.get("/knowledge-base/{document_id}/chunks", response_model=KnowledgeChunksResponse)
async def knowledge_chunks(
    document_id: str,
    metadata_store: MetadataStore = Depends(get_metadata_store),
    settings: Settings = Depends(get_runtime_settings)
) -> KnowledgeChunksResponse:
    documents = metadata_store.list()
    if not any(doc.id == document_id for doc in documents):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    vector_store = get_vector_store(settings)
    collection = getattr(vector_store, "_collection", None)
    if collection is None:
        return KnowledgeChunksResponse(chunks=[])

    raw = collection.get(where={"document_id": document_id}, include=["documents"])
    raw_documents = raw.get("documents") if isinstance(raw, dict) else None
    chunks: list[str] = []
    if raw_documents:
        for item in raw_documents:
            if isinstance(item, str):
                chunks.append(item)
            elif isinstance(item, list):
                chunks.extend(str(part) for part in item)

    return KnowledgeChunksResponse(chunks=chunks)


@router.delete("/knowledge-base/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    metadata_store: MetadataStore = Depends(get_metadata_store),
    settings: Settings = Depends(get_runtime_settings)
) -> Response:
    document = metadata_store.remove(document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    vector_store = get_vector_store(settings)
    vector_store.delete(where={"document_id": document_id})

    if document.source_path:
        Path(document.source_path).unlink(missing_ok=True)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/knowledge-base", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all_documents(
    metadata_store: MetadataStore = Depends(get_metadata_store),
    settings: Settings = Depends(get_runtime_settings)
) -> Response:
    documents = metadata_store.list()
    if not documents:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    metadata_store.clear()
    vector_store = get_vector_store(settings)
    for document in documents:
        vector_store.delete(where={"document_id": document.id})
        if document.source_path:
            Path(document.source_path).unlink(missing_ok=True)

    return Response(status_code=status.HTTP_204_NO_CONTENT)
