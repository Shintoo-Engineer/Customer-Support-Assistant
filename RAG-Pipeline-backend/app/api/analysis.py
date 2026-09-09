"""Analysis API router for Task 4 Intent and Sentiment Analysis.

Exposes REST endpoints for analyzing customer messages and integrating with
the Customer Simulator Agent (Task 3).
"""

from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession

from app.models.database import SessionLocal
from app.schemas.analysis import (
    AnalysisRequest,
    AnalysisResponse,
    TurnAnalysis,
    SessionAnalysisSummary,
    DecisionSupportResult,
)
from app.services.analysis_service import (
    analyze_customer_message,
    get_analysis_history,
    get_session_analysis_summary,
    get_analysis_metrics,
)
from app.services.decision_support_service import (
    get_session_decision_support,
)


router = APIRouter(
    prefix="/analysis",
    tags=["Intent and Sentiment Analysis"]
)


def get_db():
    """Yields an active database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post(
    "/analyze",
    response_model=AnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze Customer Message",
    description="""
Analyzes a customer message to determine intent, emotion, sentiment, frustration level,
satisfaction trend, and escalation risk in the context of an ongoing support/simulator session.

- **Phase 1 Foundation**: Validates session existence, schema contracts, and context access.
- **Subsequent Phases**: Dynamic classification algorithms and LLM intelligence.
""",
    responses={
        200: {
            "description": "Successful analysis response matching the Task 4 schema contract.",
            "model": AnalysisResponse,
        },
        404: {
            "description": "Specified session_id does not exist.",
            "content": {
                "application/json": {
                    "example": {"detail": "Simulator session 999999 not found."}
                }
            },
        },
        422: {
            "description": "Validation error for missing or malformed request parameters."
        },
    }
)
def analyze_message(
    request: AnalysisRequest,
    db: DBSession = Depends(get_db)
):
    """Executes intent and sentiment analysis on a customer message."""
    try:
        response = analyze_customer_message(
            session_id=request.session_id,
            customer_message=request.customer_message,
            db=db
        )
        return response
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get(
    "/{session_id}/history",
    response_model=List[TurnAnalysis],
    status_code=status.HTTP_200_OK,
    summary="Get Session Analysis History",
    description="Retrieves chronological turn-by-turn analysis history for a given simulator session.",
    responses={
        200: {
            "description": "Chronological list of turn analyses.",
        },
        404: {
            "description": "Simulator session not found.",
        },
    }
)
def get_session_history(
    session_id: int,
    db: DBSession = Depends(get_db)
):
    """Retrieves chronological customer-turn analyses for a session."""
    try:
        return get_analysis_history(session_id=session_id, db=db)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get(
    "/{session_id}/summary",
    response_model=SessionAnalysisSummary,
    status_code=status.HTTP_200_OK,
    summary="Get Session Analysis Summary",
    description="Derives aggregated session analysis summary from historical turn records.",
    responses={
        200: {
            "description": "Session analysis summary derived from stored turns.",
        },
        404: {
            "description": "Simulator session not found.",
        },
    }
)
def get_session_summary(
    session_id: int,
    db: DBSession = Depends(get_db)
):
    """Derives aggregated session analysis summary without reclassifying."""
    try:
        return get_session_analysis_summary(session_id=session_id, db=db)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get(
    "/metrics",
    status_code=status.HTTP_200_OK,
    summary="Get Analysis Service Metrics",
    description="Returns lightweight in-memory counters and latency metrics."
)
def get_metrics():
    """Returns lightweight analysis operational metrics."""
    return get_analysis_metrics()


@router.post(
    "/{session_id}/decision-support",
    response_model=DecisionSupportResult,
    status_code=status.HTTP_200_OK,
    summary="Get Downstream Decision Support",
    description="Generates deterministic, explainable decision support recommendations for downstream agents based on analyzed session history.",
    responses={
        200: {
            "description": "Decision support recommendation generated successfully.",
            "model": DecisionSupportResult,
        },
        404: {
            "description": "Simulator session not found.",
        },
    }
)
@router.get(
    "/{session_id}/decision-support",
    response_model=DecisionSupportResult,
    status_code=status.HTTP_200_OK,
    summary="Get Downstream Decision Support (GET)",
    description="Idempotent retrieval of decision support recommendations for downstream agents.",
    responses={
        200: {
            "description": "Decision support recommendation generated successfully.",
            "model": DecisionSupportResult,
        },
        404: {
            "description": "Simulator session not found.",
        },
    }
)
def get_decision_support(
    session_id: int,
    db: DBSession = Depends(get_db)
):
    """Derives deterministic decision support recommendations for the session."""
    try:
        return get_session_decision_support(session_id=session_id, db=db)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

