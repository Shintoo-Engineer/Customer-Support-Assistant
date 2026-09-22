"""Pydantic schemas and enums for Task 4 Intent and Sentiment Analysis."""

from datetime import datetime, timezone
from enum import Enum
from pydantic import BaseModel, Field, field_validator


class CustomerIntent(str, Enum):
    """Supported customer intent categories per Task 4 specification."""
    REFUND = "refund"
    CANCELLATION = "cancellation"
    DELIVERY_ISSUE = "delivery_issue"
    PAYMENT_ISSUE = "payment_issue"
    ACCOUNT_ISSUE = "account_issue"
    COMPLAINT = "complaint"
    RETURN_EXCHANGE = "return_exchange"
    GENERAL_INQUIRY = "general_inquiry"


class CustomerEmotion(str, Enum):
    """Supported customer emotion classifications per Task 4 specification."""
    HAPPY = "happy"
    NEUTRAL = "neutral"
    CONFUSED = "confused"
    WORRIED = "worried"
    FRUSTRATED = "frustrated"
    ANGRY = "angry"
    SATISFIED = "satisfied"


class CustomerSentiment(str, Enum):
    """Supported customer sentiment categories per Task 4 specification."""
    POSITIVE = "positive"
    NEUTRAL = "neutral"
    NEGATIVE = "negative"


class SatisfactionTrend(str, Enum):
    """Supported satisfaction progression trends across conversation turns."""
    IMPROVING = "improving"
    DECLINING = "declining"
    STABLE = "stable"


class EscalationRisk(str, Enum):
    """Supported escalation risk levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class AnalysisRequest(BaseModel):
    """Incoming request payload for analyzing customer messages."""
    session_id: int = Field(
        ...,
        gt=0,
        description="Simulator or support session ID referencing an existing session.",
        examples=[1]
    )
    customer_message: str = Field(
        ...,
        min_length=1,
        description="The customer message text to analyze.",
        examples=["I have been waiting for my refund for 10 days!"]
    )

    @field_validator("customer_message")
    @classmethod
    def validate_message_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("customer_message cannot be empty or whitespace only.")
        return v


class AnalysisResponse(BaseModel):
    """Structured response schema returned by Intent and Sentiment Analysis Agent.

    Strictly typed with Enums and numerical boundary constraints.
    """
    intent: CustomerIntent = Field(
        ...,
        description="Classified customer intent."
    )
    emotion: CustomerEmotion = Field(
        ...,
        description="Classified emotional state of the customer."
    )
    sentiment: CustomerSentiment = Field(
        ...,
        description="Overall sentiment polarity."
    )
    frustration_level: int = Field(
        ...,
        ge=0,
        le=10,
        description="Frustration level scored on an integer scale from 0 to 10."
    )
    satisfaction_trend: SatisfactionTrend = Field(
        ...,
        description="Directional trend of customer satisfaction across turns."
    )
    escalation_risk: EscalationRisk = Field(
        ...,
        description="Assessed risk of supervisor escalation or dispute."
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score of the classification model between 0.0 and 1.0."
    )


class AnalysisResult(AnalysisResponse):
    """Canonical internal analysis contract for downstream agents and internal services.

    Strictly typed, validated, serializable, and independent of FastAPI HTTP routing,
    Gemini client internals, or database storage mechanics.
    """
    session_id: int | None = Field(
        default=None,
        description="Simulator or support session ID referencing the session."
    )
    conversation_id: int | None = Field(
        default=None,
        description="Associated conversation record ID."
    )
    message_id: int | None = Field(
        default=None,
        description="ID of the customer message that was analyzed."
    )
    turn_number: int | None = Field(
        default=None,
        ge=1,
        description="Dialogue turn number associated with this analysis."
    )
    analysis_source: str = Field(
        default="fallback",
        description="Source of analysis: 'gemini' or 'fallback'."
    )
    analysis_timestamp: str | None = Field(
        default=None,
        description="Timestamp when the analysis was produced (UTC ISO string)."
    )

    def to_response(self) -> AnalysisResponse:
        """Converts the internal canonical model into the clean public AnalysisResponse contract."""
        return AnalysisResponse(
            intent=self.intent,
            emotion=self.emotion,
            sentiment=self.sentiment,
            frustration_level=self.frustration_level,
            satisfaction_trend=self.satisfaction_trend,
            escalation_risk=self.escalation_risk,
            confidence=self.confidence
        )


class TurnAnalysis(BaseModel):
    """Historical snapshot of an individual customer turn's analysis."""
    turn: int = Field(
        ...,
        ge=1,
        description="Customer turn number."
    )
    intent: CustomerIntent = Field(
        ...,
        description="Classified intent for this turn."
    )
    emotion: CustomerEmotion = Field(
        ...,
        description="Classified emotion for this turn."
    )
    sentiment: CustomerSentiment = Field(
        ...,
        description="Classified sentiment for this turn."
    )
    frustration_level: int = Field(
        ...,
        ge=0,
        le=10,
        description="Frustration level scored on an integer scale from 0 to 10."
    )
    satisfaction_trend: SatisfactionTrend = Field(
        ...,
        description="Directional satisfaction trend for this turn."
    )
    escalation_risk: EscalationRisk = Field(
        ...,
        description="Assessed supervisor escalation risk."
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score of classification."
    )
    analysis_source: str | None = Field(
        default="fallback",
        description="Source of classification: 'gemini' or 'fallback'."
    )
    timestamp: str | None = Field(
        default=None,
        description="Timestamp of the turn analysis in ISO format."
    )


class SessionAnalysisSummary(BaseModel):
    """Aggregated session-level analysis summary derived from stored turn analyses."""
    session_id: int = Field(
        ...,
        gt=0,
        description="Simulator or support session identifier."
    )
    dominant_intent: CustomerIntent = Field(
        ...,
        description="Most frequent intent across conversation turns."
    )
    latest_emotion: CustomerEmotion = Field(
        ...,
        description="Latest customer emotion state."
    )
    latest_sentiment: CustomerSentiment = Field(
        ...,
        description="Latest customer sentiment state."
    )
    current_frustration: int = Field(
        ...,
        ge=0,
        le=10,
        description="Latest customer frustration level [0, 10]."
    )
    current_escalation_risk: EscalationRisk = Field(
        ...,
        description="Latest customer escalation risk level."
    )
    overall_satisfaction_direction: SatisfactionTrend = Field(
        ...,
        description="Overall satisfaction progression direction across the session."
    )
    average_confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Mean classification confidence across all analyzed customer turns."
    )
    turn_count: int = Field(
        ...,
        ge=0,
        description="Total number of analyzed customer turns in the session."
    )


# ---------------------------------------------------------------------------
# Phase 6: Downstream Decision Support Schemas & Enums
# ---------------------------------------------------------------------------

class DecisionPriority(str, Enum):
    """Priority level for customer interaction response and intervention."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RecommendedTone(str, Enum):
    """Recommended agent tone tailored to the customer's emotional state."""
    EMPATHETIC = "empathetic"
    REASSURING = "reassuring"
    CLARIFYING = "clarifying"
    APOLOGETIC = "apologetic"
    PROFESSIONAL = "professional"
    CALM = "calm"
    FIRM = "firm"


class RecommendedAction(str, Enum):
    """Recommended operational action for the support workflow."""
    RESOLVE = "resolve"
    CLARIFY = "clarify"
    APOLOGIZE_AND_RESOLVE = "apologize_and_resolve"
    PROVIDE_STATUS = "provide_status"
    PROVIDE_INSTRUCTIONS = "provide_instructions"
    OFFER_OPTIONS = "offer_options"
    ESCALATE = "escalate"


class CustomerNeed(str, Enum):
    """Categorized customer need derived from classified customer intent."""
    REFUND_REQUEST = "refund_request"
    CANCELLATION_REQUEST = "cancellation_request"
    DELIVERY_RESOLUTION = "delivery_resolution"
    PAYMENT_RESOLUTION = "payment_resolution"
    ACCOUNT_ASSISTANCE = "account_assistance"
    COMPLAINT_RESOLUTION = "complaint_resolution"
    RETURN_OR_EXCHANGE = "return_or_exchange"
    INFORMATION_REQUEST = "information_request"


class DecisionSupportResult(BaseModel):
    """Deterministic, agent-ready decision support recommendations.

    Derived exclusively from existing AnalysisResult signals and conversation history.
    """
    priority: DecisionPriority = Field(
        ...,
        description="Action priority: low, medium, high, or critical."
    )
    recommended_tone: RecommendedTone = Field(
        ...,
        description="Recommended tone for responding to the customer."
    )
    recommended_action: RecommendedAction = Field(
        ...,
        description="Recommended operational action to take."
    )
    escalation_recommended: bool = Field(
        ...,
        description="Flag indicating if immediate supervisor escalation is recommended."
    )
    risk_flags: list[str] = Field(
        default_factory=list,
        description="List of detected risk flags."
    )
    customer_needs: list[CustomerNeed] = Field(
        default_factory=list,
        description="Primary customer needs mapped from intent."
    )
    rationale: str = Field(
        ...,
        description="Deterministic, explainable rationale for recommendations."
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score inherited directly from the analysis result."
    )
    session_id: int | None = Field(
        default=None,
        description="Optional simulator or support session ID."
    )
    turn_number: int | None = Field(
        default=None,
        description="Optional dialogue turn number."
    )

