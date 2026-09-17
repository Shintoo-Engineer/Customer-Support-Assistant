"""Task 4 - Intent and Sentiment Analysis Agent.

Analyzes customer messages using the current message plus conversation
history to determine intent, emotion, sentiment, frustration, satisfaction
trend, escalation risk, and confidence.
"""

import re
from typing import Any


SUPPORTED_INTENTS = {
    "refund_status",
    "cancellation",
    "delivery_issue",
    "payment_issue",
    "account_issue",
    "complaint",
    "return_exchange",
    "general_inquiry",
}


INTENT_KEYWORDS = {
    "refund_status": [
        "refund",
        "money back",
        "moneyback",
        "reimbursement",
        "refunded",
        "refund status",
        "refund pending",
        "refund not received",
    ],
    "cancellation": [
        "cancel",
        "cancellation",
        "terminate subscription",
        "stop subscription",
        "cancel my order",
        "cancel order",
    ],
    "delivery_issue": [
        "delivery",
        "delivered",
        "delivery date",
        "late",
        "delay",
        "delayed",
        "shipment",
        "shipping",
        "tracking",
        "package",
        "parcel",
        "not arrived",
        "not delivered",
        "lost",
    ],
    "payment_issue": [
        "payment",
        "paid",
        "pay",
        "payment failed",
        "payment failure",
        "charged",
        "charge",
        "charged twice",
        "double charged",
        "debit",
        "transaction",
        "card",
        "upi",
    ],
    "account_issue": [
        "account",
        "login",
        "log in",
        "sign in",
        "password",
        "profile",
        "email",
        "verification",
        "otp",
        "locked out",
    ],
    "complaint": [
        "complaint",
        "complain",
        "unacceptable",
        "terrible service",
        "worst service",
        "poor service",
        "disappointed",
        "disappointing",
        "manager",
        "escalate",
        "escalation",
    ],
    "return_exchange": [
        "return",
        "exchange",
        "replacement",
        "replace",
        "wrong item",
        "damaged item",
        "defective",
        "broken",
        "size exchange",
    ],
    "general_inquiry": [
        "how do i",
        "can i",
        "what is",
        "where can i",
        "when will",
        "is it possible",
        "tell me",
        "information",
        "question",
        "help",
    ],
}


EMOTION_KEYWORDS = {
    "happy": [
        "happy",
        "great",
        "awesome",
        "excellent",
        "wonderful",
        "glad",
        "perfect",
        "amazing",
    ],
    "satisfied": [
        "satisfied",
        "resolved",
        "thank you",
        "thanks",
        "appreciate",
        "that helps",
        "problem solved",
        "all good",
    ],
    "angry": [
        "angry",
        "furious",
        "ridiculous",
        "unacceptable",
        "outrageous",
        "worst",
        "hate",
        "fix this now",
        "right now",
        "manager",
    ],
    "frustrated": [
        "frustrated",
        "frustrating",
        "fed up",
        "tired of",
        "again",
        "still",
        "already told",
        "already explained",
        "how many times",
        "waste of time",
        "taking too long",
    ],
    "worried": [
        "worried",
        "concerned",
        "concern",
        "afraid",
        "scared",
        "anxious",
        "hope",
        "what if",
    ],
    "confused": [
        "confused",
        "don't understand",
        "do not understand",
        "not sure",
        "unclear",
        "what does that mean",
        "how is that possible",
        "which one",
        "why is",
    ],
}


POSITIVE_WORDS = {
    "good",
    "great",
    "excellent",
    "happy",
    "perfect",
    "thanks",
    "thank",
    "helpful",
    "resolved",
    "satisfied",
    "appreciate",
    "awesome",
    "wonderful",
    "amazing",
}

NEGATIVE_WORDS = {
    "bad",
    "poor",
    "angry",
    "frustrated",
    "frustrating",
    "worst",
    "terrible",
    "unacceptable",
    "disappointed",
    "disappointing",
    "annoyed",
    "annoying",
    "hate",
    "problem",
    "issue",
    "failed",
    "failure",
    "late",
    "delay",
    "delayed",
    "wrong",
    "broken",
    "ridiculous",
}

ESCALATION_PHRASES = [
    "manager",
    "supervisor",
    "escalate",
    "escalation",
    "legal action",
    "lawyer",
    "consumer court",
    "chargeback",
    "report you",
    "report this",
    "negative review",
    "social media",
    "never use",
    "close my account",
]


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip().lower())


def _clamp(value: float, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, int(round(value))))


def _keyword_matches(text: str, keywords: list[str]) -> int:
    return sum(1 for keyword in keywords if keyword in text)


def _customer_history(history: list[dict[str, Any]] | None) -> list[str]:
    """Extract only customer messages from conversation history."""

    if not history:
        return []

    messages: list[str] = []

    for item in history:
        if not isinstance(item, dict):
            continue

        sender = str(
            item.get("sender_type")
            or item.get("sender")
            or item.get("role")
            or ""
        ).lower()

        if "customer" not in sender and "user" not in sender:
            continue

        message = (
            item.get("message_text")
            or item.get("text")
            or item.get("content")
            or item.get("message")
            or ""
        )

        if message:
            messages.append(str(message))

    return messages


def detect_intent(message: str, history: list[dict[str, Any]] | None = None) -> str:
    """Detect the customer's primary support intent."""

    text = _normalize_text(message)

    scores: dict[str, int] = {}

    for intent, keywords in INTENT_KEYWORDS.items():
        score = _keyword_matches(text, keywords)

        if score:
            scores[intent] = score

    # Use recent customer context if the current message is ambiguous.
    if not scores:
        customer_history = _customer_history(history)

        if customer_history:
            recent_context = _normalize_text(" ".join(customer_history[-3:]))

            for intent, keywords in INTENT_KEYWORDS.items():
                score = _keyword_matches(recent_context, keywords)

                if score:
                    scores[intent] = score

    if not scores:
        return "general_inquiry"

    # More specific intents take priority over generic inquiry.
    priority = [
        "refund_status",
        "cancellation",
        "delivery_issue",
        "payment_issue",
        "account_issue",
        "return_exchange",
        "complaint",
        "general_inquiry",
    ]

    return max(
        scores,
        key=lambda intent: (
            scores[intent],
            -priority.index(intent),
        ),
    )


def detect_emotion(message: str) -> str:
    """Detect the dominant customer emotional state."""

    text = _normalize_text(message)

    scores = {
        emotion: _keyword_matches(text, keywords)
        for emotion, keywords in EMOTION_KEYWORDS.items()
    }

    strongest_emotion = max(scores, key=scores.get)

    if scores[strongest_emotion] > 0:
        return strongest_emotion

    return "neutral"


def detect_sentiment(message: str) -> str:
    """Classify message sentiment as Positive, Neutral, or Negative."""

    text = _normalize_text(message)

    positive_score = _keyword_matches(
        text,
        list(POSITIVE_WORDS),
    )

    negative_score = _keyword_matches(
        text,
        list(NEGATIVE_WORDS),
    )

    if negative_score > positive_score:
        return "Negative"

    if positive_score > negative_score:
        return "Positive"

    # Strong punctuation can indicate emotional negativity.
    if text.count("!") >= 2 or text.count("?") >= 3:
        return "Negative"

    return "Neutral"


def calculate_frustration(
    message: str,
    history: list[dict[str, Any]] | None = None,
) -> int:
    """Calculate frustration on a 0-10 scale."""

    text = _normalize_text(message)
    customer_history = _customer_history(history)

    score = 0.0

    negative_count = _keyword_matches(text, list(NEGATIVE_WORDS))
    frustration_count = _keyword_matches(
        text,
        EMOTION_KEYWORDS["frustrated"],
    )
    angry_count = _keyword_matches(
        text,
        EMOTION_KEYWORDS["angry"],
    )

    score += min(3.0, negative_count * 0.8)
    score += min(3.0, frustration_count * 1.2)
    score += min(2.5, angry_count * 1.5)

    # Repeated punctuation is a strong frustration signal.
    if "!!" in text:
        score += 1.0

    if text.count("?") >= 3:
        score += 0.75

    # Escalation requests increase frustration.
    escalation_matches = _keyword_matches(
        text,
        ESCALATION_PHRASES,
    )
    score += min(2.0, escalation_matches * 1.0)

    # Repeated customer complaints in the conversation increase frustration.
    if customer_history:
        repeated_terms = [
            "still",
            "again",
            "already",
            "explained",
            "told",
            "same",
            "yet",
        ]

        repetition_score = _keyword_matches(text, repeated_terms)

        score += min(2.0, repetition_score * 0.5)

        # Multiple prior customer turns without positive resolution.
        if len(customer_history) >= 3:
            score += 0.75

    return _clamp(score, 0, 10)


def _sentiment_value(sentiment: str) -> int:
    normalized = sentiment.lower()

    if normalized == "positive":
        return 1

    if normalized == "negative":
        return -1

    return 0


def determine_satisfaction_trend(
    message: str,
    history: list[dict[str, Any]] | None = None,
) -> str:
    """Determine whether customer satisfaction is improving, declining, or stable."""

    customer_history = _customer_history(history)

    if not customer_history:
        current_sentiment = detect_sentiment(message)

        if current_sentiment == "Positive":
            return "Improving"

        if current_sentiment == "Negative":
            return "Declining"

        return "Stable"

    # Analyze the most recent customer messages and compare them.
    recent_messages = customer_history[-4:]
    recent_messages.append(message)

    sentiment_values = [
        _sentiment_value(detect_sentiment(item))
        for item in recent_messages
    ]

    if len(sentiment_values) < 2:
        return "Stable"

    previous_value = sentiment_values[-2]
    current_value = sentiment_values[-1]

    if current_value > previous_value:
        return "Improving"

    if current_value < previous_value:
        return "Declining"

    # Also compare frustration when sentiment stays in the same class.
    previous_frustration = calculate_frustration(
        recent_messages[-2],
        recent_messages[:-2],
    )

    current_frustration = calculate_frustration(
        message,
        recent_messages[:-1],
    )

    if current_frustration <= previous_frustration - 2:
        return "Improving"

    if current_frustration >= previous_frustration + 2:
        return "Declining"

    return "Stable"


def detect_escalation_risk(
    frustration_level: int,
    message: str,
    history: list[dict[str, Any]] | None = None,
) -> str:
    """Detect Low, Medium, or High escalation risk."""

    text = _normalize_text(message)
    customer_history = _customer_history(history)

    escalation_matches = _keyword_matches(
        text,
        ESCALATION_PHRASES,
    )

    high_risk_phrases = [
        "legal action",
        "lawyer",
        "consumer court",
        "chargeback",
        "close my account",
        "report you",
    ]

    high_risk_match = any(
        phrase in text
        for phrase in high_risk_phrases
    )

    if (
        frustration_level >= 8
        or high_risk_match
        or escalation_matches >= 2
    ):
        return "High"

    if (
        frustration_level >= 5
        or escalation_matches >= 1
        or len(customer_history) >= 4
    ):
        return "Medium"

    return "Low"


def calculate_confidence(
    message: str,
    intent: str,
    emotion: str,
    sentiment: str,
) -> float:
    """Calculate deterministic confidence for the classification."""

    text = _normalize_text(message)

    intent_matches = _keyword_matches(
        text,
        INTENT_KEYWORDS.get(intent, []),
    )

    emotion_matches = _keyword_matches(
        text,
        EMOTION_KEYWORDS.get(emotion, []),
    ) if emotion != "neutral" else 0

    confidence = 0.60

    if intent_matches:
        confidence += min(0.20, intent_matches * 0.07)

    if emotion_matches:
        confidence += min(0.12, emotion_matches * 0.06)

    if sentiment != "Neutral":
        confidence += 0.04

    if len(text.split()) >= 8:
        confidence += 0.03

    return round(min(0.99, confidence), 2)


def analyze_customer_message(
    message: str,
    conversation_history: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Analyze one customer message with conversation context."""

    message = (message or "").strip()

    if not message:
        raise ValueError("Customer message cannot be empty.")

    intent = detect_intent(
        message,
        conversation_history,
    )

    emotion = detect_emotion(message)

    sentiment = detect_sentiment(message)

    frustration_level = calculate_frustration(
        message,
        conversation_history,
    )

    satisfaction_trend = determine_satisfaction_trend(
        message,
        conversation_history,
    )

    escalation_risk = detect_escalation_risk(
        frustration_level,
        message,
        conversation_history,
    )

    confidence = calculate_confidence(
        message=message,
        intent=intent,
        emotion=emotion,
        sentiment=sentiment,
    )

    return {
        "intent": intent,
        "emotion": emotion,
        "sentiment": sentiment,
        "frustration_level": frustration_level,
        "satisfaction_trend": satisfaction_trend,
        "escalation_risk": escalation_risk,
        "confidence": confidence,
    }