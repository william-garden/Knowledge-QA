from __future__ import annotations

import hashlib
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, List

import logging

from fastapi import HTTPException, UploadFile

try:
    import numpy as np  # type: ignore  # noqa: F401
except ImportError:  # pragma: no cover
    np = None  # type: ignore

import aiofiles
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyMuPDFLoader, PyPDFLoader, TextLoader
from langchain_core.documents import Document
from starlette.concurrency import run_in_threadpool

from app.core.config import Settings
from app.schemas.knowledge import KnowledgeDocument
from app.services.metadata import MetadataStore
from app.services.vector_store import get_vector_store

ALLOWED_SUFFIXES = {".pdf", ".txt", ".md"}


async def ingest_uploads(
    files: Iterable[UploadFile],
    settings: Settings,
    metadata_store: MetadataStore
) -> List[KnowledgeDocument]:
    ingested: List[KnowledgeDocument] = []
    for upload in files:
        ingested.append(await _process_single_upload(upload, settings))
    return metadata_store.upsert_many(ingested)


async def _process_single_upload(
    upload: UploadFile,
    settings: Settings
) -> KnowledgeDocument:
    file_path, content_hash, size = await _persist_upload(upload, settings)
    documents = await _load_and_split(file_path, settings)

    if not documents:
        raise HTTPException(
            status_code=400,
            detail=f"No textual content detected in {upload.filename}."
        )

    vector_store = get_vector_store(settings)
    document_id = content_hash

    await run_in_threadpool(vector_store.delete, where={"document_id": document_id})

    texts: list[str] = []
    metadatas: list[dict] = []
    chunk_ids: list[str] = []

    for index, doc in enumerate(documents):
        content = _coerce_to_text(doc.page_content)
        texts.append(content)
        metadatas.append({
            "document_id": document_id,
            "filename": upload.filename or file_path.name,
            "chunk_index": index,
            "source_path": str(file_path)
        })
        chunk_ids.append(f"{document_id}:{index}")

    logger = logging.getLogger("personal-knowledge-base")
    logger.info("Prepared %s chunks for document %s", len(texts), upload.filename)
    if texts:
        sample = texts[0]
        if isinstance(sample, str):
            preview = sample[:64]
        else:
            preview = str(sample)[:64]
        logger.info("First chunk type: %s sample: %s", type(sample).__name__, preview)

        tracked_keywords = ["红细胞", "白细胞", "血红蛋白"]
        for keyword in tracked_keywords:
            matches = [text for text in texts if keyword in text]
            if matches:
                logger.info("Detected keyword '%s' in %s chunk(s). Example: %s", keyword, len(matches), matches[0][:80])
    else:
        logger.warning("No chunks were prepared for document %s", upload.filename)

    await run_in_threadpool(
        vector_store.add_texts,
        texts,
        metadatas=metadatas,
        ids=chunk_ids
    )

    return KnowledgeDocument(
        id=document_id,
        filename=upload.filename or file_path.name,
        size=size,
        chunk_count=len(documents),
        ingested_at=datetime.now(timezone.utc)
    )


async def _persist_upload(upload: UploadFile, settings: Settings) -> tuple[Path, str, int]:
    target_dir = settings.uploads_dir
    target_dir.mkdir(parents=True, exist_ok=True)

    original_name = upload.filename or "uploaded"
    sanitized = _sanitize_filename(original_name)
    target_path = target_dir / sanitized
    if target_path.exists():
        target_path = target_dir / f"{int(time.time())}_{sanitized}"

    hasher = hashlib.sha1()
    size = 0

    async with aiofiles.open(target_path, "wb") as output:
        while True:
            chunk = await upload.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > settings.max_upload_size_mb * 1024 * 1024:
                await upload.close()
                target_path.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=413,
                    detail="File size exceeds configured limit."
                )
            hasher.update(chunk)
            await output.write(chunk)

    await upload.close()
    return target_path, hasher.hexdigest(), size


async def _load_and_split(path: Path, settings: Settings) -> list[Document]:
    suffix = path.suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file extension: {suffix}"
        )

    def _load() -> list[Document]:
        if suffix == ".pdf":
            try:
                loader = PyMuPDFLoader(str(path))
            except Exception:
                loader = PyPDFLoader(str(path))
        else:
            loader = TextLoader(str(path), autodetect_encoding=True)
        docs = loader.load()
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
            separators=["\n\n", "\n", ".", "?", "!", " "]
        )
        return splitter.split_documents(docs)

    return await run_in_threadpool(_load)


def _sanitize_filename(filename: str) -> str:
    name = Path(filename).name
    keep_chars = (" ", ".", "_", "-")
    cleaned = "".join(ch for ch in name if ch.isalnum() or ch in keep_chars)
    return cleaned or "uploaded"


def _coerce_to_text(content: object) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, bytes):
        try:
            return content.decode("utf-8", errors="ignore")
        except Exception:
            return content.decode("utf-8", errors="replace")
    if np is not None and isinstance(content, np.ndarray):
        content = content.tolist()
    if isinstance(content, (list, tuple)):
        chars: list[str] = []
        for item in content:
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
    return str(content)
