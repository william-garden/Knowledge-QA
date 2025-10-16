from fastapi import APIRouter, Depends

from app.dependencies import get_metadata_store
from app.schemas.knowledge import KnowledgeListResponse
from app.services.metadata import MetadataStore

router = APIRouter()


@router.get("/knowledge-base", response_model=KnowledgeListResponse)
async def knowledge_base(metadata_store: MetadataStore = Depends(get_metadata_store)) -> KnowledgeListResponse:
    documents = metadata_store.list()
    return KnowledgeListResponse(documents=documents)
