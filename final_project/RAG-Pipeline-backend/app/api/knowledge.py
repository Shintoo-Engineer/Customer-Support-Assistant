"""Knowledge Recommendation API router for Task 5.

Exposes REST endpoints for retrieving knowledge recommendations
from the existing RAG knowledge base.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession

from app.models.database import SessionLocal
from app.schemas.knowledge import (
    KnowledgeRecommendationRequest,
    KnowledgeRecommendationResult,
)
from app.services.knowledge_recommendation_service import (
    get_knowledge_recommendations,
)

logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/knowledge",
    tags=["Knowledge Recommendation"]
)


def get_db():
    """Yields an active database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post(
    "/recommend",
    response_model=KnowledgeRecommendationResult,
    status_code=status.HTTP_200_OK,
    summary="Get Knowledge Recommendations",
    description=(
        "Retrieves ranked knowledge recommendations (support articles, FAQs, "
        "troubleshooting steps, policies) from the RAG knowledge base for a "
        "given customer query. Supports standalone queries (Phase 1) and context-aware "
        "retrieval with session dialogue history and Task 4 intent signals (Phase 2). "
        "Returns up to 5 recommendations sorted by relevance, or an empty list with a "
        "no-result indicator when no relevant knowledge is found."
    ),
    responses={
        200: {
            "description": "Knowledge recommendations retrieved successfully.",
            "model": KnowledgeRecommendationResult,
        },
        400: {
            "description": "Invalid or empty query.",
            "content": {
                "application/json": {
                    "example": {"detail": "Query cannot be empty or whitespace only."}
                }
            },
        },
        404: {
            "description": "Specified session_id not found.",
            "content": {
                "application/json": {
                    "example": {"detail": "Simulator session 999999 not found."}
                }
            },
        },
        500: {
            "description": "Knowledge retrieval failed due to an internal error.",
            "content": {
                "application/json": {
                    "example": {"detail": "Knowledge retrieval failed."}
                }
            },
        },
    },
)
def recommend_knowledge(
    request: KnowledgeRecommendationRequest,
    db: DBSession = Depends(get_db),
) -> KnowledgeRecommendationResult:
    """Retrieves knowledge recommendations for a customer query."""
    try:
        result = get_knowledge_recommendations(
            query=request.query,
            session_id=request.session_id,
            conversation_id=request.conversation_id,
            conversation_history=request.conversation_history,
            analysis=request.analysis,
            db=db,
        )
        return result

    except ValueError as e:
        logger.warning("knowledge_recommend: validation error: %s", e)
        if "not found" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e),
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    except RuntimeError as e:
        logger.error("knowledge_recommend: retrieval failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Knowledge retrieval failed.",
        )

    except Exception as e:
        logger.error(
            "knowledge_recommend: unexpected error: %s",
            e,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Knowledge retrieval failed.",
        )
