"""Pydantic schemas for Task 5 Knowledge Recommendation Agent.

Defines typed contracts for knowledge recommendations returned by the
Knowledge Recommendation service, following existing project conventions
established in app/schemas/analysis.py.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class KnowledgeRecommendation(BaseModel):
    """A single knowledge recommendation retrieved from the RAG knowledge base.

    Each recommendation includes the document title, content excerpt,
    source reference, document type, and relevance score.
    """
    title: str = Field(
        ...,
        min_length=1,
        description="Title or name of the retrieved knowledge document."
    )
    content: str = Field(
        ...,
        min_length=1,
        description="Content excerpt from the retrieved document chunk."
    )
    source: str = Field(
        ...,
        min_length=1,
        description=(
            "Source reference for the document (e.g., document name, "
            "chunk ID, or filename)."
        )
    )
    document_type: str = Field(
        ...,
        min_length=1,
        description=(
            "Type/category of the knowledge document as stored in the "
            "knowledge base metadata (e.g., 'faq', 'policy')."
        )
    )
    relevance_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Relevance score between 0.0 and 1.0 (higher is more relevant)."
    )


class KnowledgeRecommendationRequest(BaseModel):
    """Incoming request payload for knowledge recommendations.

    Supports standalone queries (Phase 1) as well as context-aware requests
    with session references, dialogue history, and Task 4 analysis signals (Phase 2).
    """
    query: str = Field(
        ...,
        min_length=1,
        description="The customer query/message to retrieve relevant knowledge for.",
        examples=["My payment failed"]
    )
    session_id: Optional[int] = Field(
        default=None,
        gt=0,
        description="Optional simulator or support session ID referencing an existing session.",
        examples=[1]
    )
    conversation_id: Optional[int] = Field(
        default=None,
        gt=0,
        description="Optional conversation ID."
    )
    conversation_history: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description=(
            "Optional list of previous dialogue turns "
            "[{'sender_type': 'Customer'|'Support Agent', 'message_text': '...'}]."
        )
    )
    analysis: Optional[Any] = Field(
        default=None,
        description="Optional Task 4 analysis output (AnalysisResult, AnalysisResponse, or dict)."
    )

    @field_validator("query")
    @classmethod
    def validate_query_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("query cannot be empty or whitespace only.")
        return v


class KnowledgeRecommendationResult(BaseModel):
    """Response contract for knowledge recommendation queries.

    Contains the original query, ranked recommendations (up to 5),
    a flag indicating whether no relevant information was found,
    and optional contextual metadata for observability.
    """
    query: str = Field(
        ...,
        description="The original customer query."
    )
    recommendations: List[KnowledgeRecommendation] = Field(
        default_factory=list,
        description="Ranked list of knowledge recommendations (max 5)."
    )
    no_relevant_information: bool = Field(
        default=False,
        description=(
            "True when no sufficiently relevant knowledge was found "
            "for the query."
        )
    )
    contextual_query: Optional[str] = Field(
        default=None,
        description="The synthesized contextual query used for vector retrieval."
    )
    session_id: Optional[int] = Field(
        default=None,
        description="Session ID if provided or resolved."
    )
