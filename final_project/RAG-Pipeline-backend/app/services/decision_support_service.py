"""Decision Support Service for Task 4 Phase 6.

Provides a deterministic, agent-ready recommendation and decision support layer
derived strictly from existing AnalysisResult signals and historical turn progression.
Does not introduce a secondary classifier, LLM calls, or non-deterministic mechanisms.
"""

import logging
from typing import List, Optional, Any
from sqlalchemy.orm import Session as DBSession

from app.schemas.analysis import (
    CustomerIntent,
    CustomerEmotion,
    CustomerSentiment,
    SatisfactionTrend,
    EscalationRisk,
    AnalysisResult,
    AnalysisResponse,
    TurnAnalysis,
    DecisionPriority,
    RecommendedTone,
    RecommendedAction,
    CustomerNeed,
    DecisionSupportResult,
)
from app.services.analysis_service import get_analysis_history

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 1. Customer Need Mapping
# ---------------------------------------------------------------------------

INTENT_TO_CUSTOMER_NEEDS = {
    CustomerIntent.REFUND: [CustomerNeed.REFUND_REQUEST],
    CustomerIntent.CANCELLATION: [CustomerNeed.CANCELLATION_REQUEST],
    CustomerIntent.DELIVERY_ISSUE: [CustomerNeed.DELIVERY_RESOLUTION],
    CustomerIntent.PAYMENT_ISSUE: [CustomerNeed.PAYMENT_RESOLUTION],
    CustomerIntent.ACCOUNT_ISSUE: [CustomerNeed.ACCOUNT_ASSISTANCE],
    CustomerIntent.COMPLAINT: [CustomerNeed.COMPLAINT_RESOLUTION],
    CustomerIntent.RETURN_EXCHANGE: [CustomerNeed.RETURN_OR_EXCHANGE],
    CustomerIntent.GENERAL_INQUIRY: [CustomerNeed.INFORMATION_REQUEST],
}


def map_customer_needs(intent: CustomerIntent) -> List[CustomerNeed]:
    """Deterministically maps customer intent to structured customer needs."""
    return INTENT_TO_CUSTOMER_NEEDS.get(intent, [CustomerNeed.INFORMATION_REQUEST])


# ---------------------------------------------------------------------------
# 2. Priority Determination
# ---------------------------------------------------------------------------

def determine_priority(
    analysis: Any,
    history: Optional[List[TurnAnalysis]] = None
) -> DecisionPriority:
    """Calculates action priority deterministically from emotional and risk signals.

    Rules:
    - CRITICAL: High escalation risk combined with severe frustration (>= 8).
    - HIGH: High escalation risk, severe frustration (>= 8), angry emotion, or repeated negative sentiment.
    - MEDIUM: Moderate frustration (5-7), negative sentiment, medium escalation risk, or worried/frustrated emotion.
    - LOW: Mild/no frustration (<= 4), low escalation risk, and positive/neutral sentiment.
    """
    frustration = getattr(analysis, "frustration_level", 0)
    risk = getattr(analysis, "escalation_risk", EscalationRisk.LOW)
    emotion = getattr(analysis, "emotion", CustomerEmotion.NEUTRAL)
    sentiment = getattr(analysis, "sentiment", CustomerSentiment.NEUTRAL)

    # Critical check
    if risk == EscalationRisk.HIGH and frustration >= 8:
        return DecisionPriority.CRITICAL

    # High check
    repeated_negative = False
    if history:
        neg_count = sum(1 for h in history if h.sentiment == CustomerSentiment.NEGATIVE)
        if neg_count >= 2:
            repeated_negative = True

    if (
        risk == EscalationRisk.HIGH
        or frustration >= 8
        or emotion == CustomerEmotion.ANGRY
        or repeated_negative
    ):
        return DecisionPriority.HIGH

    # Medium check
    if (
        (5 <= frustration <= 7)
        or emotion in (CustomerEmotion.FRUSTRATED, CustomerEmotion.WORRIED)
        or sentiment == CustomerSentiment.NEGATIVE
        or risk == EscalationRisk.MEDIUM
    ):
        return DecisionPriority.MEDIUM

    return DecisionPriority.LOW


# ---------------------------------------------------------------------------
# 3. Recommended Tone Determination
# ---------------------------------------------------------------------------

def determine_recommended_tone(analysis: Any) -> RecommendedTone:
    """Recommends agent tone tailored to the customer's emotional and frustration state.

    Rules:
    - Severe frustration (>= 8) with complaint intent: APOLOGETIC.
    - Severe frustration (>= 8): CALM.
    - High escalation risk or angry/frustrated emotion: EMPATHETIC.
    - Worried emotion: REASSURING.
    - Confused emotion: CLARIFYING.
    - Happy or satisfied emotion: PROFESSIONAL.
    - Neutral / default: PROFESSIONAL.
    """
    frustration = getattr(analysis, "frustration_level", 0)
    intent = getattr(analysis, "intent", CustomerIntent.GENERAL_INQUIRY)
    emotion = getattr(analysis, "emotion", CustomerEmotion.NEUTRAL)
    risk = getattr(analysis, "escalation_risk", EscalationRisk.LOW)

    if frustration >= 8 and intent == CustomerIntent.COMPLAINT:
        return RecommendedTone.APOLOGETIC
    elif frustration >= 8:
        return RecommendedTone.CALM
    elif risk == EscalationRisk.HIGH or emotion in (CustomerEmotion.ANGRY, CustomerEmotion.FRUSTRATED):
        return RecommendedTone.EMPATHETIC
    elif emotion == CustomerEmotion.WORRIED:
        return RecommendedTone.REASSURING
    elif emotion == CustomerEmotion.CONFUSED:
        return RecommendedTone.CLARIFYING
    elif emotion in (CustomerEmotion.HAPPY, CustomerEmotion.SATISFIED):
        return RecommendedTone.PROFESSIONAL
    else:
        return RecommendedTone.PROFESSIONAL


# ---------------------------------------------------------------------------
# 4. Recommended Action Determination
# ---------------------------------------------------------------------------

def determine_recommended_action(analysis: Any) -> RecommendedAction:
    """Recommends operational action based on escalation risk and intent category.

    Rules:
    - High escalation risk or extreme frustration (>= 9): ESCALATE.
    - Complaint intent: APOLOGIZE_AND_RESOLVE.
    - Delivery issue: PROVIDE_STATUS.
    - Payment issue: PROVIDE_INSTRUCTIONS.
    - Account issue: CLARIFY.
    - Return or exchange: OFFER_OPTIONS.
    - Refund request: RESOLVE.
    - General inquiry: PROVIDE_INSTRUCTIONS.
    """
    risk = getattr(analysis, "escalation_risk", EscalationRisk.LOW)
    frustration = getattr(analysis, "frustration_level", 0)
    intent = getattr(analysis, "intent", CustomerIntent.GENERAL_INQUIRY)

    if risk == EscalationRisk.HIGH or frustration >= 9:
        return RecommendedAction.ESCALATE
    elif intent == CustomerIntent.COMPLAINT:
        return RecommendedAction.APOLOGIZE_AND_RESOLVE
    elif intent == CustomerIntent.DELIVERY_ISSUE:
        return RecommendedAction.PROVIDE_STATUS
    elif intent == CustomerIntent.PAYMENT_ISSUE:
        return RecommendedAction.PROVIDE_INSTRUCTIONS
    elif intent == CustomerIntent.ACCOUNT_ISSUE:
        return RecommendedAction.CLARIFY
    elif intent == CustomerIntent.RETURN_EXCHANGE:
        return RecommendedAction.OFFER_OPTIONS
    elif intent == CustomerIntent.REFUND:
        return RecommendedAction.RESOLVE
    else:
        return RecommendedAction.PROVIDE_INSTRUCTIONS


# ---------------------------------------------------------------------------
# 5. Risk Flag Collection
# ---------------------------------------------------------------------------

def collect_risk_flags(
    analysis: Any,
    history: Optional[List[TurnAnalysis]] = None
) -> List[str]:
    """Extracts deterministic, deduplicated operational risk flags."""
    flags: List[str] = []

    frustration = getattr(analysis, "frustration_level", 0)
    sentiment = getattr(analysis, "sentiment", CustomerSentiment.NEUTRAL)
    emotion = getattr(analysis, "emotion", CustomerEmotion.NEUTRAL)
    risk = getattr(analysis, "escalation_risk", EscalationRisk.LOW)
    trend = getattr(analysis, "satisfaction_trend", SatisfactionTrend.STABLE)
    confidence = getattr(analysis, "confidence", 1.0)

    if frustration >= 9:
        flags.append("critical_frustration")
    elif frustration >= 7:
        flags.append("high_frustration")

    if sentiment == CustomerSentiment.NEGATIVE:
        flags.append("negative_sentiment")

    if emotion == CustomerEmotion.ANGRY:
        flags.append("angry_customer")

    if risk == EscalationRisk.HIGH:
        flags.append("high_escalation_risk")
    elif risk == EscalationRisk.MEDIUM:
        flags.append("medium_escalation_risk")

    if trend == SatisfactionTrend.DECLINING:
        flags.append("declining_satisfaction")

    if confidence < 0.70:
        flags.append("low_analysis_confidence")

    if history:
        neg_count = sum(1 for h in history if h.sentiment == CustomerSentiment.NEGATIVE)
        if neg_count >= 2:
            flags.append("repeated_negative_sentiment")

        complaint_count = sum(1 for h in history if h.intent == CustomerIntent.COMPLAINT)
        if complaint_count >= 2:
            flags.append("repeated_complaints")

    # Deduplicate while preserving order
    seen = set()
    deduped = []
    for f in flags:
        if f not in seen:
            seen.add(f)
            deduped.append(f)

    return deduped


# ---------------------------------------------------------------------------
# 6. Core Decision Support Generation
# ---------------------------------------------------------------------------

def generate_decision_support(
    analysis_result: Any,
    history: Optional[List[TurnAnalysis]] = None
) -> DecisionSupportResult:
    """Generates deterministic decision support recommendations from analysis signals."""
    priority = determine_priority(analysis_result, history=history)
    tone = determine_recommended_tone(analysis_result)
    action = determine_recommended_action(analysis_result)
    needs = map_customer_needs(getattr(analysis_result, "intent", CustomerIntent.GENERAL_INQUIRY))
    risk_flags = collect_risk_flags(analysis_result, history=history)

    risk = getattr(analysis_result, "escalation_risk", EscalationRisk.LOW)
    escalation_recommended = (
        action == RecommendedAction.ESCALATE
        or priority == DecisionPriority.CRITICAL
        or risk == EscalationRisk.HIGH
    )

    intent_val = getattr(analysis_result, "intent", CustomerIntent.GENERAL_INQUIRY)
    if hasattr(intent_val, "value"):
        intent_val = intent_val.value
    emotion_val = getattr(analysis_result, "emotion", CustomerEmotion.NEUTRAL)
    if hasattr(emotion_val, "value"):
        emotion_val = emotion_val.value
    sentiment_val = getattr(analysis_result, "sentiment", CustomerSentiment.NEUTRAL)
    if hasattr(sentiment_val, "value"):
        sentiment_val = sentiment_val.value
    frustration_val = getattr(analysis_result, "frustration_level", 0)
    risk_val = risk.value if hasattr(risk, "value") else str(risk)

    rationale = (
        f"Customer expressed {intent_val} with {emotion_val} emotion and {sentiment_val} sentiment "
        f"(frustration: {frustration_val}/10, escalation risk: {risk_val}). "
        f"Recommended action is '{action.value}' using '{tone.value}' tone at '{priority.value}' priority."
    )
    if risk_flags:
        rationale += f" Risk flags detected: {', '.join(risk_flags)}."

    confidence = getattr(analysis_result, "confidence", 1.0)
    session_id = getattr(analysis_result, "session_id", None)
    turn_number = getattr(analysis_result, "turn_number", None)
    if turn_number is None and hasattr(analysis_result, "turn"):
        turn_number = getattr(analysis_result, "turn")

    return DecisionSupportResult(
        priority=priority,
        recommended_tone=tone,
        recommended_action=action,
        escalation_recommended=escalation_recommended,
        risk_flags=risk_flags,
        customer_needs=needs,
        rationale=rationale,
        confidence=round(float(confidence), 2),
        session_id=session_id,
        turn_number=turn_number,
    )


# ---------------------------------------------------------------------------
# 7. Session Decision Support Retrieval
# ---------------------------------------------------------------------------

def get_session_decision_support(
    session_id: int,
    db: DBSession
) -> DecisionSupportResult:
    """Retrieves decision support for a simulator session based on its latest analyzed state."""
    history = get_analysis_history(session_id=session_id, db=db)

    if not history:
        # Default baseline if session has no analyzed turns yet
        baseline = AnalysisResult(
            intent=CustomerIntent.GENERAL_INQUIRY,
            emotion=CustomerEmotion.NEUTRAL,
            sentiment=CustomerSentiment.NEUTRAL,
            frustration_level=0,
            satisfaction_trend=SatisfactionTrend.STABLE,
            escalation_risk=EscalationRisk.LOW,
            confidence=1.0,
            session_id=session_id,
            turn_number=None,
            analysis_source="default"
        )
        res = generate_decision_support(baseline, history=[])
        res.session_id = session_id
        res.turn_number = None
        return res

    latest = history[-1]
    res = generate_decision_support(latest, history=history)
    res.session_id = session_id
    res.turn_number = latest.turn
    return res
