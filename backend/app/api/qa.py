from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.core.config import Settings
from app.dependencies import get_app_settings
from app.schemas.qa import QuestionRequest
from app.services.qa import stream_answer

router = APIRouter()


@router.post("/qa")
async def ask_question(
    payload: QuestionRequest,
    settings: Settings = Depends(get_app_settings)
) -> StreamingResponse:
    generator = stream_answer(payload.question, settings, payload.top_k)
    return StreamingResponse(generator, media_type="text/event-stream")
