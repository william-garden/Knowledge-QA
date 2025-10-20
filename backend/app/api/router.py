from fastapi import APIRouter

from app.api import conversations, knowledge, qa, upload

api_router = APIRouter()
api_router.include_router(upload.router, tags=["upload"])
api_router.include_router(knowledge.router, tags=["knowledge"])
api_router.include_router(qa.router, tags=["qa"])
api_router.include_router(conversations.router, tags=["conversations"])
