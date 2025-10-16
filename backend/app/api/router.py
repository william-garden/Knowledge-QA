from fastapi import APIRouter

from app.api import upload, qa, knowledge

api_router = APIRouter()
api_router.include_router(upload.router, tags=["upload"])
api_router.include_router(knowledge.router, tags=["knowledge"])
api_router.include_router(qa.router, tags=["qa"])
