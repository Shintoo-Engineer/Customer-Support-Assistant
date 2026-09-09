"""Analysis service for Task 4 Intent and Sentiment Analysis.

Implements hybrid intelligence combining LLM semantic classification with
deterministic scoring engines for frustration, satisfaction trend, and
escalation risk, backed by full conversation context and safe fallbacks.
"""

import json
import logging
import re
import time
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.orm import Session as DBSession

logger = logging.getLogger(__name__)

from app.models.simulator import Session as SimSession, Conversation, Message, Scenario
from app.schemas.analysis import (
    CustomerIntent,
    CustomerEmotion,
    CustomerSentiment,
    SatisfactionTrend,
    EscalationRisk,
    AnalysisResponse,
    AnalysisResult,
    TurnAnalysis,
    SessionAnalysisSummary,
)
from app.services.rag_service import generate_with_gemini

# ---------------------------------------------------------------------------
# Lightweight Operational Metrics
# ---------------------------------------------------------------------------

ANALYSIS_METRICS: Dict[str, Any] = {
    "total_analyses": 0,
    "gemini_analyses": 0,
    "fallback_analyses": 0,
    "validation_failures": 0,
    "analysis_failures": 0,
    "persistence_failures": 0,
    "total_latency_ms": 0.0,
}


def get_analysis_metrics() -> Dict[str, Any]:
    """Returns a copy of lightweight operational metrics."""
    total = ANALYSIS_METRICS["total_analyses"]
    avg_latency = (
        round(ANALYSIS_METRICS["total_latency_ms"] / total, 2)
        if total > 0 else 0.0
    )
    return {
        "total_analyses": total,
        "gemini_analyses": ANALYSIS_METRICS["gemini_analyses"],
        "fallback_analyses": ANALYSIS_METRICS["fallback_analyses"],
        "validation_failures": ANALYSIS_METRICS["validation_failures"],
        "analysis_failures": ANALYSIS_METRICS["analysis_failures"],
        "persistence_failures": ANALYSIS_METRICS["persistence_failures"],
        "average_latency_ms": avg_latency,
    }


def reset_analysis_metrics() -> None:
    """Resets operational metrics for test isolation."""
    for k in ANALYSIS_METRICS:
        ANALYSIS_METRICS[k] = 0 if not isinstance(ANALYSIS_METRICS[k], float) else 0.0


# ---------------------------------------------------------------------------
# Linguistic Keyword Dictionaries for Deterministic Classification & Fallback
# ---------------------------------------------------------------------------

INTENT_KEYWORDS: Dict[CustomerIntent, List[str]] = {
    CustomerIntent.REFUND: [
        "refund", "money back", "reimburse", "reimbursement", "overcharged",
        "return my money", "charged twice", "chargeback", "billing error",
        "double charge", "unexpected charge", "charged", "charge"
    ],
    CustomerIntent.CANCELLATION: [
        "cancel", "cancellation", "cancelling", "terminate", "stop subscription",
        "unsubscribe", "opt out", "discontinue", "end my plan", "turn off renewal",
        "stop renewal", "auto-renewal", "stop charging", "cancel my membership"
    ],
    CustomerIntent.DELIVERY_ISSUE: [
        "delivery", "deliver", "delivered", "shipping", "shipment", "shipped",
        "tracking", "courier", "package", "parcel", "order late", "hasn't arrived",
        "not arrived", "never received", "where is my item", "where is my package",
        "where is my order", "transit", "delayed", "lost package", "carrier exception",
        "delayed delivery", "smashed", "damaged"
    ],
    CustomerIntent.PAYMENT_ISSUE: [
        "card declined", "payment failed", "credit card", "debit card",
        "checkout", "transaction", "3ds", "3d-secure", "declined", "billing failed",
        "err_payment", "payment link", "pay link", "payment error", "timing out", "payment"
    ],
    CustomerIntent.ACCOUNT_ISSUE: [
        "account", "log in", "login", "password", "locked out", "locked", "2fa",
        "authenticator", "mfa", "access restored", "cannot access", "reset password",
        "reset link", "security code", "magic link", "credentials"
    ],
    CustomerIntent.COMPLAINT: [
        "formal complaint", "file a complaint", "complaint", "terrible", "horrible",
        "awful", "unacceptable", "ridiculous", "poor service", "worst", "disgusting",
        "pathetic", "bad service", "treat me like this", "incompetent", "poor quality", "appalled",
        "unhappy", "dissatisfied", "very unhappy", "extremely unhappy"
    ],
    CustomerIntent.RETURN_EXCHANGE: [
        "exchange", "swap", "wrong size", "replace", "replacement", "return item",
        "send back", "defective item", "broken item", "return"
    ],
    CustomerIntent.GENERAL_INQUIRY: [
        "hours", "pricing", "cost", "how does", "what is", "support contact",
        "phone number", "information", "how do i", "can you tell me", "policy",
        "faq", "support hours", "inquiry", "operating hours", "business hours", "timings"
    ],
}

EMOTION_KEYWORDS: Dict[CustomerEmotion, List[str]] = {
    CustomerEmotion.ANGRY: [
        "angry", "furious", "pissed", "unacceptable", "fix this right now", "fix this now",
        "get me your manager", "demand", "ridiculous", "not paying for this", "disgusted",
        "lawyer", "sue", "manager immediately", "completely unacceptable", "right now",
        "stop charging", "terrible", "horrible", "awful", "worst", "incompetent",
        "formal complaint", "file a complaint", "smashed", "damaged", "give me my refund",
        "charged me twice"
    ],
    CustomerEmotion.FRUSTRATED: [
        "frustrated", "frustrating", "already told you", "taking too long", "wasting my time",
        "tired of waiting", "explained this twice", "contacted you three times",
        "still waiting", "still no update", "no straight answer", "unhelpful",
        "taking way longer", "don't have time for this", "already", "still haven't",
        "still hasn't", "hasn't arrived", "not arrived", "why hasn't", "urgent", "too long",
        "waiting for hours", "refund immediately", "disappointed", "dissatisfied",
        "third time", "second time", "fourth time", "nobody is resolving"
    ],
    CustomerEmotion.WORRIED: [
        "worried", "anxious", "nervous", "scared", "afraid", "concerned",
        "hope it's okay", "urgent concern", "hope i didn't", "stressed",
        "never received", "locked out", "charged twice"
    ],
    CustomerEmotion.CONFUSED: [
        "confused", "don't understand", "do not understand", "what does this mean",
        "not sure", "where to look", "uncertain", "how come", "puzzled", "lost",
        "does this mean", "clarification", "didn't get", "not clear", "timing out",
        "reset link", "how to"
    ],
    CustomerEmotion.SATISFIED: [
        "resolved", "solved", "all good", "all sorted", "working now", "sorted out",
        "appreciate your help", "that works", "all set", "fixed now", "thanks for fixing",
        "thank you for handling", "appreciate you taking care", "very helpful", "helpful", "that was helpful"
    ],
    CustomerEmotion.HAPPY: [
        "thank you so much", "so happy", "wonderful", "amazing", "great service",
        "fantastic", "awesome", "delighted", "love this", "brilliant", "yay", "super happy",
        "happy to"
    ],
}

ESCALATION_PHRASES: List[str] = [
    "get me your manager", "speak to a supervisor", "speak with a manager",
    "transfer me", "someone senior", "escalate this", "escalate",
    "file a complaint", "take this further", "legal action", "contact my lawyer",
    "report you", "call my bank", "dispute this charge", "dispute", "your supervisor"
]

REPEATED_COMPLAINT_INDICATORS: List[str] = [
    "already told you", "already explained", "told you twice", "told you three times",
    "second time", "third time", "fourth time", "again", "still haven't",
    "still not", "still waiting", "contacted you twice", "contacted you earlier",
    "contacted support three times", "i already complained"
]


# ---------------------------------------------------------------------------
# Context Extraction Interface (Reusing Task 3 Tables)
# ---------------------------------------------------------------------------

def get_conversation_context(session_id: int, db: DBSession) -> Optional[Dict[str, Any]]:
    """Retrieves conversation context from existing Task 3 database tables."""
    session_row = (
        db.query(SimSession)
        .filter(SimSession.session_id == session_id)
        .first()
    )
    if not session_row:
        return None

    conversation_row = (
        db.query(Conversation)
        .filter(Conversation.session_id == session_id)
        .first()
    )

    scenario_row = None
    if session_row.scenario_id:
        scenario_row = (
            db.query(Scenario)
            .filter(Scenario.scenario_id == session_row.scenario_id)
            .first()
        )

    dialogue_messages: List[Dict[str, str]] = []
    if conversation_row:
        raw_messages = (
            db.query(Message)
            .filter(
                Message.conversation_id == conversation_row.conversation_id,
                Message.message_type != "System"
            )
            .order_by(Message.message_id.asc())
            .all()
        )
        for msg in raw_messages:
            dialogue_messages.append({
                "sender_type": msg.sender_type,
                "message_text": msg.message_text,
            })

    return {
        "session_id": session_row.session_id,
        "conversation_id": conversation_row.conversation_id if conversation_row else None,
        "status": session_row.status,
        "scenario_category": scenario_row.category if scenario_row else None,
        "scenario_title": scenario_row.title if scenario_row else None,
        "dialogue_history": dialogue_messages,
    }


# ---------------------------------------------------------------------------
# Deterministic Signal Detectors & Scoring Algorithms
# ---------------------------------------------------------------------------

def detect_escalation_request(text: str) -> bool:
    """Detects whether customer message explicitly requests supervisor escalation."""
    lower_text = text.lower()
    return any(phrase in lower_text for phrase in ESCALATION_PHRASES)


def detect_repeated_complaint(text: str, dialogue_history: List[Dict[str, str]]) -> bool:
    """Detects whether customer message indicates a recurring/unresolved complaint."""
    lower_text = text.lower()
    # Positive or resolving messages are never repeated complaints
    if any(g in lower_text for g in ["thank you", "thanks", "resolved", "all good", "all sorted", "fixed now"]):
        return False

    if any(phrase in lower_text for phrase in REPEATED_COMPLAINT_INDICATORS):
        return True

    prior_customer_msgs = [
        m["message_text"].lower() for m in dialogue_history
        if m.get("sender_type") == "Customer"
    ]
    if prior_customer_msgs and prior_customer_msgs[-1].strip() == lower_text.strip():
        prior_customer_msgs = prior_customer_msgs[:-1]

    if len(prior_customer_msgs) >= 2:
        return True

    return False


def classify_intent_deterministic(
    text: str,
    dialogue_history: List[Dict[str, str]],
    scenario_category: Optional[str] = None
) -> CustomerIntent:
    """Classifies intent using linguistic keyword matching and contextual back-references."""
    lower_text = text.lower()

    # 1. Direct keyword match scoring
    intent_scores: Dict[CustomerIntent, int] = {intent: 0 for intent in CustomerIntent}
    for intent, kw_list in INTENT_KEYWORDS.items():
        for kw in kw_list:
            if kw in lower_text:
                intent_scores[intent] += (len(kw.split()) * 2)

    best_intent = max(intent_scores, key=intent_scores.get)
    if intent_scores[best_intent] > 0:
        return best_intent

    # 2. Context-aware back-reference resolution
    if any(ref in lower_text for ref in ["that money", "money back", "my charge", "overcharged"]):
        return CustomerIntent.REFUND
    if any(ref in lower_text for ref in ["cancel it", "stop it", "terminate it"]):
        return CustomerIntent.CANCELLATION
    if any(ref in lower_text for ref in ["where is it", "is it shipped", "tracking number"]):
        return CustomerIntent.DELIVERY_ISSUE

    if scenario_category:
        scen_norm = scenario_category.lower()
        if "refund" in scen_norm:
            return CustomerIntent.REFUND
        if "delayed" in scen_norm or "delivery" in scen_norm:
            return CustomerIntent.DELIVERY_ISSUE
        if "payment" in scen_norm:
            return CustomerIntent.PAYMENT_ISSUE
        if "account" in scen_norm:
            return CustomerIntent.ACCOUNT_ISSUE
        if "cancel" in scen_norm:
            return CustomerIntent.CANCELLATION

    return CustomerIntent.GENERAL_INQUIRY


def classify_emotion_deterministic(text: str) -> CustomerEmotion:
    """Classifies customer emotion using affective signals and linguistic markers."""
    lower_text = text.lower()

    # Check order of intensity: angry -> frustrated -> worried -> confused -> satisfied -> happy
    for kw in EMOTION_KEYWORDS[CustomerEmotion.ANGRY]:
        if kw in lower_text:
            return CustomerEmotion.ANGRY

    for kw in EMOTION_KEYWORDS[CustomerEmotion.FRUSTRATED]:
        if kw in lower_text:
            return CustomerEmotion.FRUSTRATED

    for kw in EMOTION_KEYWORDS[CustomerEmotion.WORRIED]:
        if kw in lower_text:
            return CustomerEmotion.WORRIED

    for kw in EMOTION_KEYWORDS[CustomerEmotion.CONFUSED]:
        if kw in lower_text:
            return CustomerEmotion.CONFUSED

    for kw in EMOTION_KEYWORDS[CustomerEmotion.SATISFIED]:
        if kw in lower_text:
            return CustomerEmotion.SATISFIED

    for kw in EMOTION_KEYWORDS[CustomerEmotion.HAPPY]:
        if kw in lower_text:
            return CustomerEmotion.HAPPY

    return CustomerEmotion.NEUTRAL


def classify_sentiment_deterministic(
    text: str,
    emotion: CustomerEmotion
) -> CustomerSentiment:
    """Determines overall sentiment polarity from emotion and phrasing."""
    if emotion in [CustomerEmotion.HAPPY, CustomerEmotion.SATISFIED]:
        return CustomerSentiment.POSITIVE
    if emotion in [CustomerEmotion.ANGRY, CustomerEmotion.FRUSTRATED, CustomerEmotion.WORRIED]:
        return CustomerSentiment.NEGATIVE

    lower_text = text.lower()
    positive_words = [
        "thank you so much", "so happy", "wonderful", "amazing", "great service",
        "fantastic", "awesome", "delighted", "love this", "brilliant", "resolved",
        "all good", "all sorted", "fixed now", "helpful", "very helpful", "appreciate"
    ]
    negative_words = [
        "bad", "wrong", "error", "problem", "failed", "late", "delay", "issue",
        "terrible", "cancel", "decline", "declined", "locked", "disappointed",
        "unhappy", "dissatisfied", "hasn't arrived", "still hasn't", "not arrived",
        "has not arrived", "missing", "frustrated", "frustrating", "not working"
    ]

    pos_count = sum(1 for w in positive_words if w in lower_text)
    neg_count = sum(1 for w in negative_words if w in lower_text)

    if pos_count > neg_count and neg_count == 0:
        return CustomerSentiment.POSITIVE
    if neg_count > pos_count:
        return CustomerSentiment.NEGATIVE
    return CustomerSentiment.NEUTRAL


def calculate_frustration_level(
    message: str,
    emotion: CustomerEmotion,
    sentiment: CustomerSentiment,
    dialogue_history: List[Dict[str, str]],
    has_escalation_req: bool,
    has_repeated: bool
) -> int:
    """Calculates deterministic frustration score on bounded integer scale [0, 10]."""
    base_map = {
        CustomerEmotion.HAPPY: 0.0,
        CustomerEmotion.SATISFIED: 1.0,
        CustomerEmotion.NEUTRAL: 2.0,
        CustomerEmotion.CONFUSED: 3.5,
        CustomerEmotion.WORRIED: 4.5,
        CustomerEmotion.FRUSTRATED: 7.0,
        CustomerEmotion.ANGRY: 9.0,
    }
    score = base_map.get(emotion, 2.0)

    if sentiment == CustomerSentiment.NEGATIVE and score < 6.0:
        score += 1.5
    elif sentiment == CustomerSentiment.POSITIVE and score > 2.0:
        score -= 2.0

    words = message.split()
    caps_words = sum(1 for w in words if len(w) >= 3 and w.isupper())
    if caps_words >= 2:
        score += 1.5

    if "!" in message:
        excl_count = message.count("!")
        score += min(2.0, excl_count * 0.5)

    if has_escalation_req:
        score += 2.5

    if has_repeated:
        score += 2.0

    prior_customer_turns = [
        m for m in dialogue_history if m.get("sender_type") == "Customer"
    ]
    if prior_customer_turns and prior_customer_turns[-1].get("message_text", "").strip().lower() == message.strip().lower():
        prior_customer_turns = prior_customer_turns[:-1]
    if len(prior_customer_turns) >= 2 and emotion in [CustomerEmotion.FRUSTRATED, CustomerEmotion.ANGRY]:
        score += 1.0

    lower_msg = message.lower()
    if any(g in lower_msg for g in ["thank you", "thanks for fixing", "all set now", "that solves"]):
        score = min(score, 1.0)

    return max(0, min(10, int(round(score))))


def determine_satisfaction_trend(
    current_frustration: int,
    current_sentiment: CustomerSentiment,
    dialogue_history: List[Dict[str, str]],
    current_message: Optional[str] = None
) -> SatisfactionTrend:
    """Determines directional satisfaction trend (improving, declining, stable) across turns."""
    prior_customer_msgs = [
        m["message_text"] for m in dialogue_history
        if m.get("sender_type") == "Customer"
    ]
    if current_message and prior_customer_msgs and prior_customer_msgs[-1].strip().lower() == current_message.strip().lower():
        prior_customer_msgs = prior_customer_msgs[:-1]

    if not prior_customer_msgs:
        return SatisfactionTrend.STABLE

    prev_text = prior_customer_msgs[-1]
    prev_emotion = classify_emotion_deterministic(prev_text)
    prev_sentiment = classify_sentiment_deterministic(prev_text, prev_emotion)
    prev_frustration = calculate_frustration_level(
        message=prev_text,
        emotion=prev_emotion,
        sentiment=prev_sentiment,
        dialogue_history=[],
        has_escalation_req=detect_escalation_request(prev_text),
        has_repeated=False
    )

    diff = current_frustration - prev_frustration

    if diff <= -2 or (prev_sentiment == CustomerSentiment.NEGATIVE and current_sentiment in [CustomerSentiment.NEUTRAL, CustomerSentiment.POSITIVE]):
        return SatisfactionTrend.IMPROVING
    elif diff >= 2 or (prev_sentiment in [CustomerSentiment.NEUTRAL, CustomerSentiment.POSITIVE] and current_sentiment == CustomerSentiment.NEGATIVE):
        return SatisfactionTrend.DECLINING
    else:
        return SatisfactionTrend.STABLE


def determine_escalation_risk(
    frustration_level: int,
    emotion: CustomerEmotion,
    sentiment: CustomerSentiment,
    has_escalation_req: bool,
    has_repeated: bool
) -> EscalationRisk:
    """Assesses escalation risk level (low, medium, high) via multi-signal rules."""
    # When customer is satisfied or happy, or frustration is <= 2 and no escalation request, risk is LOW
    if emotion in [CustomerEmotion.HAPPY, CustomerEmotion.SATISFIED] or (frustration_level <= 2 and not has_escalation_req):
        return EscalationRisk.LOW

    if has_escalation_req or frustration_level >= 8 or (emotion == CustomerEmotion.ANGRY and has_repeated):
        return EscalationRisk.HIGH

    if frustration_level >= 5 or has_repeated or emotion in [CustomerEmotion.FRUSTRATED, CustomerEmotion.WORRIED]:
        return EscalationRisk.MEDIUM

    return EscalationRisk.LOW


def calculate_confidence(
    emotion: CustomerEmotion,
    sentiment: CustomerSentiment,
    intent: CustomerIntent,
    has_signals: bool,
    used_llm: bool,
    text: str = ""
) -> float:
    """Calculates an explainable classification confidence score bounded within [0.0, 1.0]."""
    base = 0.88 if used_llm else 0.82

    # Polarity & emotional correlation
    if emotion in [CustomerEmotion.ANGRY, CustomerEmotion.FRUSTRATED] and sentiment == CustomerSentiment.NEGATIVE:
        base += 0.06
    elif emotion in [CustomerEmotion.HAPPY, CustomerEmotion.SATISFIED] and sentiment == CustomerSentiment.POSITIVE:
        base += 0.06
    elif emotion == CustomerEmotion.NEUTRAL and sentiment == CustomerSentiment.NEUTRAL:
        base += 0.04
    elif emotion in [CustomerEmotion.CONFUSED, CustomerEmotion.WORRIED] and sentiment in [CustomerSentiment.NEUTRAL, CustomerSentiment.NEGATIVE]:
        base += 0.02
    else:
        base -= 0.08

    if has_signals:
        base += 0.04

    # Text evidence quality: distinguish strong vs weak/ambiguous evidence
    clean = text.strip().lower().strip(".,!?:;\"'") if text else ""
    if clean:
        # Weak evidence: short or elliptical tokens without explicit domain keywords
        if len(clean) <= 8 and clean in ["ok", "okay", "yes", "sure", "fine", "yep", "no", "hello", "hi"]:
            base -= 0.28
        # Ambiguous evidence
        elif any(phrase in clean for phrase in ["something is wrong", "not working right", "problem with order", "issue with service"]):
            base -= 0.10
        # Strong evidence: explicit intent keywords
        elif any(kw in clean for kw_list in INTENT_KEYWORDS.values() for kw in kw_list):
            base += 0.04

    return round(max(0.10, min(0.98, base)), 2)


# ---------------------------------------------------------------------------
# LLM Prompt Construction & Integration
# ---------------------------------------------------------------------------

def build_analysis_prompt(
    customer_message: str,
    dialogue_history: List[Dict[str, str]],
    scenario_category: Optional[str] = None
) -> str:
    """Constructs structured JSON prompt for Gemini Intent & Sentiment classification."""
    history_text = "\n".join(
        f"- {m.get('sender_type', 'User')}: {m.get('message_text', '')}"
        for m in dialogue_history[-6:]
    ) if dialogue_history else "(No previous turns)"

    return f"""You are a specialized customer support analysis agent.
Analyze the customer's current message within the given conversation context.

=== CONTEXT ===
Active Scenario: {scenario_category or 'General Support'}
Recent Conversation History:
{history_text}

=== CURRENT CUSTOMER MESSAGE ===
"{customer_message}"

=== INSTRUCTIONS ===
Classify the message and output ONLY a valid, raw JSON object with these EXACT keys:
- "intent": one of ["refund", "cancellation", "delivery_issue", "payment_issue", "account_issue", "complaint", "return_exchange", "general_inquiry"]
- "emotion": one of ["happy", "neutral", "confused", "worried", "frustrated", "angry", "satisfied"]
- "sentiment": one of ["positive", "neutral", "negative"]
- "confidence": a float between 0.0 and 1.0 estimating classification certainty

Rules:
1. Distinguish emotion from sentiment (e.g., 'worried' emotion is 'negative' sentiment).
2. Use conversation context to resolve references (e.g., "give me that money back" in a refund context means "refund").
3. DO NOT output markdown fences, code blocks, or text outside the JSON object.
"""


def parse_llm_json(raw_text: str) -> Optional[Dict[str, Any]]:
    """Cleans, normalizes, and extracts a JSON object from raw LLM output."""
    if not raw_text or not isinstance(raw_text, str):
        return None

    text = raw_text.strip()

    # Strip code fences ```json ... ``` or ``` ... ```
    if "```" in text:
        fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
        if fence_match:
            text = fence_match.group(1).strip()

    # Try direct parse
    try:
        data = json.loads(text)
        if isinstance(data, dict):
            return data
    except Exception:
        pass

    # Try regex matching { ... }
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        candidate = match.group(0)
        try:
            data = json.loads(candidate)
            if isinstance(data, dict):
                return data
        except Exception:
            # Try removing trailing commas: e.g. , } or , ]
            cleaned = re.sub(r",\s*([\}\]])", r"\1", candidate)
            try:
                data = json.loads(cleaned)
                if isinstance(data, dict):
                    return data
            except Exception:
                pass

    return None


# ---------------------------------------------------------------------------
# Main Analysis Pipeline (Hybrid LLM + Deterministic Engine)
# ---------------------------------------------------------------------------

def analyze_customer_message(
    session_id: int,
    customer_message: str,
    db: DBSession
) -> AnalysisResult:
    """Executes full multidimensional analysis on a customer message."""
    start_t = time.perf_counter()
    ANALYSIS_METRICS["total_analyses"] += 1
    logger.info("analysis_started session_id=%s message_len=%s", session_id, len(customer_message) if customer_message else 0)

    context = get_conversation_context(session_id, db)
    if context is None:
        ANALYSIS_METRICS["analysis_failures"] += 1
        logger.error("analysis_failed: session_id=%s not found in database", session_id)
        raise ValueError(f"Simulator session {session_id} not found.")

    dialogue_history = context.get("dialogue_history", [])
    scenario_category = context.get("scenario_category")
    conv_id = context.get("conversation_id")

    # 1. Deterministic signal detection
    has_esc_req = detect_escalation_request(customer_message)
    has_repeated = detect_repeated_complaint(customer_message, dialogue_history)

    # 2. Attempt LLM Classification
    used_llm = False
    intent_val: Optional[CustomerIntent] = None
    emotion_val: Optional[CustomerEmotion] = None
    sentiment_val: Optional[CustomerSentiment] = None
    confidence_val: Optional[float] = None

    try:
        prompt = build_analysis_prompt(
            customer_message=customer_message,
            dialogue_history=dialogue_history,
            scenario_category=scenario_category
        )
        raw_llm_output = generate_with_gemini(prompt)
        parsed = parse_llm_json(raw_llm_output)

        if parsed and isinstance(parsed, dict):
            # 1. Intent validation & normalization
            raw_intent = str(parsed.get("intent", "")).lower().strip().strip(".,!?:;\"'")
            if raw_intent in [i.value for i in CustomerIntent]:
                intent_val = CustomerIntent(raw_intent)
            else:
                ANALYSIS_METRICS["validation_failures"] += 1
                logger.warning("analysis_validation_failed field=intent value='%s' session_id=%s", raw_intent, session_id)

            # 2. Emotion validation & normalization
            raw_emotion = str(parsed.get("emotion", "")).lower().strip().strip(".,!?:;\"'")
            if raw_emotion in [e.value for e in CustomerEmotion]:
                emotion_val = CustomerEmotion(raw_emotion)
            else:
                ANALYSIS_METRICS["validation_failures"] += 1
                logger.warning("analysis_validation_failed field=emotion value='%s' session_id=%s", raw_emotion, session_id)

            # 3. Sentiment validation & normalization
            raw_sentiment = str(parsed.get("sentiment", "")).lower().strip().strip(".,!?:;\"'")
            if raw_sentiment in [s.value for s in CustomerSentiment]:
                sentiment_val = CustomerSentiment(raw_sentiment)
            else:
                ANALYSIS_METRICS["validation_failures"] += 1
                logger.warning("analysis_validation_failed field=sentiment value='%s' session_id=%s", raw_sentiment, session_id)

            # 4. Confidence validation
            raw_conf = parsed.get("confidence")
            if isinstance(raw_conf, (int, float)) and not isinstance(raw_conf, bool):
                confidence_val = round(max(0.0, min(1.0, float(raw_conf))), 2)

            if intent_val and emotion_val and sentiment_val:
                used_llm = True
                ANALYSIS_METRICS["gemini_analyses"] += 1
                logger.info("analysis_source_selected session_id=%s source=gemini", session_id)
            else:
                ANALYSIS_METRICS["fallback_analyses"] += 1
                logger.info("analysis_source_selected session_id=%s source=fallback reason=partial_validation_failure", session_id)
        else:
            ANALYSIS_METRICS["fallback_analyses"] += 1
            logger.info("analysis_source_selected session_id=%s source=fallback reason=no_parsed_json", session_id)
    except Exception as e:
        ANALYSIS_METRICS["fallback_analyses"] += 1
        logger.info("analysis_source_selected session_id=%s source=fallback reason=gemini_exception (%s)", session_id, e)

    analysis_source = "gemini" if used_llm else "fallback"

    # 3. Deterministic Fallback if LLM unavailable or invalid
    if not intent_val:
        intent_val = classify_intent_deterministic(
            text=customer_message,
            dialogue_history=dialogue_history,
            scenario_category=scenario_category
        )
    if not emotion_val:
        emotion_val = classify_emotion_deterministic(customer_message)
    if not sentiment_val:
        sentiment_val = classify_sentiment_deterministic(customer_message, emotion_val)
    if confidence_val is None:
        confidence_val = calculate_confidence(
            emotion=emotion_val,
            sentiment=sentiment_val,
            intent=intent_val,
            has_signals=(has_esc_req or has_repeated),
            used_llm=used_llm,
            text=customer_message
        )

    confidence_val = round(max(0.0, min(1.0, confidence_val)), 2)

    # 4. Deterministic Calculations for Frustration, Trend, and Escalation Risk
    frustration_level = calculate_frustration_level(
        message=customer_message,
        emotion=emotion_val,
        sentiment=sentiment_val,
        dialogue_history=dialogue_history,
        has_escalation_req=has_esc_req,
        has_repeated=has_repeated
    )

    satisfaction_trend = determine_satisfaction_trend(
        current_frustration=frustration_level,
        current_sentiment=sentiment_val,
        dialogue_history=dialogue_history,
        current_message=customer_message
    )

    escalation_risk = determine_escalation_risk(
        frustration_level=frustration_level,
        emotion=emotion_val,
        sentiment=sentiment_val,
        has_escalation_req=has_esc_req,
        has_repeated=has_repeated
    )

    duration_ms = (time.perf_counter() - start_t) * 1000.0
    ANALYSIS_METRICS["total_latency_ms"] += duration_ms

    prior_customer_turns = [
        m for m in dialogue_history if m.get("sender_type") == "Customer"
    ]
    if prior_customer_turns and prior_customer_turns[-1].get("message_text", "").strip() == customer_message.strip():
        turn_number = len(prior_customer_turns)
    else:
        turn_number = len(prior_customer_turns) + 1

    result = AnalysisResult(
        intent=intent_val,
        emotion=emotion_val,
        sentiment=sentiment_val,
        frustration_level=frustration_level,
        satisfaction_trend=satisfaction_trend,
        escalation_risk=escalation_risk,
        confidence=confidence_val,
        session_id=session_id,
        conversation_id=conv_id,
        turn_number=turn_number,
        analysis_source=analysis_source,
        analysis_timestamp=datetime.now(timezone.utc).isoformat(),
    )

    logger.info(
        "analysis_completed session_id=%s source=%s duration_ms=%.2f intent=%s emotion=%s sentiment=%s frustration=%s trend=%s risk=%s confidence=%s",
        session_id, analysis_source, duration_ms, result.intent.value, result.emotion.value, result.sentiment.value,
        result.frustration_level, result.satisfaction_trend.value, result.escalation_risk.value, result.confidence
    )

    # 5. Safely update existing conversation record in database if present
    try:
        if conv_id:
            conv_row = db.query(Conversation).filter(Conversation.conversation_id == conv_id).first()
            if conv_row:
                conv_row.intent = result.intent.value
                conv_row.sentiment = result.sentiment.value
                conv_row.escalation_risk = result.escalation_risk.value.capitalize()
                db.commit()
                logger.info("analysis_persisted session_id=%s conversation_id=%s", session_id, conv_id)
    except Exception as db_err:
        ANALYSIS_METRICS["persistence_failures"] += 1
        logger.warning("analysis_persistence_failed: conversation record update skipped (%s) session_id=%s", db_err, session_id)
        db.rollback()

    return result


# ---------------------------------------------------------------------------
# Historical Analysis Retrieval & Session Summary Services
# ---------------------------------------------------------------------------

def get_analysis_history(session_id: int, db: DBSession) -> List[TurnAnalysis]:
    """Retrieves chronological turn-by-turn analysis history for a simulator session."""
    session_row = db.query(SimSession).filter(SimSession.session_id == session_id).first()
    if not session_row:
        logger.error("analysis_history_failed: session_id=%s not found", session_id)
        raise ValueError(f"Simulator session {session_id} not found.")

    conversation_row = db.query(Conversation).filter(Conversation.session_id == session_id).first()
    if not conversation_row:
        logger.info("analysis_history_retrieved session_id=%s turn_count=0", session_id)
        return []

    system_messages = (
        db.query(Message)
        .filter(
            Message.conversation_id == conversation_row.conversation_id,
            Message.message_type == "System"
        )
        .order_by(Message.message_id.asc())
        .all()
    )

    turn_analyses: List[TurnAnalysis] = []
    seen_turns = set()
    turn_counter = 1

    for msg in system_messages:
        try:
            parsed = json.loads(msg.message_text)
            if isinstance(parsed, dict) and "analysis" in parsed and isinstance(parsed["analysis"], dict):
                a = parsed["analysis"]
                t_num = turn_counter
                turn_counter += 1
                if t_num in seen_turns:
                    continue
                seen_turns.add(t_num)

                ts_str = msg.timestamp.isoformat() if hasattr(msg.timestamp, "isoformat") else str(msg.timestamp) if msg.timestamp else None
                turn_analyses.append(
                    TurnAnalysis(
                        turn=int(t_num),
                        intent=CustomerIntent(a["intent"]),
                        emotion=CustomerEmotion(a["emotion"]),
                        sentiment=CustomerSentiment(a["sentiment"]),
                        frustration_level=int(a["frustration_level"]),
                        satisfaction_trend=SatisfactionTrend(a["satisfaction_trend"]),
                        escalation_risk=EscalationRisk(a["escalation_risk"]),
                        confidence=float(a["confidence"]),
                        analysis_source=a.get("analysis_source") or "fallback",
                        timestamp=ts_str
                    )
                )
        except Exception as parse_err:
            logger.debug("Non-analysis system message ignored in history (%s)", parse_err)

    # If no system turn messages exist, but conversation row has intent
    if not turn_analyses and conversation_row.intent:
        try:
            conv_ts = conversation_row.created_at.isoformat() if hasattr(conversation_row.created_at, "isoformat") else str(conversation_row.created_at) if conversation_row.created_at else None
            turn_analyses.append(
                TurnAnalysis(
                    turn=1,
                    intent=CustomerIntent(conversation_row.intent),
                    emotion=CustomerEmotion.NEUTRAL,
                    sentiment=CustomerSentiment(conversation_row.sentiment or "neutral"),
                    frustration_level=2,
                    satisfaction_trend=SatisfactionTrend.STABLE,
                    escalation_risk=EscalationRisk(str(conversation_row.escalation_risk or "low").lower()),
                    confidence=0.82,
                    analysis_source="fallback",
                    timestamp=conv_ts
                )
            )
        except Exception:
            pass

    logger.info("analysis_history_retrieved session_id=%s turn_count=%s", session_id, len(turn_analyses))
    return turn_analyses


def get_session_analysis_summary(session_id: int, db: DBSession) -> SessionAnalysisSummary:
    """Calculates aggregated session analysis summary derived from stored turn analyses."""
    history = get_analysis_history(session_id, db)

    if not history:
        return SessionAnalysisSummary(
            session_id=session_id,
            dominant_intent=CustomerIntent.GENERAL_INQUIRY,
            latest_emotion=CustomerEmotion.NEUTRAL,
            latest_sentiment=CustomerSentiment.NEUTRAL,
            current_frustration=0,
            current_escalation_risk=EscalationRisk.LOW,
            overall_satisfaction_direction=SatisfactionTrend.STABLE,
            average_confidence=0.0,
            turn_count=0
        )

    turn_count = len(history)
    latest = history[-1]

    # 1. Dominant intent determination
    intent_counts: Dict[CustomerIntent, int] = {}
    for item in history:
        intent_counts[item.intent] = intent_counts.get(item.intent, 0) + 1

    max_count = max(intent_counts.values())
    top_candidates = [i for i, cnt in intent_counts.items() if cnt == max_count]
    # Tie-breaker: prefer latest turn's intent if it is among the highest, else first candidate
    if latest.intent in top_candidates:
        dominant_intent = latest.intent
    else:
        dominant_intent = top_candidates[0]

    # 2. Latest customer states
    latest_emotion = latest.emotion
    latest_sentiment = latest.sentiment
    current_frustration = latest.frustration_level
    current_escalation_risk = latest.escalation_risk

    # 3. Overall satisfaction direction
    if turn_count == 1:
        overall_direction = history[0].satisfaction_trend
    else:
        first = history[0]
        frust_diff = latest.frustration_level - first.frustration_level
        if frust_diff <= -2 or (first.sentiment == CustomerSentiment.NEGATIVE and latest.sentiment in [CustomerSentiment.POSITIVE, CustomerSentiment.NEUTRAL]):
            overall_direction = SatisfactionTrend.IMPROVING
        elif frust_diff >= 2 or (first.sentiment in [CustomerSentiment.POSITIVE, CustomerSentiment.NEUTRAL] and latest.sentiment == CustomerSentiment.NEGATIVE):
            overall_direction = SatisfactionTrend.DECLINING
        else:
            overall_direction = latest.satisfaction_trend

    # 4. Average confidence
    valid_confs = [item.confidence for item in history if item.confidence is not None]
    avg_conf = round(sum(valid_confs) / len(valid_confs), 2) if valid_confs else 0.0
    avg_conf = max(0.0, min(1.0, avg_conf))

    return SessionAnalysisSummary(
        session_id=session_id,
        dominant_intent=dominant_intent,
        latest_emotion=latest_emotion,
        latest_sentiment=latest_sentiment,
        current_frustration=current_frustration,
        current_escalation_risk=current_escalation_risk,
        overall_satisfaction_direction=overall_direction,
        average_confidence=avg_conf,
        turn_count=turn_count
    )
