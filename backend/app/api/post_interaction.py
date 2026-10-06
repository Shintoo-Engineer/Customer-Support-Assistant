
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.post_interaction_service import (
    generate_post_interaction_summary,
)

router = APIRouter(
    prefix="/api",
    tags=["Post-Interaction Summary"],
)


class PostInteractionSummaryRequest(BaseModel):
    conversation_history: list[dict[str, Any]] = Field(
        default_factory=list
    )
    intent: str = "Unknown"
    initial_sentiment: str = "Neutral"
    final_sentiment: str = "Neutral"
    resolution_status: str = "Unknown"
    coaching_result: dict[str, Any] = Field(
        default_factory=dict
    )


@router.post("/post-interaction-summary")
def create_post_interaction_summary(
    request: PostInteractionSummaryRequest,
):
    return generate_post_interaction_summary(
        conversation_history=request.conversation_history,
        intent=request.intent,
        initial_sentiment=request.initial_sentiment,
        final_sentiment=request.final_sentiment,
        resolution_status=request.resolution_status,
        coaching_result=request.coaching_result,
    )
