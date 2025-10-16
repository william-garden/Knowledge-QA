from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.core.config import Settings
from app.dependencies import get_app_settings, get_metadata_store
from app.schemas.knowledge import UploadResponse
from app.services.ingest import ingest_uploads
from app.services.metadata import MetadataStore

router = APIRouter()


@router.post("/upload", response_model=UploadResponse)
async def upload_files(
    files: List[UploadFile] = File(...),
    settings: Settings = Depends(get_app_settings),
    metadata_store: MetadataStore = Depends(get_metadata_store)
) -> UploadResponse:
    if not files:
        raise HTTPException(status_code=400, detail="Please upload at least one file.")
    documents = await ingest_uploads(files, settings, metadata_store)
    return UploadResponse(documents=documents)
