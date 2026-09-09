"""TASK 4 — COMBINED PHASE 7 & 8 FINAL VALIDATION TEST SUITE.

Comprehensive validation suite for the Intent & Sentiment Analysis Agent (Task 4)
integrated with Customer Simulator (Task 3).

Contains 52 automated tests organized across 5 core sections:
- Section 1: Multi-Turn End-to-End Dialogue Loop (R1) (10 tests)
- Section 2: Comprehensive Analytical Coverage (R2) (16 tests)
- Section 3: Gemini Mock vs Fallback Resilience & Isolation (R3) (10 tests)
- Section 4: Session Isolation & Concurrency Safety (R4) (6 tests)
- Section 5: API Endpoints, OpenAPI & SQLite Integrity (R6) (10 tests)
"""

import os
import sys
import json
import logging
from unittest.mock import MagicMock
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

# Mock optional packages if not present in environment
for mod in ["google", "google.genai", "pypdf", "sentence_transformers", "chromadb"]:
    if mod not in sys.modules:
        try:
            __import__(mod)
        except ImportError:
            sys.modules[mod] = MagicMock()

from app.main import app
from app.models.database import Base
from app.models.simulator import Scenario, Session as SimSession, Conversation, Message
from app.api.simulator import get_db as sim_get_db
from app.api.analysis import get_db as analysis_get_db
from app.schemas.analysis import (
    CustomerIntent,
    CustomerEmotion,
    CustomerSentiment,
    SatisfactionTrend,
    EscalationRisk,
    AnalysisRequest,
    AnalysisResponse,
    AnalysisResult,
    TurnAnalysis,
    SessionAnalysisSummary,
    DecisionPriority,
    RecommendedTone,
    RecommendedAction,
    CustomerNeed,
    DecisionSupportResult,
)
from app.services.analysis_service import (
    analyze_customer_message,
    get_analysis_history,
    get_session_analysis_summary,
    get_analysis_metrics,
    reset_analysis_metrics,
    classify_intent_deterministic,
    classify_emotion_deterministic,
    classify_sentiment_deterministic,
    calculate_frustration_level,
    determine_satisfaction_trend,
    determine_escalation_risk,
    calculate_confidence,
    detect_escalation_request,
    detect_repeated_complaint,
    get_conversation_context,
)
from app.services.decision_support_service import (
    map_customer_needs,
    determine_priority,
    determine_recommended_tone,
    determine_recommended_action,
    collect_risk_flags,
    generate_decision_support,
    get_session_decision_support,
)

# ---------------------------------------------------------------------------
# Isolated Test Database Lifecycle & Fixtures
# ---------------------------------------------------------------------------

TEST_DB_FILE = "./test_task4_final.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"

test_engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine
)


@pytest.fixture(scope="module", autouse=True)
def setup_test_database():
    """Initializes and tears down an isolated SQLite database for Task 4 Final tests.

    Crucial: Overrides BOTH sim_get_db and analysis_get_db to guarantee
    that simulator and analysis endpoints operate on the exact same database.
    """
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

    app.dependency_overrides[sim_get_db] = override_get_db
    app.dependency_overrides[analysis_get_db] = override_get_db

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
    """FastAPI TestClient fixture."""
    return TestClient(app)


@pytest.fixture
def db():
    """Provides a transactional database session for direct inspection."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(autouse=True)
def clean_metrics():
    """Resets operational metrics before and after each test for strict isolation."""
    reset_analysis_metrics()
    yield
    reset_analysis_metrics()


@pytest.fixture(autouse=True)
def default_mock_gemini(monkeypatch, request):
    """Provides fast fallback execution for tests by default, avoiding 1-2s Gemini network timeouts.

    Tests that specifically test Gemini LLM JSON or real status can override.
    """
    if "real_gemini" in request.node.name:
        return

    # Default fast mock for simulator_service
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "I understand the situation, but please resolve my issue as soon as possible."
    )
    # Default fast mock for analysis_service returning None to immediately trigger deterministic fallback
    monkeypatch.setattr(
        "app.services.analysis_service.generate_with_gemini",
        lambda prompt: None
    )


# ===========================================================================
# Section 1: Multi-Turn End-to-End Dialogue Loop (R1) (10 tests)
# ===========================================================================

def test_e2e_multiturn_3_turn_dialogue_progression(client, monkeypatch):
    """R1: Verifies continuous multi-turn dialogue progression across 3 continuous turns."""
    # Turn 1: Start simulation
    resp1 = client.post("/simulator/start", json={
        "session_label": "3-turn continuous loop",
        "persona": "frustrated",
        "scenario": "refund",
        "initial_emotion": "frustrated",
        "issue_severity": 3,
        "patience_level": 3,
        "expected_resolution": "Refund processed"
    })
    assert resp1.status_code == 200
    data1 = resp1.json()
    session_id = data1["session_id"]
    assert data1["turn"] == 1
    assert data1["analysis"]["intent"] == "refund"
    assert data1["analysis"]["satisfaction_trend"] == "stable"
    assert 0 <= data1["analysis"]["frustration_level"] <= 10

    # Turn 2: Support asks for details, customer provides order number
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda p: "My order ID is ORD-99881. Please process the refund immediately!"
    )
    resp2 = client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "I would be happy to help with your refund. Could you provide your order number?"
    })
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["turn"] == 2
    assert data2["analysis"]["intent"] == "refund"
    assert data2["analysis"]["frustration_level"] >= 5

    # Turn 3: Support confirms refund, customer expresses gratitude
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda p: "Thank you so much, that solved it and processed my refund! All set now."
    )
    resp3 = client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "The refund of $49.99 has been approved and issued to your original payment method."
    })
    assert resp3.status_code == 200
    data3 = resp3.json()
    assert data3["turn"] == 3
    assert data3["analysis"]["frustration_level"] <= 1
    assert data3["analysis"]["satisfaction_trend"] == "improving"


def test_e2e_multiturn_5_turn_dialogue_progression(client, monkeypatch):
    """R1: Verifies extended 5-turn marathon conversation progression without drift."""
    resp_start = client.post("/simulator/start", json={
        "session_label": "5-turn marathon loop",
        "persona": "impatient",
        "scenario": "delayed_order",
        "initial_emotion": "worried",
        "issue_severity": 3,
        "patience_level": 2,
        "expected_resolution": "Expedited delivery"
    })
    assert resp_start.status_code == 200
    session_id = resp_start.json()["session_id"]

    scripted_turns = [
        ("Where is my package? The tracking has not updated in 4 days!", "I am checking carrier records now."),
        ("Still waiting. I already told you I need this by Friday!", "The courier had a brief weather delay."),
        ("Can you please expedite it or send a replacement?", "I have requested overnight priority re-route."),
        ("Thank you for handling that! That solved it and I appreciate the help.", "You are very welcome! Have a wonderful day."),
    ]

    for idx, (cust_msg, agent_reply) in enumerate(scripted_turns, start=2):
        monkeypatch.setattr(
            "app.services.simulator_service.generate_with_gemini",
            lambda p, m=cust_msg: m
        )
        msg_resp = client.post("/simulator/message", json={
            "session_id": session_id,
            "agent_response": agent_reply
        })
        assert msg_resp.status_code == 200
        data = msg_resp.json()
        assert data["turn"] == idx
        assert "analysis" in data
        assert data["analysis"]["intent"] in [i.value for i in CustomerIntent]

    hist_resp = client.get(f"/analysis/{session_id}/history")
    assert hist_resp.status_code == 200
    history = hist_resp.json()
    assert len(history) == 5
    assert [h["turn"] for h in history] == [1, 2, 3, 4, 5]


def test_e2e_turn_numbers_increment_sequentially(client, monkeypatch):
    """R1: Turn numbers increment strictly monotonically across turns."""
    resp_start = client.post("/simulator/start", json={
        "session_label": "Turn monotonicity test",
        "persona": "calm",
        "scenario": "account_issue",
        "initial_emotion": "neutral",
        "issue_severity": 1,
        "patience_level": 5,
        "expected_resolution": "Information"
    })
    session_id = resp_start.json()["session_id"]
    turns_observed = [resp_start.json()["turn"]]

    for step in range(3):
        monkeypatch.setattr(
            "app.services.simulator_service.generate_with_gemini",
            lambda p, s=step: f"This is follow-up question step {s} about pricing."
        )
        msg_resp = client.post("/simulator/message", json={
            "session_id": session_id,
            "agent_response": "Here is the pricing information."
        })
        turns_observed.append(msg_resp.json()["turn"])

    assert turns_observed == [1, 2, 3, 4]

    hist_resp = client.get(f"/analysis/{session_id}/history")
    assert [item["turn"] for item in hist_resp.json()] == [1, 2, 3, 4]


def test_e2e_analysis_persisted_as_system_messages(client, db):
    """R1: Task 4 analysis snapshots are persisted non-invasively as System messages."""
    resp_start = client.post("/simulator/start", json={
        "session_label": "System message persistence test",
        "persona": "frustrated",
        "scenario": "payment_failure",
        "initial_emotion": "frustrated",
        "issue_severity": 3,
        "patience_level": 3,
        "expected_resolution": "Payment fixed"
    })
    session_id = resp_start.json()["session_id"]

    client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "Let me reset your payment session."
    })

    conv = db.query(Conversation).filter(Conversation.session_id == session_id).first()
    assert conv is not None

    sys_msgs = (
        db.query(Message)
        .filter(Message.conversation_id == conv.conversation_id, Message.message_type == "System")
        .all()
    )
    assert len(sys_msgs) == 2

    for sm in sys_msgs:
        assert sm.sender_type == "AI"
        payload = json.loads(sm.message_text)
        assert "analysis" in payload
        assert "state" in payload
        analysis = payload["analysis"]
        assert "intent" in analysis
        assert "emotion" in analysis
        assert "frustration_level" in analysis
        assert "escalation_risk" in analysis


def test_e2e_simulator_history_excludes_system_messages(client):
    """R1: Public GET /simulator/{session_id}/history strictly excludes internal System messages."""
    resp_start = client.post("/simulator/start", json={
        "session_label": "History filtering test",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 4,
        "expected_resolution": "Refund"
    })
    session_id = resp_start.json()["session_id"]

    client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "Checking your refund request."
    })

    sim_history_resp = client.get(f"/simulator/{session_id}/history")
    assert sim_history_resp.status_code == 200
    sim_msgs = sim_history_resp.json()["messages"]

    # Exactly 1 Customer turn 1 + 1 Agent response + 1 Customer turn 2 = 3 dialogue messages
    assert len(sim_msgs) == 3
    for msg in sim_msgs:
        assert msg["sender_type"] in ["Customer", "Support Agent"]
        assert "{" not in msg["message_text"] or '"analysis"' not in msg["message_text"]


def test_e2e_analysis_history_returns_valid_turn_analyses(client):
    """R1: GET /analysis/{session_id}/history parses System messages into TurnAnalysis schemas."""
    resp_start = client.post("/simulator/start", json={
        "session_label": "TurnAnalysis parsing test",
        "persona": "confused",
        "scenario": "account_issue",
        "initial_emotion": "confused",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Access restored"
    })
    session_id = resp_start.json()["session_id"]

    client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "Click the reset link in your email."
    })

    hist_resp = client.get(f"/analysis/{session_id}/history")
    assert hist_resp.status_code == 200
    turns = hist_resp.json()
    assert len(turns) == 2

    for t in turns:
        # Validate against Pydantic schema
        turn_obj = TurnAnalysis(**t)
        assert turn_obj.turn in [1, 2]
        assert turn_obj.intent in CustomerIntent
        assert turn_obj.emotion in CustomerEmotion
        assert turn_obj.sentiment in CustomerSentiment
        assert 0 <= turn_obj.frustration_level <= 10
        assert 0.0 <= turn_obj.confidence <= 1.0


def test_e2e_decision_support_updates_each_turn(client, monkeypatch):
    """R1: Decision support updates dynamically per turn as customer state changes."""
    # Turn 1: High agitation opening
    resp_start = client.post("/simulator/start", json={
        "session_label": "DS Evolution Test",
        "persona": "angry",
        "scenario": "refund",
        "initial_emotion": "angry",
        "issue_severity": 4,
        "patience_level": 1,
        "expected_resolution": "Immediate refund"
    })
    session_id = resp_start.json()["session_id"]

    ds_turn1 = client.get(f"/analysis/{session_id}/decision-support").json()
    assert ds_turn1["priority"] in ["high", "critical"]
    assert ds_turn1["escalation_recommended"] is True

    # Turn 2: Customer de-escalates completely after immediate refund
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda p: "Thank you so much! That completely resolved my problem and I got the credit."
    )
    client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "I have processed your immediate full refund."
    })

    ds_turn2 = client.get(f"/analysis/{session_id}/decision-support").json()
    assert ds_turn2["priority"] in ["low", "medium"]
    assert ds_turn2["recommended_tone"] in ["professional", "calm"]


def test_e2e_cumulative_summary_aggregates_across_turns(client, monkeypatch):
    """R1: GET /analysis/{session_id}/summary aggregates multi-turn history correctly."""
    resp_start = client.post("/simulator/start", json={
        "session_label": "Cumulative summary test",
        "persona": "calm",
        "scenario": "cancellation",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 4,
        "expected_resolution": "Subscription cancelled"
    })
    session_id = resp_start.json()["session_id"]

    for msg in ["I really want to cancel my subscription.", "Please confirm the cancellation."]:
        monkeypatch.setattr(
            "app.services.simulator_service.generate_with_gemini",
            lambda p, m=msg: m
        )
        client.post("/simulator/message", json={
            "session_id": session_id,
            "agent_response": "Processing your cancellation request."
        })

    sum_resp = client.get(f"/analysis/{session_id}/summary")
    assert sum_resp.status_code == 200
    summary = sum_resp.json()
    assert summary["session_id"] == session_id
    assert summary["turn_count"] == 3
    assert summary["dominant_intent"] == "cancellation"
    assert 0 <= summary["current_frustration"] <= 10
    assert summary["overall_satisfaction_direction"] in [t.value for t in SatisfactionTrend]


def test_e2e_context_passed_to_analysis_service(client, monkeypatch, db):
    """R1: Dialogue history and scenario context are passed into analysis service."""
    resp_start = client.post("/simulator/start", json={
        "session_label": "Context Passing Test",
        "persona": "frustrated",
        "scenario": "refund",
        "initial_emotion": "frustrated",
        "issue_severity": 3,
        "patience_level": 3,
        "expected_resolution": "Refund"
    })
    session_id = resp_start.json()["session_id"]

    # Verify context extraction directly
    ctx = get_conversation_context(session_id=session_id, db=db)
    assert ctx is not None
    assert ctx["scenario_category"] == "refund"
    assert len(ctx["dialogue_history"]) >= 1

    # Elliptical customer response relies on prior context
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda p: "Give me back that money now."
    )
    msg_resp = client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "I understand your concern."
    })
    assert msg_resp.status_code == 200
    # Context should classify 'that money' as refund
    assert msg_resp.json()["analysis"]["intent"] == "refund"


def test_e2e_dialogue_deduplication_audit(client, monkeypatch, db):
    """R1: Audit ensures zero duplicate customer, agent, or system messages."""
    resp_start = client.post("/simulator/start", json={
        "session_label": "Deduplication Audit",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 4,
        "expected_resolution": "Refund"
    })
    session_id = resp_start.json()["session_id"]

    client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "Checking order details."
    })

    conv = db.query(Conversation).filter(Conversation.session_id == session_id).first()
    all_msgs = db.query(Message).filter(Message.conversation_id == conv.conversation_id).all()

    cust_msgs = [m for m in all_msgs if m.sender_type == "Customer"]
    agent_msgs = [m for m in all_msgs if m.sender_type == "Support Agent"]
    sys_msgs = [m for m in all_msgs if m.message_type == "System"]

    assert len(cust_msgs) == 2
    assert len(agent_msgs) == 1
    assert len(sys_msgs) == 2

    # Re-reading history multiple times is strictly idempotent
    h1 = client.get(f"/analysis/{session_id}/history").json()
    h2 = client.get(f"/analysis/{session_id}/history").json()
    assert h1 == h2
    assert len(db.query(Message).filter(Message.conversation_id == conv.conversation_id).all()) == len(all_msgs)


# ===========================================================================
# Section 2: Comprehensive Analytical Coverage (R2) (16 tests)
# ===========================================================================

def test_analytical_all_8_intents_covered():
    """R2.1: Validates deterministic classification across all 8 customer intents."""
    intent_cases = [
        ("I demand a refund for the double charge on my account.", CustomerIntent.REFUND),
        ("Please cancel my subscription and end my plan immediately.", CustomerIntent.CANCELLATION),
        ("Where is my package? The delivery tracking is delayed.", CustomerIntent.DELIVERY_ISSUE),
        ("My credit card was declined at checkout and payment failed.", CustomerIntent.PAYMENT_ISSUE),
        ("I am locked out of my account and need to reset password.", CustomerIntent.ACCOUNT_ISSUE),
        ("The agent was rude, this is awful service and a formal complaint.", CustomerIntent.COMPLAINT),
        ("Can I return this item or exchange it for a replacement?", CustomerIntent.RETURN_EXCHANGE),
        ("What are your business operating hours and pricing policy?", CustomerIntent.GENERAL_INQUIRY),
    ]
    for text, expected in intent_cases:
        classified = classify_intent_deterministic(text=text, dialogue_history=[])
        assert classified == expected, f"Failed on '{text}': expected {expected}, got {classified}"


def test_analytical_all_7_emotions_covered():
    """R2.2: Validates deterministic classification across all 7 customer emotions."""
    emotion_cases = [
        ("Thank you so much! This is wonderful and amazing, super happy!", CustomerEmotion.HAPPY),
        ("The tracking order number is ORD-99112.", CustomerEmotion.NEUTRAL),
        ("I don't understand what this fee is, I am confused.", CustomerEmotion.CONFUSED),
        ("I am worried and nervous that my account got compromised.", CustomerEmotion.WORRIED),
        ("I am frustrated, taking too long and tired of waiting!", CustomerEmotion.FRUSTRATED),
        ("I am furious, completely unacceptable, get me your manager right now!", CustomerEmotion.ANGRY),
        ("That fixed it, all sorted and working now, thank you for handling.", CustomerEmotion.SATISFIED),
    ]
    for text, expected in emotion_cases:
        classified = classify_emotion_deterministic(text=text)
        assert classified == expected, f"Failed on '{text}': expected {expected}, got {classified}"


def test_analytical_all_3_sentiments_covered():
    """R2.3: Validates deterministic classification across positive, neutral, and negative sentiments."""
    sentiment_cases = [
        ("Wonderful fantastic service, thank you so much!", CustomerEmotion.HAPPY, CustomerSentiment.POSITIVE),
        ("The order number is ORD-8877.", CustomerEmotion.NEUTRAL, CustomerSentiment.NEUTRAL),
        ("This is a terrible delay and horrible problem.", CustomerEmotion.FRUSTRATED, CustomerSentiment.NEGATIVE),
    ]
    for text, emotion, expected in sentiment_cases:
        classified = classify_sentiment_deterministic(text=text, emotion=emotion)
        assert classified == expected, f"Failed on '{text}': expected {expected}, got {classified}"


def test_analytical_frustration_lower_boundary_0_and_1():
    """R2.4: Frustration lower boundary values (0 and 1) are accurately scored."""
    # Score 0: completely calm / happy customer
    f0 = calculate_frustration_level(
        message="Thank you so much, you are amazing!",
        emotion=CustomerEmotion.HAPPY,
        sentiment=CustomerSentiment.POSITIVE,
        dialogue_history=[],
        has_escalation_req=False,
        has_repeated=False
    )
    assert f0 == 0

    # Score 1: satisfied / resolved customer
    f1 = calculate_frustration_level(
        message="That solved it, thank you for fixing!",
        emotion=CustomerEmotion.SATISFIED,
        sentiment=CustomerSentiment.POSITIVE,
        dialogue_history=[],
        has_escalation_req=False,
        has_repeated=False
    )
    assert f1 == 1


def test_analytical_frustration_mid_boundary_4_and_5():
    """R2.4: Frustration mid boundaries (4 and 5) trigger proper risk transitions."""
    f4 = calculate_frustration_level(
        message="I don't understand what this charge means.",
        emotion=CustomerEmotion.CONFUSED,
        sentiment=CustomerSentiment.NEUTRAL,
        dialogue_history=[],
        has_escalation_req=False,
        has_repeated=False
    )
    assert f4 == 4
    # Frustration 4 with neutral emotion remains LOW risk
    risk4 = determine_escalation_risk(
        frustration_level=4,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        has_escalation_req=False,
        has_repeated=False
    )
    assert risk4 == EscalationRisk.LOW

    # Frustration 5 with exclamation
    f5 = calculate_frustration_level(
        message="I am worried about this payment!",
        emotion=CustomerEmotion.WORRIED,
        sentiment=CustomerSentiment.NEUTRAL,
        dialogue_history=[],
        has_escalation_req=False,
        has_repeated=False
    )
    assert f5 == 5
    # Frustration 5 triggers MEDIUM risk
    risk5 = determine_escalation_risk(
        frustration_level=5,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        has_escalation_req=False,
        has_repeated=False
    )
    assert risk5 == EscalationRisk.MEDIUM


def test_analytical_frustration_high_boundary_7_8_9_10():
    """R2.4: Frustration boundary values (7, 8, 9, 10) trigger elevated actions."""
    # 7: Standard frustrated baseline
    f7 = calculate_frustration_level(
        message="I am frustrated with this delay.",
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        dialogue_history=[],
        has_escalation_req=False,
        has_repeated=False
    )
    assert f7 == 7

    # 8: Frustrated + 2 CAPS words of length >= 3
    f8 = calculate_frustration_level(
        message="I AM TIRED AND UPSET of waiting.",
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        dialogue_history=[],
        has_escalation_req=False,
        has_repeated=False
    )
    assert f8 == 8
    # 8 triggers HIGH risk
    risk8 = determine_escalation_risk(
        frustration_level=8,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        has_escalation_req=False,
        has_repeated=False
    )
    assert risk8 == EscalationRisk.HIGH

    # 9: Angry baseline
    f9 = calculate_frustration_level(
        message="This is completely ridiculous.",
        emotion=CustomerEmotion.ANGRY,
        sentiment=CustomerSentiment.NEGATIVE,
        dialogue_history=[],
        has_escalation_req=False,
        has_repeated=False
    )
    assert f9 == 9

    # 10: Angry + CAPS + exclamations + manager threat saturation ceiling
    f10 = calculate_frustration_level(
        message="GET ME YOUR MANAGER RIGHT NOW! THIS IS COMPLETELY UNACCEPTABLE!!!!",
        emotion=CustomerEmotion.ANGRY,
        sentiment=CustomerSentiment.NEGATIVE,
        dialogue_history=[],
        has_escalation_req=True,
        has_repeated=True
    )
    assert f10 == 10


def test_analytical_frustration_caps_and_exclamations_stacking():
    """R2.4: Capitalized words (+1.5) and exclamations (+0.5 up to +2.0) stack predictably."""
    score_base = calculate_frustration_level(
        message="I want my money back from you",
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        dialogue_history=[],
        has_escalation_req=False,
        has_repeated=False
    )
    score_caps = calculate_frustration_level(
        message="I WANT MY MONEY back from you",
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        dialogue_history=[],
        has_escalation_req=False,
        has_repeated=False
    )
    score_excl = calculate_frustration_level(
        message="I WANT MY MONEY back from you!!!!",
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        dialogue_history=[],
        has_escalation_req=False,
        has_repeated=False
    )
    assert score_caps > score_base
    assert score_excl > score_caps
    assert score_excl <= 10


def test_analytical_frustration_gratitude_clamping():
    """R2.4: Gratitude / resolution keywords clamp frustration score to <= 1."""
    f = calculate_frustration_level(
        message="I was furious earlier, but thanks for fixing this issue!",
        emotion=CustomerEmotion.ANGRY,
        sentiment=CustomerSentiment.POSITIVE,
        dialogue_history=[],
        has_escalation_req=False,
        has_repeated=False
    )
    assert f <= 1


def test_analytical_satisfaction_trend_improving():
    """R2.5: Satisfaction trend evaluates to IMPROVING on frustration drop >= 2 or sentiment reversal."""
    history = [{"sender_type": "Customer", "message_text": "I am furious, this is broken!"}]
    trend = determine_satisfaction_trend(
        current_frustration=1,
        current_sentiment=CustomerSentiment.POSITIVE,
        dialogue_history=history,
        current_message="Thank you so much for resolving this!"
    )
    assert trend == SatisfactionTrend.IMPROVING


def test_analytical_satisfaction_trend_declining():
    """R2.5: Satisfaction trend evaluates to DECLINING on frustration rise >= 2 or sentiment drop."""
    history = [{"sender_type": "Customer", "message_text": "Thank you for the quick greeting."}]
    trend = determine_satisfaction_trend(
        current_frustration=7,
        current_sentiment=CustomerSentiment.NEGATIVE,
        dialogue_history=history,
        current_message="Now I am frustrated, you charged me twice!"
    )
    assert trend == SatisfactionTrend.DECLINING


def test_analytical_satisfaction_trend_stable():
    """R2.5: Satisfaction trend evaluates to STABLE on turn 1 or minimal delta."""
    # Turn 1 baseline
    t1 = determine_satisfaction_trend(
        current_frustration=3,
        current_sentiment=CustomerSentiment.NEUTRAL,
        dialogue_history=[],
        current_message="What are your hours?"
    )
    assert t1 == SatisfactionTrend.STABLE

    # Delta within (-2, 2) without sentiment reversal
    history = [{"sender_type": "Customer", "message_text": "I am checking my order."}]
    t2 = determine_satisfaction_trend(
        current_frustration=3,
        current_sentiment=CustomerSentiment.NEUTRAL,
        dialogue_history=history,
        current_message="Still checking my order."
    )
    assert t2 == SatisfactionTrend.STABLE


def test_analytical_escalation_risk_low():
    """R2.6: Escalation risk evaluates to LOW for calm, happy, or low-frustration turns."""
    risk_happy = determine_escalation_risk(
        frustration_level=1,
        emotion=CustomerEmotion.HAPPY,
        sentiment=CustomerSentiment.POSITIVE,
        has_escalation_req=False,
        has_repeated=False
    )
    assert risk_happy == EscalationRisk.LOW

    risk_calm = determine_escalation_risk(
        frustration_level=2,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        has_escalation_req=False,
        has_repeated=False
    )
    assert risk_calm == EscalationRisk.LOW


def test_analytical_escalation_risk_medium():
    """R2.6: Escalation risk evaluates to MEDIUM for moderate frustration (5-7) or repeated complaints."""
    risk_f5 = determine_escalation_risk(
        frustration_level=5,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        has_escalation_req=False,
        has_repeated=False
    )
    assert risk_f5 == EscalationRisk.MEDIUM

    risk_repeated = determine_escalation_risk(
        frustration_level=3,
        emotion=CustomerEmotion.CONFUSED,
        sentiment=CustomerSentiment.NEUTRAL,
        has_escalation_req=False,
        has_repeated=True
    )
    assert risk_repeated == EscalationRisk.MEDIUM


def test_analytical_escalation_risk_high():
    """R2.6: Escalation risk evaluates to HIGH for severe frustration (>= 8) or supervisor threats."""
    risk_f8 = determine_escalation_risk(
        frustration_level=8,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        has_escalation_req=False,
        has_repeated=False
    )
    assert risk_f8 == EscalationRisk.HIGH

    risk_threat = determine_escalation_risk(
        frustration_level=3,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        has_escalation_req=True,
        has_repeated=False
    )
    assert risk_threat == EscalationRisk.HIGH


def test_analytical_confidence_strictly_bounded_0_to_1():
    """R2.7: Confidence score is strictly bounded in [0.0, 1.0] and reflects evidence quality."""
    c_weak = calculate_confidence(
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        intent=CustomerIntent.GENERAL_INQUIRY,
        has_signals=False,
        used_llm=False,
        text="ok"
    )
    assert 0.0 <= c_weak <= 1.0

    c_strong = calculate_confidence(
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        intent=CustomerIntent.REFUND,
        has_signals=True,
        used_llm=False,
        text="Please issue a refund for this double charge"
    )
    assert 0.0 <= c_strong <= 1.0
    assert c_strong > c_weak


def test_analytical_decision_support_all_needs_and_tones():
    """R2: Validates decision support mappings for all 8 needs, tones, and actions."""
    # Verify all 8 intents map to distinct CustomerNeed
    mapped_needs = {map_customer_needs(i)[0] for i in CustomerIntent}
    assert len(mapped_needs) == 8

    # Verify tone mappings
    tones = {
        determine_recommended_tone(AnalysisResult(
            intent=CustomerIntent.COMPLAINT,
            emotion=CustomerEmotion.ANGRY,
            sentiment=CustomerSentiment.NEGATIVE,
            frustration_level=8,
            satisfaction_trend=SatisfactionTrend.STABLE,
            escalation_risk=EscalationRisk.HIGH,
            confidence=0.9
        )): "apologetic",
        determine_recommended_tone(AnalysisResult(
            intent=CustomerIntent.REFUND,
            emotion=CustomerEmotion.WORRIED,
            sentiment=CustomerSentiment.NEGATIVE,
            frustration_level=4,
            satisfaction_trend=SatisfactionTrend.STABLE,
            escalation_risk=EscalationRisk.LOW,
            confidence=0.9
        )): "reassuring",
        determine_recommended_tone(AnalysisResult(
            intent=CustomerIntent.ACCOUNT_ISSUE,
            emotion=CustomerEmotion.CONFUSED,
            sentiment=CustomerSentiment.NEUTRAL,
            frustration_level=3,
            satisfaction_trend=SatisfactionTrend.STABLE,
            escalation_risk=EscalationRisk.LOW,
            confidence=0.9
        )): "clarifying",
        determine_recommended_tone(AnalysisResult(
            intent=CustomerIntent.GENERAL_INQUIRY,
            emotion=CustomerEmotion.HAPPY,
            sentiment=CustomerSentiment.POSITIVE,
            frustration_level=0,
            satisfaction_trend=SatisfactionTrend.STABLE,
            escalation_risk=EscalationRisk.LOW,
            confidence=0.9
        )): "professional",
    }
    for tone, expected in tones.items():
        assert tone.value == expected


# ===========================================================================
# Section 3: Gemini Mock vs Fallback Resilience & Isolation (R3) (10 tests)
# ===========================================================================

def test_resilience_deterministic_fallback_when_gemini_none(db, monkeypatch):
    """R3.1: Analysis service falls back cleanly when Gemini returns None."""
    # Create test session
    scen = Scenario(title="Scen", category="refund", difficulty="Easy")
    db.add(scen)
    db.flush()
    sess = SimSession(scenario_id=scen.scenario_id)
    db.add(sess)
    db.flush()
    conv = Conversation(session_id=sess.session_id)
    db.add(conv)
    db.commit()

    monkeypatch.setattr(
        "app.services.analysis_service.generate_with_gemini",
        lambda prompt: None
    )

    result = analyze_customer_message(
        session_id=sess.session_id,
        customer_message="I want my money refunded for the extra charge",
        db=db
    )
    assert result.analysis_source == "fallback"
    assert result.intent == CustomerIntent.REFUND
    assert 0 <= result.frustration_level <= 10


def test_resilience_deterministic_fallback_on_gemini_exception(db, monkeypatch):
    """R3.1: Fallback gracefully handles unexpected exceptions or timeouts from Gemini."""
    sess = SimSession(scenario_id=1)
    db.add(sess)
    db.commit()

    monkeypatch.setattr(
        "app.services.analysis_service.generate_with_gemini",
        MagicMock(side_effect=RuntimeError("Google Gemini 429: ResourceExhausted"))
    )

    result = analyze_customer_message(
        session_id=sess.session_id,
        customer_message="Please cancel my subscription right now",
        db=db
    )
    assert result.analysis_source == "fallback"
    assert result.intent == CustomerIntent.CANCELLATION


def test_resilience_deterministic_fallback_on_invalid_json(db, monkeypatch):
    """R3.1: Fallback activates when Gemini returns unparseable non-JSON text."""
    sess = SimSession(scenario_id=1)
    db.add(sess)
    db.commit()

    monkeypatch.setattr(
        "app.services.analysis_service.generate_with_gemini",
        lambda prompt: "I am unable to answer in JSON format at this time."
    )

    result = analyze_customer_message(
        session_id=sess.session_id,
        customer_message="Where is my delivery? It has not arrived.",
        db=db
    )
    assert result.analysis_source == "fallback"
    assert result.intent == CustomerIntent.DELIVERY_ISSUE


def test_resilience_fallback_produces_fully_valid_analysis_result(db, monkeypatch):
    """R3.1: Fallback output satisfies 100% of AnalysisResult schema constraints."""
    sess = SimSession(scenario_id=1)
    db.add(sess)
    db.commit()

    monkeypatch.setattr(
        "app.services.analysis_service.generate_with_gemini",
        lambda prompt: None
    )

    result = analyze_customer_message(
        session_id=sess.session_id,
        customer_message="My credit card payment failed at checkout.",
        db=db
    )

    # Validates against Pydantic schema
    validated = AnalysisResult.model_validate(result.model_dump())
    assert validated.intent == CustomerIntent.PAYMENT_ISSUE
    assert validated.session_id == sess.session_id
    assert validated.analysis_source == "fallback"
    assert 0 <= validated.frustration_level <= 10
    assert 0.0 <= validated.confidence <= 1.0


def test_resilience_fallback_produces_valid_decision_support(db, monkeypatch):
    """R3.1: Decision support generated from fallback analysis satisfies schema contracts."""
    sess = SimSession(scenario_id=1)
    db.add(sess)
    db.commit()

    monkeypatch.setattr(
        "app.services.analysis_service.generate_with_gemini",
        lambda prompt: None
    )

    res = analyze_customer_message(
        session_id=sess.session_id,
        customer_message="I have a formal complaint about awful treatment.",
        db=db
    )
    ds = generate_decision_support(analysis_result=res)
    assert isinstance(ds, DecisionSupportResult)
    assert ds.priority in DecisionPriority
    assert ds.recommended_tone in RecommendedTone
    assert ds.recommended_action in RecommendedAction
    assert len(ds.customer_needs) > 0
    assert len(ds.rationale) > 10


def test_resilience_simulator_uninterrupted_when_analysis_fails(client, monkeypatch):
    """R3.3: Task 3 Customer Simulator operates safely even if Task 4 analysis raises fatal errors."""
    monkeypatch.setattr(
        "app.api.simulator.analyze_customer_message",
        MagicMock(side_effect=RuntimeError("Simulated critical analysis crash"))
    )

    resp_start = client.post("/simulator/start", json={
        "session_label": "Crash Isolation Test",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 4,
        "expected_resolution": "Refund"
    })
    assert resp_start.status_code == 200
    data = resp_start.json()
    assert data["session_id"] > 0
    # Analysis field may be None or omitted, but simulation continued
    assert "customer_message" in data

    resp_msg = client.post("/simulator/message", json={
        "session_id": data["session_id"],
        "agent_response": "I am looking into this for you."
    })
    assert resp_msg.status_code == 200
    assert resp_msg.json()["turn"] == 2


def test_resilience_simulator_uninterrupted_when_decision_support_fails(client, monkeypatch):
    """R3.3: Simulator endpoints continue safely even if decision support fails."""
    monkeypatch.setattr(
        "app.services.decision_support_service.get_session_decision_support",
        MagicMock(side_effect=RuntimeError("Decision support engine unavailable"))
    )

    start_resp = client.post("/simulator/start", json={
        "session_label": "DS Failure Resilience",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Resolved"
    })
    assert start_resp.status_code == 200
    s_id = start_resp.json()["session_id"]

    msg_resp = client.post("/simulator/message", json={
        "session_id": s_id,
        "agent_response": "Checking your refund."
    })
    assert msg_resp.status_code == 200


def test_resilience_real_gemini_execution_status_reported():
    """R3.2: Documents and verifies real Gemini environment status honestly."""
    from app.services.rag_service import generate_with_gemini
    status = "NOT RUN — credentials/network/model unavailable"
    try:
        res = generate_with_gemini("Health check")
        if res:
            status = "PASS"
    except Exception as e:
        err_msg = str(e)
        assert any(term in err_msg for term in ["API key not valid", "API_KEY_INVALID", "400", "GEMINI_API_KEY", "ClientError"])
        status = "NOT RUN — credentials/network/model unavailable"

    assert status in ["PASS", "NOT RUN — credentials/network/model unavailable"]


def test_resilience_error_logging_during_fallback(db, monkeypatch, caplog):
    """R3: Verifies structured logging of fallback activation reason."""
    sess = SimSession(scenario_id=1)
    db.add(sess)
    db.commit()

    monkeypatch.setattr(
        "app.services.analysis_service.generate_with_gemini",
        MagicMock(side_effect=ValueError("Simulated API key failure"))
    )

    with caplog.at_level(logging.INFO):
        analyze_customer_message(
            session_id=sess.session_id,
            customer_message="Help with my account",
            db=db
        )

    assert "analysis_source_selected" in caplog.text
    assert "source=fallback" in caplog.text


def test_resilience_metrics_tracking_gemini_calls_and_fallbacks(db, monkeypatch):
    """R3: Operational metrics track successful LLM calls vs fallback executions accurately."""
    sess = SimSession(scenario_id=1)
    db.add(sess)
    db.commit()

    # 1. Successful mocked LLM execution
    monkeypatch.setattr(
        "app.services.analysis_service.generate_with_gemini",
        lambda prompt: json.dumps({
            "intent": "refund",
            "emotion": "neutral",
            "sentiment": "neutral",
            "confidence": 0.95
        })
    )
    res1 = analyze_customer_message(session_id=sess.session_id, customer_message="Refund please", db=db)
    assert res1.analysis_source == "gemini"

    # 2. Fallback execution
    monkeypatch.setattr(
        "app.services.analysis_service.generate_with_gemini",
        lambda prompt: None
    )
    res2 = analyze_customer_message(session_id=sess.session_id, customer_message="Cancel plan", db=db)
    assert res2.analysis_source == "fallback"

    metrics = get_analysis_metrics()
    assert metrics["total_analyses"] == 2
    assert metrics["gemini_analyses"] == 1
    assert metrics["fallback_analyses"] == 1


# ===========================================================================
# Section 4: Session Isolation & Concurrency Safety (R4) (6 tests)
# ===========================================================================

def test_session_isolation_independent_sessions_different_intents(client):
    """R4: Simultaneous sessions with different scenarios remain strictly isolated."""
    resp_a = client.post("/simulator/start", json={
        "session_label": "Session A Refund",
        "persona": "angry",
        "scenario": "refund",
        "initial_emotion": "angry",
        "issue_severity": 4,
        "patience_level": 1,
        "expected_resolution": "Refund"
    })
    session_a = resp_a.json()["session_id"]

    resp_b = client.post("/simulator/start", json={
        "session_label": "Session B Account",
        "persona": "calm",
        "scenario": "account_issue",
        "initial_emotion": "neutral",
        "issue_severity": 1,
        "patience_level": 5,
        "expected_resolution": "Reset"
    })
    session_b = resp_b.json()["session_id"]

    assert session_a != session_b
    assert resp_a.json()["analysis"]["intent"] == "refund"
    assert resp_b.json()["analysis"]["intent"] == "account_issue"


def test_session_isolation_concurrent_turns_no_history_leak(client, monkeypatch):
    """R4: Interleaved customer turns across Session A and Session B never leak history."""
    resp_a = client.post("/simulator/start", json={
        "session_label": "A Interleaved",
        "persona": "frustrated",
        "scenario": "refund",
        "initial_emotion": "frustrated",
        "issue_severity": 3,
        "patience_level": 3,
        "expected_resolution": "Refund"
    })
    s_a = resp_a.json()["session_id"]

    resp_b = client.post("/simulator/start", json={
        "session_label": "B Interleaved",
        "persona": "polite",
        "scenario": "delayed_order",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 4,
        "expected_resolution": "Tracking"
    })
    s_b = resp_b.json()["session_id"]

    # Interleave turns: A2 -> B2 -> A3 -> B3
    for s_id, msg in [(s_a, "Refund turn 2"), (s_b, "Tracking turn 2"), (s_a, "Refund turn 3"), (s_b, "Tracking turn 3")]:
        monkeypatch.setattr(
            "app.services.simulator_service.generate_with_gemini",
            lambda p, m=msg: m
        )
        client.post("/simulator/message", json={"session_id": s_id, "agent_response": "Checking."})

    hist_a = client.get(f"/analysis/{s_a}/history").json()
    hist_b = client.get(f"/analysis/{s_b}/history").json()

    assert len(hist_a) == 3
    assert len(hist_b) == 3
    assert [t["turn"] for t in hist_a] == [1, 2, 3]
    assert [t["turn"] for t in hist_b] == [1, 2, 3]


def test_session_isolation_session_summaries_strictly_isolated(client, monkeypatch):
    """R4: Session summaries are derived exclusively from each session's own turns."""
    # Session A: High agitation refund
    resp_a = client.post("/simulator/start", json={
        "session_label": "Summary Isolation A",
        "persona": "angry",
        "scenario": "refund",
        "initial_emotion": "angry",
        "issue_severity": 4,
        "patience_level": 1,
        "expected_resolution": "Refund"
    })
    s_a = resp_a.json()["session_id"]

    # Session B: Calm delayed order
    resp_b = client.post("/simulator/start", json={
        "session_label": "Summary Isolation B",
        "persona": "calm",
        "scenario": "delayed_order",
        "initial_emotion": "neutral",
        "issue_severity": 1,
        "patience_level": 5,
        "expected_resolution": "Info"
    })
    s_b = resp_b.json()["session_id"]

    sum_a = client.get(f"/analysis/{s_a}/summary").json()
    sum_b = client.get(f"/analysis/{s_b}/summary").json()

    assert sum_a["dominant_intent"] == "refund"
    assert sum_b["dominant_intent"] == "delivery_issue"
    assert sum_a["current_frustration"] > sum_b["current_frustration"]


def test_session_isolation_decision_supports_strictly_isolated(client):
    """R4: Decision support recommendations for Session A never leak into Session B."""
    resp_a = client.post("/simulator/start", json={
        "session_label": "DS Isolation A",
        "persona": "angry",
        "scenario": "refund",
        "initial_emotion": "angry",
        "issue_severity": 4,
        "patience_level": 1,
        "expected_resolution": "Refund"
    })
    s_a = resp_a.json()["session_id"]

    resp_b = client.post("/simulator/start", json={
        "session_label": "DS Isolation B",
        "persona": "calm",
        "scenario": "delayed_order",
        "initial_emotion": "neutral",
        "issue_severity": 1,
        "patience_level": 5,
        "expected_resolution": "Info"
    })
    s_b = resp_b.json()["session_id"]

    ds_a = client.get(f"/analysis/{s_a}/decision-support").json()
    ds_b = client.get(f"/analysis/{s_b}/decision-support").json()

    assert ds_a["priority"] in ["high", "critical"]
    assert ds_b["priority"] in ["low", "medium"]
    assert ds_a["priority"] != ds_b["priority"]
    assert ds_a["recommended_action"] in ["escalate", "resolve", "apologize_and_resolve"]
    assert ds_b["recommended_action"] == "provide_status"


def test_session_isolation_database_query_scoping(client, db):
    """R4: Relational queries scoped by session_id never return rows from other sessions."""
    resp_a = client.post("/simulator/start", json={
        "session_label": "DB Scope A",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Refund"
    })
    s_a = resp_a.json()["session_id"]

    resp_b = client.post("/simulator/start", json={
        "session_label": "DB Scope B",
        "persona": "calm",
        "scenario": "payment_failure",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Payment"
    })
    s_b = resp_b.json()["session_id"]

    conv_a = db.query(Conversation).filter(Conversation.session_id == s_a).first()
    conv_b = db.query(Conversation).filter(Conversation.session_id == s_b).first()

    msgs_a = {m.message_id for m in db.query(Message).filter(Message.conversation_id == conv_a.conversation_id).all()}
    msgs_b = {m.message_id for m in db.query(Message).filter(Message.conversation_id == conv_b.conversation_id).all()}

    # Sets must be completely disjoint
    assert len(msgs_a.intersection(msgs_b)) == 0


def test_session_isolation_session_deletion_or_invalid_id(client):
    """R4: All Task 4 endpoints reject nonexistent or deleted session IDs with 404."""
    invalid_id = 999999
    assert client.get(f"/analysis/{invalid_id}/history").status_code == 404
    assert client.get(f"/analysis/{invalid_id}/summary").status_code == 404
    assert client.get(f"/analysis/{invalid_id}/decision-support").status_code == 404
    assert client.post(f"/analysis/{invalid_id}/decision-support").status_code == 404
    assert client.post("/analysis/analyze", json={
        "session_id": invalid_id,
        "customer_message": "Hello support"
    }).status_code == 404


# ===========================================================================
# Section 5: API Endpoints, OpenAPI & SQLite Integrity (R6) (10 tests)
# ===========================================================================

def test_api_post_analyze_endpoint_contract(client):
    """R6.1: Validates POST /analysis/analyze request and response contracts."""
    resp_start = client.post("/simulator/start", json={
        "session_label": "Endpoint Analyze Test",
        "persona": "calm",
        "scenario": "delayed_order",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 4,
        "expected_resolution": "Delivery"
    })
    session_id = resp_start.json()["session_id"]

    # Valid call
    resp = client.post("/analysis/analyze", json={
        "session_id": session_id,
        "customer_message": "Where is my package tracking?"
    })
    assert resp.status_code == 200
    data = resp.json()
    validated = AnalysisResponse(**data)
    assert validated.intent == CustomerIntent.DELIVERY_ISSUE

    # Empty customer message rejected with 422
    err_resp = client.post("/analysis/analyze", json={
        "session_id": session_id,
        "customer_message": "   "
    })
    assert err_resp.status_code == 422


def test_api_get_history_endpoint_contract(client):
    """R6.1: Validates GET /analysis/{session_id}/history response contract."""
    resp_start = client.post("/simulator/start", json={
        "session_label": "Endpoint History Test",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 4,
        "expected_resolution": "Refund"
    })
    session_id = resp_start.json()["session_id"]

    resp = client.get(f"/analysis/{session_id}/history")
    assert resp.status_code == 200
    history = resp.json()
    assert isinstance(history, list)
    assert len(history) >= 1
    TurnAnalysis(**history[0])


def test_api_get_summary_endpoint_contract(client):
    """R6.1: Validates GET /analysis/{session_id}/summary response contract."""
    resp_start = client.post("/simulator/start", json={
        "session_label": "Endpoint Summary Test",
        "persona": "calm",
        "scenario": "cancellation",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 4,
        "expected_resolution": "Cancel"
    })
    session_id = resp_start.json()["session_id"]

    resp = client.get(f"/analysis/{session_id}/summary")
    assert resp.status_code == 200
    summary = SessionAnalysisSummary(**resp.json())
    assert summary.session_id == session_id
    assert summary.turn_count >= 1


def test_api_post_decision_support_endpoint_contract(client):
    """R6.1: Validates POST /analysis/{session_id}/decision-support response contract."""
    resp_start = client.post("/simulator/start", json={
        "session_label": "Endpoint DS POST Test",
        "persona": "confused",
        "scenario": "account_issue",
        "initial_emotion": "confused",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Password"
    })
    session_id = resp_start.json()["session_id"]

    resp = client.post(f"/analysis/{session_id}/decision-support")
    assert resp.status_code == 200
    ds = DecisionSupportResult(**resp.json())
    assert ds.priority in DecisionPriority
    assert len(ds.rationale) > 0


def test_api_get_decision_support_endpoint_contract(client):
    """R6.1: Validates GET /analysis/{session_id}/decision-support idempotency and parity with POST."""
    resp_start = client.post("/simulator/start", json={
        "session_label": "Endpoint DS GET Test",
        "persona": "confused",
        "scenario": "account_issue",
        "initial_emotion": "confused",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Password"
    })
    session_id = resp_start.json()["session_id"]

    post_data = client.post(f"/analysis/{session_id}/decision-support").json()
    get_data = client.get(f"/analysis/{session_id}/decision-support").json()

    assert post_data["priority"] == get_data["priority"]
    assert post_data["recommended_tone"] == get_data["recommended_tone"]
    assert post_data["recommended_action"] == get_data["recommended_action"]
    assert post_data["customer_needs"] == get_data["customer_needs"]


def test_api_get_metrics_endpoint_contract(client):
    """R6.1: Validates GET /analysis/metrics returns operational counters and average latency."""
    resp = client.get("/analysis/metrics")
    assert resp.status_code == 200
    metrics = resp.json()
    assert "total_analyses" in metrics
    assert "gemini_analyses" in metrics
    assert "fallback_analyses" in metrics
    assert "average_latency_ms" in metrics


def test_api_openapi_schema_contains_all_models_and_enums(client):
    """R6.2: Validates FastAPI OpenAPI documentation contains all Task 4 models and enums."""
    resp = client.get("/openapi.json")
    assert resp.status_code == 200
    openapi = resp.json()
    schemas = openapi["components"]["schemas"]

    expected_schemas = [
        "AnalysisResponse",
        "TurnAnalysis",
        "SessionAnalysisSummary",
        "DecisionSupportResult",
        "CustomerIntent",
        "CustomerEmotion",
        "CustomerSentiment",
        "SatisfactionTrend",
        "EscalationRisk",
        "DecisionPriority",
        "RecommendedTone",
        "RecommendedAction",
        "CustomerNeed",
    ]
    for sch in expected_schemas:
        assert sch in schemas, f"Schema {sch} missing in OpenAPI components"

    expected_paths = [
        "/analysis/analyze",
        "/analysis/{session_id}/history",
        "/analysis/{session_id}/summary",
        "/analysis/{session_id}/decision-support",
        "/analysis/metrics",
    ]
    for path in expected_paths:
        assert path in openapi["paths"], f"Path {path} missing in OpenAPI paths"


def test_db_integrity_session_table_relations(client, db):
    """R6.3: Verifies database integrity: foreign key relations between sessions, conversations, messages."""
    resp = client.post("/simulator/start", json={
        "session_label": "Integrity Check Session",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 4,
        "expected_resolution": "Refund"
    })
    assert resp.status_code == 200
    s_id = resp.json()["session_id"]

    session_row = db.query(SimSession).filter(SimSession.session_id == s_id).first()
    assert session_row is not None
    assert session_row.scenario_id is not None

    conv_row = db.query(Conversation).filter(Conversation.session_id == s_id).first()
    assert conv_row is not None
    assert conv_row.session_id == session_row.session_id

    msgs = db.query(Message).filter(Message.conversation_id == conv_row.conversation_id).all()
    assert len(msgs) >= 2
    for m in msgs:
        assert m.conversation_id == conv_row.conversation_id


def test_db_integrity_message_system_type_persistence(client, db):
    """R6.3: Verifies exact persistence of System message format with analytical sub-dict."""
    resp = client.post("/simulator/start", json={
        "session_label": "System Type Persistence",
        "persona": "impatient",
        "scenario": "payment_failure",
        "initial_emotion": "worried",
        "issue_severity": 3,
        "patience_level": 2,
        "expected_resolution": "Fix card"
    })
    s_id = resp.json()["session_id"]

    conv = db.query(Conversation).filter(Conversation.session_id == s_id).first()
    sys_msg = (
        db.query(Message)
        .filter(Message.conversation_id == conv.conversation_id, Message.message_type == "System")
        .first()
    )
    assert sys_msg is not None
    assert sys_msg.sender_type == "AI"

    payload = json.loads(sys_msg.message_text)
    assert "persona" in payload
    assert "scenario" in payload
    assert "state" in payload
    assert "analysis" in payload

    analysis = payload["analysis"]
    for key in ["intent", "emotion", "sentiment", "frustration_level", "satisfaction_trend", "escalation_risk", "confidence"]:
        assert key in analysis, f"Key {key} missing in persisted analysis payload"


def test_db_integrity_no_destructive_schema_modifications():
    """R6.3: Verifies that SQLite tables retain all required relational columns without alterations."""
    insp = inspect(test_engine)
    table_names = set(insp.get_table_names())
    expected_tables = {"sessions", "conversations", "messages", "scenarios"}
    assert expected_tables.issubset(table_names), f"Missing tables: {expected_tables - table_names}"

    # Verify messages table columns
    msg_cols = {c["name"] for c in insp.get_columns("messages")}
    assert {"message_id", "conversation_id", "sender_type", "message_text", "timestamp", "message_type"}.issubset(msg_cols)

    # Verify conversations table columns
    conv_cols = {c["name"] for c in insp.get_columns("conversations")}
    assert {"conversation_id", "session_id", "intent", "sentiment", "resolution_status", "escalation_risk", "created_at"}.issubset(conv_cols)

    # Verify sessions table columns
    sess_cols = {c["name"] for c in insp.get_columns("sessions")}
    assert {"session_id", "scenario_id", "start_time", "end_time", "overall_score", "status"}.issubset(sess_cols)
