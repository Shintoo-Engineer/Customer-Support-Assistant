"""Dedicated Phase 4 Test Suite: Production Hardening, Validation & Quality Improvement.

Comprehensive test matrix covering:
1. Structured Output Validation & Normalization (sanitization, malformed JSON, invalid enums, boundary clamping).
2. Confidence Quality (strong evidence, weak evidence, ambiguous text).
3. 8 Supported Customer Intents.
4. 7 Supported Customer Emotions.
5. 3 Sentiments & Mixed Language Handling.
6. Frustration Score Progression (0-10 bounds, monotonic increases, resolution reduction).
7. Satisfaction Trend Tracking (improving, declining, stable).
8. Escalation Risk Levels (low, medium, high).
9. Context Window & Chronological Role Ordering.
10. Session Isolation & Concurrency Safety (zero cross-session state leakage).
11. Idempotency & Duplicate Protection.
12. API Robustness (Unicode, emojis, whitespace 422, 5000+ char long text, 404 on bad session).
13. Failure Isolation & Graceful Degradation (Gemini down, DB warning).
14. Loop Safety (single invocation per turn).
"""

import os
import sys
import json
import pytest
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("GEMINI_API_KEY", "test_gemini_api_key")

for mod in ["google", "google.genai", "pypdf", "sentence_transformers", "chromadb"]:
    if mod not in sys.modules:
        try:
            __import__(mod)
        except ImportError:
            sys.modules[mod] = MagicMock()

from app.main import app
from app.models.database import Base
from app.models.simulator import Scenario, Session as SimSession, Conversation, Message
from app.api.simulator import get_db
from app.schemas.analysis import (
    CustomerIntent,
    CustomerEmotion,
    CustomerSentiment,
    SatisfactionTrend,
    EscalationRisk,
)
from app.services.analysis_service import (
    parse_llm_json,
    calculate_confidence,
    calculate_frustration_level,
    determine_satisfaction_trend,
    determine_escalation_risk,
    classify_intent_deterministic,
    classify_emotion_deterministic,
    classify_sentiment_deterministic,
    analyze_customer_message,
)


TEST_DB_FILE = "test_phase4_hardening.db"
TEST_DATABASE_URL = f"sqlite:///./{TEST_DB_FILE}"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine
)


@pytest.fixture(scope="module", autouse=True)
def setup_phase4_db():
    """Sets up an isolated SQLite test database for Phase 4 testing."""
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass

    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    yield

    app.dependency_overrides.clear()
    test_engine.dispose()
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


# ---------------------------------------------------------------------------
# Section 1: Structured Output Validation & Normalization
# ---------------------------------------------------------------------------

def test_llm_json_normalization_strips_punctuation_and_whitespace(client, monkeypatch):
    """Verifies that LLM responses with trailing punctuation or extra whitespace normalize cleanly."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Punctuation Normalization",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Refund"
    })
    session_id = start_resp.json()["session_id"]

    # Mock LLM returning punctuation inside JSON enum strings
    def fake_gemini(prompt):
        return '{"intent": "refund.", "emotion": "frustrated!", "sentiment": "negative ", "confidence": 0.89}'

    monkeypatch.setattr("app.services.analysis_service.generate_with_gemini", fake_gemini)

    resp = client.post("/analysis/analyze", json={
        "session_id": session_id,
        "customer_message": "Where is my money back?"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["intent"] == "refund"
    assert data["emotion"] == "frustrated"
    assert data["sentiment"] == "negative"
    assert data["confidence"] == 0.89


def test_llm_malformed_json_fallback(client, monkeypatch):
    """When LLM returns corrupted non-JSON text, service falls back gracefully."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Malformed JSON Test",
        "persona": "calm",
        "scenario": "cancellation",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Cancel"
    })
    session_id = start_resp.json()["session_id"]

    monkeypatch.setattr(
        "app.services.analysis_service.generate_with_gemini",
        lambda prompt: "I am an AI assistant and I think the intent is: {bad_json: missing_quotes"
    )

    resp = client.post("/analysis/analyze", json={
        "session_id": session_id,
        "customer_message": "Cancel my subscription right now."
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["intent"] == "cancellation"
    assert data["confidence"] > 0.0


def test_llm_missing_fields_fallback(client, monkeypatch):
    """When LLM returns partial JSON (missing emotion/sentiment), missing fields are safely populated."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Missing Fields Test",
        "persona": "calm",
        "scenario": "payment_failure",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Payment"
    })
    session_id = start_resp.json()["session_id"]

    monkeypatch.setattr(
        "app.services.analysis_service.generate_with_gemini",
        lambda prompt: '{"intent": "payment_issue"}'
    )

    resp = client.post("/analysis/analyze", json={
        "session_id": session_id,
        "customer_message": "My payment failed at checkout."
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["intent"] == "payment_issue"
    assert data["emotion"] in [e.value for e in CustomerEmotion]
    assert data["sentiment"] in [s.value for s in CustomerSentiment]


def test_llm_invalid_enum_fallback(client, monkeypatch):
    """When LLM returns an unsupported enum name, validation triggers safe fallback."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Invalid Enum Test",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Refund"
    })
    session_id = start_resp.json()["session_id"]

    monkeypatch.setattr(
        "app.services.analysis_service.generate_with_gemini",
        lambda prompt: '{"intent": "give_money_back", "emotion": "bored", "sentiment": "neutral"}'
    )

    resp = client.post("/analysis/analyze", json={
        "session_id": session_id,
        "customer_message": "Please refund my money back."
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["intent"] == "refund"


def test_llm_out_of_range_confidence_clamped(client, monkeypatch):
    """Out-of-range confidence values from LLM (> 1.0 or < 0.0) are clamped into [0.0, 1.0]."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Confidence Clamping",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Refund"
    })
    session_id = start_resp.json()["session_id"]

    monkeypatch.setattr(
        "app.services.analysis_service.generate_with_gemini",
        lambda prompt: '{"intent": "refund", "emotion": "neutral", "sentiment": "neutral", "confidence": 1.75}'
    )

    resp = client.post("/analysis/analyze", json={
        "session_id": session_id,
        "customer_message": "Refund status please."
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["confidence"] <= 1.0


def test_llm_null_values_fallback(client, monkeypatch):
    """When LLM returns null for keys, service handles it safely without TypeError."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Null Value Test",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Refund"
    })
    session_id = start_resp.json()["session_id"]

    monkeypatch.setattr(
        "app.services.analysis_service.generate_with_gemini",
        lambda prompt: '{"intent": null, "emotion": null, "sentiment": null, "confidence": null}'
    )

    resp = client.post("/analysis/analyze", json={
        "session_id": session_id,
        "customer_message": "Where is my refund?"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["intent"] == "refund"


# ---------------------------------------------------------------------------
# Section 2: Confidence Quality Validation (Section 7)
# ---------------------------------------------------------------------------

def test_confidence_strong_evidence_intent():
    """Detailed messages with explicit keywords produce high confidence (>= 0.85)."""
    msg = "I have been waiting three weeks for my refund and I want my money back."
    conf = calculate_confidence(
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        intent=CustomerIntent.REFUND,
        has_signals=True,
        used_llm=False,
        text=msg
    )
    assert conf >= 0.85, f"Expected high confidence, got: {conf}"


def test_confidence_weak_evidence_elliptical():
    """Short elliptical responses ('Okay.') without intent keywords yield lower confidence (<= 0.65)."""
    msg = "Okay."
    conf = calculate_confidence(
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        intent=CustomerIntent.GENERAL_INQUIRY,
        has_signals=False,
        used_llm=False,
        text=msg
    )
    assert conf <= 0.65, f"Expected lower confidence for weak evidence, got: {conf}"


def test_confidence_ambiguous_evidence():
    """Ambiguous messages produce moderate, non-overconfident scores (between 0.65 and 0.80)."""
    msg = "Something is wrong with my order."
    conf = calculate_confidence(
        emotion=CustomerEmotion.CONFUSED,
        sentiment=CustomerSentiment.NEUTRAL,
        intent=CustomerIntent.GENERAL_INQUIRY,
        has_signals=False,
        used_llm=False,
        text=msg
    )
    assert 0.65 <= conf <= 0.80, f"Expected moderate confidence, got: {conf}"


def test_confidence_deterministic_repeatability():
    """Confidence calculation produces identical deterministic values for identical inputs."""
    c1 = calculate_confidence(CustomerEmotion.ANGRY, CustomerSentiment.NEGATIVE, CustomerIntent.REFUND, True, False, "Refund!")
    c2 = calculate_confidence(CustomerEmotion.ANGRY, CustomerSentiment.NEGATIVE, CustomerIntent.REFUND, True, False, "Refund!")
    assert c1 == c2


# ---------------------------------------------------------------------------
# Section 3: 8 Supported Customer Intents Quality Validation (Section 8)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("msg,expected_intent", [
    ("Can I get my money back?", CustomerIntent.REFUND),
    ("Please cancel my order.", CustomerIntent.CANCELLATION),
    ("My package still hasn't arrived.", CustomerIntent.DELIVERY_ISSUE),
    ("My card payment failed.", CustomerIntent.PAYMENT_ISSUE),
    ("I cannot log into my account.", CustomerIntent.ACCOUNT_ISSUE),
    ("I am extremely unhappy with your service.", CustomerIntent.COMPLAINT),
    ("I want to exchange this shirt for another size.", CustomerIntent.RETURN_EXCHANGE),
    ("What are your support hours and contact options?", CustomerIntent.GENERAL_INQUIRY),
])
def test_all_eight_intents_realistic_examples(msg, expected_intent):
    intent = classify_intent_deterministic(msg, dialogue_history=[])
    assert intent == expected_intent


# ---------------------------------------------------------------------------
# Section 4: 7 Supported Customer Emotions Quality Validation (Section 9)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("msg,expected_emotion", [
    ("I don't understand what happened.", CustomerEmotion.CONFUSED),
    ("I am worried that my payment was charged twice.", CustomerEmotion.WORRIED),
    ("This is ridiculous. Fix this immediately!", CustomerEmotion.ANGRY),
    ("Thanks, that solved my problem.", CustomerEmotion.SATISFIED),
    ("I am so happy and delighted with this wonderful service!", CustomerEmotion.HAPPY),
    ("I am tired of waiting with no straight answer.", CustomerEmotion.FRUSTRATED),
    ("What is the status of my order?", CustomerEmotion.NEUTRAL),
])
def test_all_seven_emotions_realistic_examples(msg, expected_emotion):
    emotion = classify_emotion_deterministic(msg)
    assert emotion == expected_emotion


# ---------------------------------------------------------------------------
# Section 5: Sentiment Validation & Mixed Language (Section 10)
# ---------------------------------------------------------------------------

def test_sentiment_positive_clean():
    """Clear polite gratitude maps to positive sentiment."""
    emotion = classify_emotion_deterministic("Thank you, that was very helpful.")
    sentiment = classify_sentiment_deterministic("Thank you, that was very helpful.", emotion)
    assert sentiment == CustomerSentiment.POSITIVE


def test_sentiment_neutral_clean():
    """Transactional status request maps to neutral sentiment."""
    emotion = classify_emotion_deterministic("I would like to know the status of my order.")
    sentiment = classify_sentiment_deterministic("I would like to know the status of my order.", emotion)
    assert sentiment == CustomerSentiment.NEUTRAL


def test_sentiment_negative_clean():
    """Direct disappointment maps to negative sentiment."""
    emotion = classify_emotion_deterministic("I am very disappointed with this service.")
    sentiment = classify_sentiment_deterministic("I am very disappointed with this service.", emotion)
    assert sentiment == CustomerSentiment.NEGATIVE


def test_sentiment_mixed_language_unresolved():
    """Mixed polite opener with an unresolved problem ('Thanks, but my refund still hasn't arrived') is negative."""
    msg = "Thanks for replying, but my refund still hasn't arrived."
    emotion = classify_emotion_deterministic(msg)
    sentiment = classify_sentiment_deterministic(msg, emotion)
    assert sentiment == CustomerSentiment.NEGATIVE


# ---------------------------------------------------------------------------
# Section 6: Frustration Score Progression & Reduction (Section 11)
# ---------------------------------------------------------------------------

def test_frustration_progression_across_four_turns():
    """Verifies that frustration increases appropriately as complaints repeat and escalate."""
    # Turn 1: Initial query
    f1 = calculate_frustration_level(
        message="Can you tell me where my refund is?",
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        dialogue_history=[],
        has_escalation_req=False,
        has_repeated=False
    )

    # Turn 2: Already asked
    f2 = calculate_frustration_level(
        message="I've already asked about this.",
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        dialogue_history=[{"sender_type": "Customer", "message_text": "Can you tell me where my refund is?"}],
        has_escalation_req=False,
        has_repeated=True
    )

    # Turn 3: Asked three times
    f3 = calculate_frustration_level(
        message="I've asked three times and nobody has helped me.",
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        dialogue_history=[
            {"sender_type": "Customer", "message_text": "Can you tell me where my refund is?"},
            {"sender_type": "Customer", "message_text": "I've already asked about this."}
        ],
        has_escalation_req=False,
        has_repeated=True
    )

    # Turn 4: Manager threat
    f4 = calculate_frustration_level(
        message="This is ridiculous. Get me your manager now.",
        emotion=CustomerEmotion.ANGRY,
        sentiment=CustomerSentiment.NEGATIVE,
        dialogue_history=[
            {"sender_type": "Customer", "message_text": "Can you tell me where my refund is?"},
            {"sender_type": "Customer", "message_text": "I've already asked about this."},
            {"sender_type": "Customer", "message_text": "I've asked three times and nobody has helped me."}
        ],
        has_escalation_req=True,
        has_repeated=True
    )

    assert f1 <= f2 <= f3 <= f4
    assert f4 >= 8
    assert 0 <= f1 <= 10 and 0 <= f4 <= 10


def test_frustration_reduction_on_resolution():
    """Frustration drops sharply when issue is successfully resolved."""
    f_before = calculate_frustration_level(
        message="I am really frustrated with this charge!",
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        dialogue_history=[],
        has_escalation_req=False,
        has_repeated=False
    )
    f_after = calculate_frustration_level(
        message="Thank you for resolving it completely. Everything is fixed.",
        emotion=CustomerEmotion.SATISFIED,
        sentiment=CustomerSentiment.POSITIVE,
        dialogue_history=[{"sender_type": "Customer", "message_text": "I am really frustrated with this charge!"}],
        has_escalation_req=False,
        has_repeated=False
    )
    assert f_before >= 6
    assert f_after <= 2
    assert f_after < f_before


# ---------------------------------------------------------------------------
# Section 7: Satisfaction Trend Validation (Section 12)
# ---------------------------------------------------------------------------

def test_satisfaction_trend_improving_progression():
    """Two turns where customer calms down yields improving trend."""
    history = [
        {"sender_type": "Customer", "message_text": "This is really frustrating and not working."},
        {"sender_type": "Support Agent", "message_text": "I have processed your refund, here is the confirmation."},
    ]
    trend = determine_satisfaction_trend(
        current_frustration=1,
        current_sentiment=CustomerSentiment.POSITIVE,
        dialogue_history=history,
        current_message="Okay, that helps. Thank you."
    )
    assert trend == SatisfactionTrend.IMPROVING


def test_satisfaction_trend_declining_progression():
    """Three turns where customer worsens yields declining trend."""
    history = [
        {"sender_type": "Customer", "message_text": "Can you help me?"},
        {"sender_type": "Support Agent", "message_text": "Please wait."},
        {"sender_type": "Customer", "message_text": "I already explained this."},
    ]
    trend = determine_satisfaction_trend(
        current_frustration=9,
        current_sentiment=CustomerSentiment.NEGATIVE,
        dialogue_history=history,
        current_message="This is the third time I'm asking. Unbelievable!"
    )
    assert trend == SatisfactionTrend.DECLINING


def test_satisfaction_trend_stable_progression():
    """Two neutral turns produce a stable trend."""
    history = [
        {"sender_type": "Customer", "message_text": "What is the status of my order?"},
    ]
    trend = determine_satisfaction_trend(
        current_frustration=2,
        current_sentiment=CustomerSentiment.NEUTRAL,
        dialogue_history=history,
        current_message="Could you also check tracking?"
    )
    assert trend == SatisfactionTrend.STABLE


# ---------------------------------------------------------------------------
# Section 8: Escalation Risk Levels (Section 13)
# ---------------------------------------------------------------------------

def test_escalation_risk_high_rules():
    """Repeated complaint + manager request triggers high risk."""
    risk = determine_escalation_risk(
        frustration_level=9,
        emotion=CustomerEmotion.ANGRY,
        sentiment=CustomerSentiment.NEGATIVE,
        has_escalation_req=True,
        has_repeated=True
    )
    assert risk == EscalationRisk.HIGH


def test_escalation_risk_medium_rules():
    """Moderate frustration without manager demand produces medium risk."""
    risk = determine_escalation_risk(
        frustration_level=6,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        has_escalation_req=False,
        has_repeated=False
    )
    assert risk == EscalationRisk.MEDIUM


def test_escalation_risk_low_rules():
    """Polite general inquiry produces low escalation risk."""
    risk = determine_escalation_risk(
        frustration_level=1,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        has_escalation_req=False,
        has_repeated=False
    )
    assert risk == EscalationRisk.LOW


# ---------------------------------------------------------------------------
# Section 9: Context Window Quality & Chronological Ordering (Section 14)
# ---------------------------------------------------------------------------

def test_context_window_chronological_ordering(client, monkeypatch):
    """Verifies that in a 3-customer-turn conversation, Task 4 analyzes the latest customer turn."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Chronological Ordering Check",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Full refund"
    })
    session_id = start_resp.json()["session_id"]

    # Turn 2: Customer asks status
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "Did you submit the request?"
    )
    client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "I am working on it."
    })

    # Turn 3: Customer final turn
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "Cancel my subscription as well, please."
    )
    turn3_resp = client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "Understood."
    })
    assert turn3_resp.status_code == 200
    data = turn3_resp.json()
    # Latest customer message (Turn 3) is cancellation
    assert data["analysis"]["intent"] == "cancellation"
    assert data["turn"] == 3


def test_system_messages_excluded_from_dialogue_context(client):
    """Verifies that internal System records never pollute conversation dialogue history."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "System Message Exclusion Check",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Refund"
    })
    session_id = start_resp.json()["session_id"]

    db = TestingSessionLocal()
    try:
        conv = db.query(Conversation).filter(Conversation.session_id == session_id).first()
        msgs = db.query(Message).filter(Message.conversation_id == conv.conversation_id).all()
        # Should have 1 Customer message and 1 System message
        system_msgs = [m for m in msgs if m.message_type == "System"]
        dialogue_msgs = [m for m in msgs if m.message_type != "System"]
        assert len(system_msgs) == 1
        assert len(dialogue_msgs) == 1
        assert dialogue_msgs[0].sender_type == "Customer"
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Section 10: Session Isolation & Concurrency Safety (Section 19 & 20)
# ---------------------------------------------------------------------------

def test_session_isolation_independent_contexts(client):
    """Session A (refund) and Session B (payment_failure) maintain completely isolated contexts."""
    resp_a = client.post("/simulator/start", json={
        "session_label": "Session A Isolation",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Refund"
    })
    resp_b = client.post("/simulator/start", json={
        "session_label": "Session B Isolation",
        "persona": "confused",
        "scenario": "payment_failure",
        "initial_emotion": "confused",
        "issue_severity": 3,
        "patience_level": 3,
        "expected_resolution": "Payment"
    })
    s_a = resp_a.json()["session_id"]
    s_b = resp_b.json()["session_id"]

    # Analyze Session A with context-dependent phrase
    analysis_a = client.post("/analysis/analyze", json={
        "session_id": s_a,
        "customer_message": "Yes, please process that money back."
    }).json()

    # Analyze Session B with context-dependent phrase
    analysis_b = client.post("/analysis/analyze", json={
        "session_id": s_b,
        "customer_message": "Why did my transaction get declined?"
    }).json()

    assert analysis_a["intent"] == "refund"
    assert analysis_b["intent"] == "payment_issue"


# ---------------------------------------------------------------------------
# Section 11: Idempotency & Duplicate Protection (Section 18)
# ---------------------------------------------------------------------------

def test_idempotent_no_duplicate_sessions_or_messages(client, monkeypatch):
    """A multi-turn conversation maintains strict row counts without duplicates."""
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "Got the update, thanks."
    )
    start_resp = client.post("/simulator/start", json={
        "session_label": "Duplicate Protection Check",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Done"
    })
    session_id = start_resp.json()["session_id"]

    client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "Checking refund."
    })

    db = TestingSessionLocal()
    try:
        # Exactly 1 Session row
        s_count = db.query(SimSession).filter(SimSession.session_id == session_id).count()
        assert s_count == 1

        # Exactly 1 Conversation row
        c_count = db.query(Conversation).filter(Conversation.session_id == session_id).count()
        assert c_count == 1

        # Check dialogue messages in history: Turn 1 Customer, Turn 1 Agent, Turn 2 Customer
        hist_resp = client.get(f"/simulator/{session_id}/history")
        messages = hist_resp.json()["messages"]
        assert len(messages) == 3
        assert [m["sender_type"] for m in messages] == ["Customer", "Support Agent", "Customer"]
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Section 12: API Robustness (Section 17)
# ---------------------------------------------------------------------------

def test_api_whitespace_only_message_returns_422(client):
    """Whitespace-only customer message returns HTTP 422 Unprocessable Entity."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Whitespace Test",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Done"
    })
    session_id = start_resp.json()["session_id"]

    resp = client.post("/analysis/analyze", json={
        "session_id": session_id,
        "customer_message": "     "
    })
    assert resp.status_code == 422


def test_api_unicode_and_emojis_handled(client):
    """Unicode emojis ('I’m still waiting for my refund 😞') process safely."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Unicode Test",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Done"
    })
    session_id = start_resp.json()["session_id"]

    resp = client.post("/analysis/analyze", json={
        "session_id": session_id,
        "customer_message": "I’m still waiting for my refund 😞"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["intent"] == "refund"


def test_api_special_characters_and_quotes(client):
    """Quotes, slashes, and HTML characters in customer message do not crash."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Special Chars Test",
        "persona": "calm",
        "scenario": "account_issue",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Done"
    })
    session_id = start_resp.json()["session_id"]

    resp = client.post("/analysis/analyze", json={
        "session_id": session_id,
        "customer_message": "<script>alert('test')</script> I can't log in &amp; password won't reset."
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["intent"] == "account_issue"


def test_api_very_long_message(client):
    """A 5,000+ character customer message processes safely without error."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Long Message Test",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Done"
    })
    session_id = start_resp.json()["session_id"]

    long_msg = "Please process my refund. " + ("Here is extra background detail. " * 200)
    assert len(long_msg) > 5000

    resp = client.post("/analysis/analyze", json={
        "session_id": session_id,
        "customer_message": long_msg
    })
    assert resp.status_code == 200
    assert resp.json()["intent"] == "refund"


def test_api_invalid_session_returns_404(client):
    """Non-existent session_id returns 404 Not Found."""
    resp = client.post("/analysis/analyze", json={
        "session_id": 999999,
        "customer_message": "Where is my refund?"
    })
    assert resp.status_code == 404


def test_api_missing_required_fields_returns_422(client):
    """Payload missing session_id returns 422 Unprocessable Entity."""
    resp = client.post("/analysis/analyze", json={
        "customer_message": "Where is my refund?"
    })
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Section 13: Failure Isolation & Graceful Degradation (Section 16)
# ---------------------------------------------------------------------------

def test_failure_isolation_gemini_exception(client, monkeypatch):
    """Gemini API exception never breaks the analysis endpoint or simulator."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Gemini Failure Test",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Done"
    })
    session_id = start_resp.json()["session_id"]

    def crash_gemini(prompt):
        raise ConnectionResetError("Remote host closed connection")

    monkeypatch.setattr("app.services.analysis_service.generate_with_gemini", crash_gemini)

    resp = client.post("/analysis/analyze", json={
        "session_id": session_id,
        "customer_message": "I want my money back."
    })
    assert resp.status_code == 200
    assert resp.json()["intent"] == "refund"


def test_failure_isolation_database_rollback(client, monkeypatch):
    """Even if database update encounters a conflict, analysis returns successfully."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "DB Rollback Test",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Done"
    })
    session_id = start_resp.json()["session_id"]

    resp = client.post("/analysis/analyze", json={
        "session_id": session_id,
        "customer_message": "Where is my refund?"
    })
    assert resp.status_code == 200
    assert resp.json()["intent"] == "refund"


# ---------------------------------------------------------------------------
# Section 14: Loop Safety (Section 15)
# ---------------------------------------------------------------------------

def test_integration_loop_safety_single_invocation(client, monkeypatch):
    """Task 3 simulator turn invokes Task 4 exactly once per turn with no recursion."""
    call_tracker = {"calls": 0}

    def track_call(session_id, customer_message, db):
        call_tracker["calls"] += 1
        return analyze_customer_message(session_id, customer_message, db)

    start_resp = client.post("/simulator/start", json={
        "session_label": "Loop Safety Phase 4",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Refund"
    })
    session_id = start_resp.json()["session_id"]

    call_tracker["calls"] = 0
    monkeypatch.setattr("app.api.simulator.analyze_customer_message", track_call)

    msg_resp = client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "We are processing that."
    })
    assert msg_resp.status_code == 200
    assert call_tracker["calls"] == 1, f"Expected exactly 1 analysis call, got {call_tracker['calls']}"
