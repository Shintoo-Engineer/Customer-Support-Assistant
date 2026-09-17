"""Tests for Task 4 Phase 2: Intent, Emotion, Sentiment, and State Analysis Intelligence.

Includes unit tests, 25+ real customer scenarios, context tests, and API integration tests.
"""

import os
import sys
from unittest.mock import MagicMock, patch
import pytest

# Ensure GEMINI_API_KEY is configured so imports succeed
os.environ.setdefault("GEMINI_API_KEY", "mock_key_for_testing")

for mod in ["google", "google.genai", "pypdf", "sentence_transformers", "chromadb"]:
    if mod not in sys.modules:
        try:
            __import__(mod)
        except ImportError:
            sys.modules[mod] = MagicMock()

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.models.database import Base
from app.models.simulator import Scenario, Session as SimSession, Conversation, Message
from app.api.analysis import get_db as get_analysis_db
from app.api.simulator import get_db as get_simulator_db
from app.schemas.analysis import (
    CustomerIntent,
    CustomerEmotion,
    CustomerSentiment,
    SatisfactionTrend,
    EscalationRisk,
    AnalysisResponse,
)
from app.services.analysis_service import (
    classify_intent_deterministic,
    classify_emotion_deterministic,
    classify_sentiment_deterministic,
    calculate_frustration_level,
    determine_satisfaction_trend,
    determine_escalation_risk,
    calculate_confidence,
    detect_escalation_request,
    detect_repeated_complaint,
    build_analysis_prompt,
    parse_llm_json,
    analyze_customer_message,
    get_conversation_context,
)


# ---------------------------------------------------------------------------
# Isolated Test Database Fixture
# ---------------------------------------------------------------------------

TEST_DB_FILE = "test_analysis_phase2.db"
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
def setup_test_db():
    """Sets up isolated SQLite test DB and overrides FastAPI dependencies."""
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

    app.dependency_overrides[get_analysis_db] = override_get_db
    app.dependency_overrides[get_simulator_db] = override_get_db

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
# 1. Intent Classification Tests (All 8 Required Intents)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("message,expected_intent", [
    ("I want my money back for this subscription.", CustomerIntent.REFUND),
    ("Please issue a full refund back to my card.", CustomerIntent.REFUND),
    ("Cancel my monthly subscription immediately.", CustomerIntent.CANCELLATION),
    ("I want to terminate my account and stop renewal.", CustomerIntent.CANCELLATION),
    ("Where is my package? The tracking has not updated.", CustomerIntent.DELIVERY_ISSUE),
    ("My delivery is three days late and the courier is lost.", CustomerIntent.DELIVERY_ISSUE),
    ("My credit card keeps getting declined with error code 04.", CustomerIntent.PAYMENT_ISSUE),
    ("Why was my checkout payment failed on your site?", CustomerIntent.PAYMENT_ISSUE),
    ("I'm locked out of my corporate account after losing my 2FA.", CustomerIntent.ACCOUNT_ISSUE),
    ("Cannot log in to my account, please reset my access.", CustomerIntent.ACCOUNT_ISSUE),
    ("Your service is terrible, completely unacceptable.", CustomerIntent.COMPLAINT),
    ("This is the worst customer support experience ever.", CustomerIntent.COMPLAINT),
    ("I want to return this item and get a replacement.", CustomerIntent.RETURN_EXCHANGE),
    ("Can I exchange this shirt for a different size?", CustomerIntent.RETURN_EXCHANGE),
    ("What are your business support hours and pricing tiers?", CustomerIntent.GENERAL_INQUIRY),
    ("Where can I find more information about your plans?", CustomerIntent.GENERAL_INQUIRY),
])
def test_intent_classification_all_categories(message, expected_intent):
    intent = classify_intent_deterministic(message, dialogue_history=[])
    assert intent == expected_intent


# ---------------------------------------------------------------------------
# 2. Emotion Classification Tests (All 7 Required Emotions)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("message,expected_emotion", [
    ("Thank you so much! You guys are amazing and fantastic!", CustomerEmotion.HAPPY),
    ("What is your phone number?", CustomerEmotion.NEUTRAL),
    ("I don't understand what this error code means at all.", CustomerEmotion.CONFUSED),
    ("I am worried that my credit card was charged twice.", CustomerEmotion.WORRIED),
    ("I've been waiting for hours, this is taking way too long!", CustomerEmotion.FRUSTRATED),
    ("This is completely unacceptable! Fix this right NOW!", CustomerEmotion.ANGRY),
    ("Everything is resolved and working now. Thank you for your help!", CustomerEmotion.SATISFIED),
])
def test_emotion_classification_all_categories(message, expected_emotion):
    emotion = classify_emotion_deterministic(message)
    assert emotion == expected_emotion


# ---------------------------------------------------------------------------
# 3. Sentiment Classification Tests (All 3 Categories)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("message,emotion,expected_sentiment", [
    ("Thank you for your quick help, all sorted!", CustomerEmotion.SATISFIED, CustomerSentiment.POSITIVE),
    ("I'm so happy with this result!", CustomerEmotion.HAPPY, CustomerSentiment.POSITIVE),
    ("Please check the delivery status of order 123.", CustomerEmotion.NEUTRAL, CustomerSentiment.NEUTRAL),
    ("I am so tired of this delay and incompetence.", CustomerEmotion.FRUSTRATED, CustomerSentiment.NEGATIVE),
    ("Get me your manager right now, this is ridiculous!", CustomerEmotion.ANGRY, CustomerSentiment.NEGATIVE),
])
def test_sentiment_classification(message, emotion, expected_sentiment):
    sentiment = classify_sentiment_deterministic(message, emotion)
    assert sentiment == expected_sentiment


# ---------------------------------------------------------------------------
# 4. Frustration Scoring Engine Tests (Bounded [0, 10])
# ---------------------------------------------------------------------------

def test_frustration_calm_message():
    """Calm/happy message produces low frustration (0-2)."""
    score = calculate_frustration_level(
        message="Thank you so much for answering my question.",
        emotion=CustomerEmotion.HAPPY,
        sentiment=CustomerSentiment.POSITIVE,
        dialogue_history=[],
        has_escalation_req=False,
        has_repeated=False
    )
    assert 0 <= score <= 2


def test_frustration_confused_message():
    """Confused message produces moderate frustration (2-4)."""
    score = calculate_frustration_level(
        message="I'm a bit confused about how to reset my password.",
        emotion=CustomerEmotion.CONFUSED,
        sentiment=CustomerSentiment.NEUTRAL,
        dialogue_history=[],
        has_escalation_req=False,
        has_repeated=False
    )
    assert 2 <= score <= 5


def test_frustration_angry_escalation_message():
    """Angry message with escalation request and shouting produces high frustration (8-10)."""
    score = calculate_frustration_level(
        message="THIS IS RIDICULOUS!! Get me your manager right now! I've had enough!!",
        emotion=CustomerEmotion.ANGRY,
        sentiment=CustomerSentiment.NEGATIVE,
        dialogue_history=[],
        has_escalation_req=True,
        has_repeated=True
    )
    assert 8 <= score <= 10


def test_frustration_strictly_bounded():
    """Extreme inputs are clamped strictly within [0, 10]."""
    # Extremely negative / shouting
    extreme_high = calculate_frustration_level(
        message="ANGRY FIX NOW " * 20 + "!!!!!!",
        emotion=CustomerEmotion.ANGRY,
        sentiment=CustomerSentiment.NEGATIVE,
        dialogue_history=[{"sender_type": "Customer", "message_text": "Bad"} for _ in range(10)],
        has_escalation_req=True,
        has_repeated=True
    )
    assert extreme_high == 10

    # Extremely positive
    extreme_low = calculate_frustration_level(
        message="Thank you so much, everything is completely resolved and wonderful!",
        emotion=CustomerEmotion.HAPPY,
        sentiment=CustomerSentiment.POSITIVE,
        dialogue_history=[],
        has_escalation_req=False,
        has_repeated=False
    )
    assert extreme_low == 0 or extreme_low == 1


# ---------------------------------------------------------------------------
# 5. Conversation Context & Trend Tests
# ---------------------------------------------------------------------------

def test_contextual_pronominal_intent_resolution():
    """Ambiguous follow-up ('can I get that money back?') resolves to 'refund' using history."""
    history = [
        {"sender_type": "Customer", "message_text": "I was charged $49.99 for my renewal last week."},
        {"sender_type": "Support Agent", "message_text": "Let me look up your invoice details."}
    ]
    intent = classify_intent_deterministic("Can I get that money back?", history, scenario_category="refund")
    assert intent == CustomerIntent.REFUND


def test_repeated_complaint_detection():
    """Repeated complaint triggers detection and increases frustration."""
    history = [
        {"sender_type": "Customer", "message_text": "My package hasn't arrived."},
        {"sender_type": "Support Agent", "message_text": "Checking shipping status."},
        {"sender_type": "Customer", "message_text": "Where is my item? It's still missing."},
    ]
    current_msg = "I already told you my order is late! Why haven't you fixed this?"
    assert detect_repeated_complaint(current_msg, history) is True


def test_satisfaction_trend_improving():
    """Progression from high frustration to resolved yields 'improving' trend."""
    history = [
        {"sender_type": "Customer", "message_text": "This service is terrible and I'm very angry!"},
        {"sender_type": "Support Agent", "message_text": "I have processed a full refund for you."}
    ]
    trend = determine_satisfaction_trend(
        current_frustration=1,
        current_sentiment=CustomerSentiment.POSITIVE,
        dialogue_history=history
    )
    assert trend == SatisfactionTrend.IMPROVING


def test_satisfaction_trend_declining():
    """Progression from calm inquiry to angry frustration yields 'declining' trend."""
    history = [
        {"sender_type": "Customer", "message_text": "Hi, could you check the status of my order?"},
        {"sender_type": "Support Agent", "message_text": "We cannot help you, check back later."}
    ]
    trend = determine_satisfaction_trend(
        current_frustration=8,
        current_sentiment=CustomerSentiment.NEGATIVE,
        dialogue_history=history
    )
    assert trend == SatisfactionTrend.DECLINING


def test_satisfaction_trend_stable():
    """Turn 1 or consistent emotional tone yields 'stable' trend."""
    trend_turn1 = determine_satisfaction_trend(
        current_frustration=3,
        current_sentiment=CustomerSentiment.NEUTRAL,
        dialogue_history=[]
    )
    assert trend_turn1 == SatisfactionTrend.STABLE


# ---------------------------------------------------------------------------
# 6. Escalation Risk Tests
# ---------------------------------------------------------------------------

def test_escalation_risk_high():
    """Explicit manager request yields HIGH escalation risk."""
    risk = determine_escalation_risk(
        frustration_level=9,
        emotion=CustomerEmotion.ANGRY,
        sentiment=CustomerSentiment.NEGATIVE,
        has_escalation_req=True,
        has_repeated=True
    )
    assert risk == EscalationRisk.HIGH


def test_escalation_risk_medium():
    """Frustrated customer with moderate frustration yields MEDIUM escalation risk."""
    risk = determine_escalation_risk(
        frustration_level=6,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        has_escalation_req=False,
        has_repeated=False
    )
    assert risk == EscalationRisk.MEDIUM


def test_escalation_risk_low():
    """Calm customer with low frustration yields LOW escalation risk."""
    risk = determine_escalation_risk(
        frustration_level=2,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        has_escalation_req=False,
        has_repeated=False
    )
    assert risk == EscalationRisk.LOW


# ---------------------------------------------------------------------------
# 7. Confidence Calibration Tests
# ---------------------------------------------------------------------------

def test_confidence_calibration():
    """Confidence score is calculated meaningfully and bounded within [0.0, 1.0]."""
    conf_high = calculate_confidence(
        emotion=CustomerEmotion.ANGRY,
        sentiment=CustomerSentiment.NEGATIVE,
        intent=CustomerIntent.REFUND,
        has_signals=True,
        used_llm=True
    )
    assert 0.85 <= conf_high <= 1.0

    conf_mismatch = calculate_confidence(
        emotion=CustomerEmotion.HAPPY,
        sentiment=CustomerSentiment.NEGATIVE,
        intent=CustomerIntent.GENERAL_INQUIRY,
        has_signals=False,
        used_llm=False
    )
    assert 0.0 <= conf_mismatch < 0.85


# ---------------------------------------------------------------------------
# 8. 25+ Real-World Customer Scenarios Matrix
# ---------------------------------------------------------------------------

SCENARIOS_DATASET = [
    # 1-5: Refund Scenarios
    ("I need a full refund of $49.99 for the renewal I cancelled.", CustomerIntent.REFUND, CustomerEmotion.NEUTRAL),
    ("You charged me twice for the same purchase! Give me my refund!", CustomerIntent.REFUND, CustomerEmotion.ANGRY),
    ("Where is my refund? It's been 10 business days already.", CustomerIntent.REFUND, CustomerEmotion.FRUSTRATED),
    ("Can you please reimburse the shipping charge as promised?", CustomerIntent.REFUND, CustomerEmotion.NEUTRAL),
    ("I am worried that my refund was sent to the wrong bank account.", CustomerIntent.REFUND, CustomerEmotion.WORRIED),

    # 6-10: Cancellation Scenarios
    ("Please cancel my subscription immediately, I don't need it.", CustomerIntent.CANCELLATION, CustomerEmotion.NEUTRAL),
    ("Stop charging my card! Cancel my membership right now!", CustomerIntent.CANCELLATION, CustomerEmotion.ANGRY),
    ("I want to unsubscribe and turn off auto-renewal for next month.", CustomerIntent.CANCELLATION, CustomerEmotion.NEUTRAL),
    ("I'm confused about how to terminate my account online.", CustomerIntent.CANCELLATION, CustomerEmotion.CONFUSED),
    ("I am happy to cancel my trial before the renewal date.", CustomerIntent.CANCELLATION, CustomerEmotion.HAPPY),

    # 11-15: Delivery Issue Scenarios
    ("My package #ORD-78219 is three days late. Where is it?", CustomerIntent.DELIVERY_ISSUE, CustomerEmotion.NEUTRAL),
    ("The tracking says delivered but I never received my order!", CustomerIntent.DELIVERY_ISSUE, CustomerEmotion.WORRIED),
    ("Still waiting for my delivery! The courier exception has not cleared!", CustomerIntent.DELIVERY_ISSUE, CustomerEmotion.FRUSTRATED),
    ("Why hasn't my item shipped yet? It's been a whole week!", CustomerIntent.DELIVERY_ISSUE, CustomerEmotion.FRUSTRATED),
    ("The delivery arrived and it was completely smashed and damaged!", CustomerIntent.DELIVERY_ISSUE, CustomerEmotion.ANGRY),

    # 16-20: Payment & Account Scenarios
    ("My card was declined with error code ERR_PAYMENT_FAILED_04.", CustomerIntent.PAYMENT_ISSUE, CustomerEmotion.NEUTRAL),
    ("The 3D-Secure verification keeps timing out during payment.", CustomerIntent.PAYMENT_ISSUE, CustomerEmotion.CONFUSED),
    ("I've been locked out of my corporate account after losing my 2FA.", CustomerIntent.ACCOUNT_ISSUE, CustomerEmotion.WORRIED),
    ("I forgot my password and the reset link is not arriving in my inbox.", CustomerIntent.ACCOUNT_ISSUE, CustomerEmotion.CONFUSED),
    ("I cannot log into my account, this is urgent for my team!", CustomerIntent.ACCOUNT_ISSUE, CustomerEmotion.FRUSTRATED),

    # 21-25: Complaint, Returns & General Inquiry
    ("Your customer service is completely incompetent and terrible!", CustomerIntent.COMPLAINT, CustomerEmotion.ANGRY),
    ("I want to file a formal complaint against the agent who hung up.", CustomerIntent.COMPLAINT, CustomerEmotion.ANGRY),
    ("I want to exchange this jacket for a larger size please.", CustomerIntent.RETURN_EXCHANGE, CustomerEmotion.NEUTRAL),
    ("Can I return this defective item for a replacement?", CustomerIntent.RETURN_EXCHANGE, CustomerEmotion.NEUTRAL),
    ("What are your customer support working hours on weekends?", CustomerIntent.GENERAL_INQUIRY, CustomerEmotion.NEUTRAL),
    ("Thank you so much, everything is completely resolved and working!", CustomerIntent.GENERAL_INQUIRY, CustomerEmotion.SATISFIED),
]

@pytest.mark.parametrize("text,expected_intent,expected_emotion", SCENARIOS_DATASET)
def test_dataset_scenario_coverage(text, expected_intent, expected_emotion):
    """Verifies that all 26 distinct customer scenarios classify accurately."""
    intent = classify_intent_deterministic(text, dialogue_history=[])
    emotion = classify_emotion_deterministic(text)
    assert intent == expected_intent
    assert emotion == expected_emotion


# ---------------------------------------------------------------------------
# 9. LLM Integration, Mocking & Fallback Tests
# ---------------------------------------------------------------------------

def test_parse_llm_json_clean_and_fenced():
    """parse_llm_json handles raw JSON and markdown code fences."""
    raw_fenced = "```json\n{\"intent\": \"refund\", \"emotion\": \"angry\", \"sentiment\": \"negative\", \"confidence\": 0.95}\n```"
    parsed = parse_llm_json(raw_fenced)
    assert parsed is not None
    assert parsed["intent"] == "refund"
    assert parsed["confidence"] == 0.95


def test_llm_fallback_on_exception():
    """When Gemini raises an exception, service falls back to deterministic analysis safely."""
    db = TestingSessionLocal()
    try:
        scenario = Scenario(title="Fallback Test", category="refund", difficulty="Low")
        db.add(scenario)
        db.flush()
        session = SimSession(scenario_id=scenario.scenario_id)
        db.add(session)
        db.commit()

        with patch("app.services.analysis_service.generate_with_gemini", side_effect=Exception("API Quota Exceeded")):
            response = analyze_customer_message(
                session_id=session.session_id,
                customer_message="I want my refund right now!",
                db=db
            )
            assert isinstance(response, AnalysisResponse)
            assert response.intent == CustomerIntent.REFUND
            assert response.emotion == CustomerEmotion.ANGRY
            assert response.sentiment == CustomerSentiment.NEGATIVE
            assert response.frustration_level >= 7
            assert 0.0 <= response.confidence <= 1.0
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 10. API Integration Tests (POST /analysis/analyze)
# ---------------------------------------------------------------------------

def test_api_multi_turn_analysis_with_context(client):
    """Verifies full API execution on a multi-turn session with database persistence."""
    # 1. Start a session
    start_resp = client.post("/simulator/start", json={
        "session_label": "Phase 2 Multi-Turn Analysis",
        "persona": "angry",
        "scenario": "refund",
        "initial_emotion": "angry",
        "issue_severity": 4,
        "patience_level": 2,
        "expected_resolution": "Full refund"
    })
    assert start_resp.status_code == 200
    session_id = start_resp.json()["session_id"]

    # 2. Analyze Turn 1 customer opening message
    analysis_resp_1 = client.post("/analysis/analyze", json={
        "session_id": session_id,
        "customer_message": "I was charged $49.99 for a subscription renewal I requested to cancel. I need a refund immediately!"
    })
    assert analysis_resp_1.status_code == 200
    data_1 = analysis_resp_1.json()
    assert data_1["intent"] == "refund"
    assert data_1["sentiment"] == "negative"
    assert data_1["frustration_level"] >= 6
    assert data_1["satisfaction_trend"] == "stable"

    # 3. Simulate an empathetic agent response in simulator
    client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "I sincerely apologize. I have processed your full refund right away."
    })

    # 4. Analyze Turn 2 customer de-escalated message
    analysis_resp_2 = client.post("/analysis/analyze", json={
        "session_id": session_id,
        "customer_message": "Thank you, that solves my problem completely. It is resolved now."
    })
    assert analysis_resp_2.status_code == 200
    data_2 = analysis_resp_2.json()
    assert data_2["emotion"] in ["satisfied", "happy"]
    assert data_2["sentiment"] == "positive"
    assert data_2["frustration_level"] <= 2
    assert data_2["satisfaction_trend"] == "improving"
    assert data_2["escalation_risk"] == "low"
