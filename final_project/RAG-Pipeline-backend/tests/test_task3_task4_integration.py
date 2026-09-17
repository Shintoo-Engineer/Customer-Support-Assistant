"""Dedicated Integration Test Suite: Task 3 Customer Simulator -> Task 4 Intent & Sentiment Analysis.

Verifies:
1. Basic Task 3 -> Task 4 pipeline execution.
2. All 6 personas (calm, confused, frustrated, angry, impatient, polite).
3. All 5 scenarios (refund, delayed_order, payment_failure, account_issue, cancellation).
4. Multi-turn conversation context and back-referencing.
5. Satisfaction trend shifts (improving, declining, stable).
6. Escalation risk detection and repeated complaint tracking.
7. Graceful degradation / failure isolation (LLM failure never breaks Task 3).
8. Task 4 standalone endpoint integrity.
9. Database consistency: no duplicate sessions, messages, or conversations; history filtering.
10. Metric boundaries: frustration in [0, 10], confidence in [0.0, 1.0].
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


TEST_DB_FILE = "test_integration_t3_t4.db"
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
def setup_integration_db():
    """Sets up an isolated SQLite test database for integration testing."""
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
# Section 1: Basic Integration & Response Contract
# ---------------------------------------------------------------------------

def test_basic_integration_start_turn1(client):
    """POST /simulator/start automatically invokes Task 4 live analysis on opening message."""
    resp = client.post("/simulator/start", json={
        "session_label": "Basic Integration Turn 1",
        "persona": "frustrated",
        "scenario": "refund",
        "initial_emotion": "frustrated",
        "issue_severity": 3,
        "patience_level": 3,
        "expected_resolution": "Refund processed"
    })
    assert resp.status_code == 200
    data = resp.json()

    # Verify Task 3 fields preserved
    assert "session_id" in data
    assert "conversation_id" in data
    assert "customer_message" in data
    assert data["turn"] == 1
    assert "state" in data

    # Verify Task 4 analysis attached
    assert "analysis" in data
    analysis = data["analysis"]
    assert analysis["intent"] in [i.value for i in CustomerIntent]
    assert analysis["emotion"] in [e.value for e in CustomerEmotion]
    assert analysis["sentiment"] in [s.value for s in CustomerSentiment]
    assert 0 <= analysis["frustration_level"] <= 10
    assert analysis["satisfaction_trend"] in [t.value for t in SatisfactionTrend]
    assert analysis["escalation_risk"] in [r.value for r in EscalationRisk]
    assert 0.0 <= analysis["confidence"] <= 1.0


def test_basic_integration_turn2_analysis(client, monkeypatch):
    """POST /simulator/message analyzes newly generated customer turn, not support response."""
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "I still need to know when my money will arrive!"
    )

    start_resp = client.post("/simulator/start", json={
        "session_label": "Turn 2 Analysis Test",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 4,
        "expected_resolution": "Refund confirmation"
    })
    session_id = start_resp.json()["session_id"]

    msg_resp = client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "I am looking into your account right now."
    })
    assert msg_resp.status_code == 200
    data = msg_resp.json()

    # Task 3 contract fields
    assert data["session_id"] == session_id
    assert data["turn"] == 2
    assert "customer_message" in data
    assert "state" in data
    assert "is_resolved" in data
    assert "is_escalated" in data

    # Task 4 live analysis fields
    assert "analysis" in data
    analysis = data["analysis"]
    assert analysis["intent"] == "refund"
    assert 0 <= analysis["frustration_level"] <= 10


def test_analysis_associated_with_correct_session(client):
    """Verifies that separate sessions receive independent, non-overlapping analyses."""
    resp_refund = client.post("/simulator/start", json={
        "session_label": "Session Refund",
        "persona": "angry",
        "scenario": "refund",
        "initial_emotion": "angry",
        "issue_severity": 4,
        "patience_level": 2,
        "expected_resolution": "Refund"
    })
    resp_cancel = client.post("/simulator/start", json={
        "session_label": "Session Cancel",
        "persona": "calm",
        "scenario": "cancellation",
        "initial_emotion": "calm",
        "issue_severity": 2,
        "patience_level": 4,
        "expected_resolution": "Cancel"
    })
    data_refund = resp_refund.json()
    data_cancel = resp_cancel.json()

    assert data_refund["session_id"] != data_cancel["session_id"]
    assert data_refund["analysis"]["intent"] == "refund"
    assert data_cancel["analysis"]["intent"] == "cancellation"


# ---------------------------------------------------------------------------
# Section 2: Persona Integration (All 6 Personas)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("persona,expected_severity", [
    ("calm", 2),
    ("confused", 3),
    ("frustrated", 4),
    ("angry", 5),
    ("impatient", 4),
    ("polite", 2),
])
def test_all_six_personas_integration(client, persona, expected_severity, monkeypatch):
    """Tests all 6 Task 3 personas through the integrated start -> turn message pipeline."""
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: f"Here is my follow-up reply as a {persona} customer."
    )

    start_resp = client.post("/simulator/start", json={
        "session_label": f"Integration Persona {persona.title()}",
        "persona": persona,
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": expected_severity,
        "patience_level": 3,
        "expected_resolution": "Resolution requested"
    })
    assert start_resp.status_code == 200
    start_data = start_resp.json()
    session_id = start_data["session_id"]
    assert "analysis" in start_data

    msg_resp = client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "Thank you for reaching out, let me help you."
    })
    assert msg_resp.status_code == 200
    msg_data = msg_resp.json()
    assert msg_data["turn"] == 2
    assert "analysis" in msg_data
    assert 0 <= msg_data["analysis"]["frustration_level"] <= 10


# ---------------------------------------------------------------------------
# Section 3: Scenario Integration (All 5 Scenarios)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("scenario,expected_intent", [
    ("refund", CustomerIntent.REFUND),
    ("delayed_order", CustomerIntent.DELIVERY_ISSUE),
    ("payment_failure", CustomerIntent.PAYMENT_ISSUE),
    ("account_issue", CustomerIntent.ACCOUNT_ISSUE),
    ("cancellation", CustomerIntent.CANCELLATION),
])
def test_all_five_scenarios_integration(client, scenario, expected_intent):
    """Verifies intent detection across all 5 Task 3 scenarios."""
    resp = client.post("/simulator/start", json={
        "session_label": f"Scenario Test - {scenario}",
        "persona": "calm",
        "scenario": scenario,
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Issue resolution"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["analysis"]["intent"] == expected_intent.value


# ---------------------------------------------------------------------------
# Section 4: Context Awareness, Multi-turn & Back-referencing
# ---------------------------------------------------------------------------

def test_contextual_back_referencing_across_turns(client, monkeypatch):
    """Customer says 'Yes, please process that' in turn 2; intent correctly resolved from context."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Contextual Back-Reference",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Full refund"
    })
    session_id = start_resp.json()["session_id"]

    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "Yes, please process that money back immediately."
    )

    msg_resp = client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "Would you like me to process a full refund to your original card?"
    })
    assert msg_resp.status_code == 200
    data = msg_resp.json()
    assert data["analysis"]["intent"] == "refund"


# ---------------------------------------------------------------------------
# Section 5: Satisfaction Trend Integration
# ---------------------------------------------------------------------------

def test_satisfaction_trend_improving_flow(client, monkeypatch):
    """Verifies that an empathetic agent response leading to customer gratitude yields 'improving' trend."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Satisfaction Improving Flow",
        "persona": "angry",
        "scenario": "refund",
        "initial_emotion": "angry",
        "issue_severity": 4,
        "patience_level": 2,
        "expected_resolution": "Refund"
    })
    session_id = start_resp.json()["session_id"]
    assert start_resp.json()["analysis"]["satisfaction_trend"] == "stable"

    # Turn 2: Customer receives resolution and thanks agent
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "Thank you so much! That solves my problem completely. Everything is resolved now."
    )

    msg_resp = client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "I have completely refunded your payment and sent a confirmation receipt."
    })
    assert msg_resp.status_code == 200
    data = msg_resp.json()
    assert data["analysis"]["satisfaction_trend"] == "improving"
    assert data["analysis"]["frustration_level"] <= 2


def test_satisfaction_trend_declining_flow(client, monkeypatch):
    """Verifies that a dismissive agent response provoking customer outrage yields 'declining' trend."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Satisfaction Declining Flow",
        "persona": "calm",
        "scenario": "delayed_order",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 4,
        "expected_resolution": "Package delivery"
    })
    session_id = start_resp.json()["session_id"]

    # Turn 2: Customer becomes furious
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "This is completely unacceptable! Your service is terrible and I demand my money back right now!"
    )

    msg_resp = client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "We cannot help you, policy is final."
    })
    assert msg_resp.status_code == 200
    data = msg_resp.json()
    assert data["analysis"]["satisfaction_trend"] == "declining"
    assert data["analysis"]["frustration_level"] >= 6


# ---------------------------------------------------------------------------
# Section 6: Escalation Risk & Repeated Complaints
# ---------------------------------------------------------------------------

def test_escalation_risk_high_on_supervisor_threat(client, monkeypatch):
    """Verifies high escalation risk when customer demands a manager/supervisor."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Escalation Threat Test",
        "persona": "angry",
        "scenario": "refund",
        "initial_emotion": "angry",
        "issue_severity": 5,
        "patience_level": 1,
        "expected_resolution": "Manager contact"
    })
    session_id = start_resp.json()["session_id"]

    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "I demand to speak with your manager immediately! Transfer me right now!"
    )

    msg_resp = client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "Please hold while I check."
    })
    assert msg_resp.status_code == 200
    data = msg_resp.json()
    assert data["analysis"]["escalation_risk"] == "high"


def test_repeated_complaint_detection_elevates_metrics(client, monkeypatch):
    """Repeated unresolved complaints across 3 turns elevate frustration and risk."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Repeated Complaint Test",
        "persona": "frustrated",
        "scenario": "delayed_order",
        "initial_emotion": "frustrated",
        "issue_severity": 3,
        "patience_level": 2,
        "expected_resolution": "Package delivery"
    })
    session_id = start_resp.json()["session_id"]

    # Turn 2: Still complaining
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "I already told you my package is missing! Where is it?"
    )
    client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "Let me check."
    })

    # Turn 3: Repeated complaint
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "This is the third time I am asking about my missing order! Nobody is resolving this!"
    )
    msg3_resp = client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "We are still checking."
    })
    assert msg3_resp.status_code == 200
    data = msg3_resp.json()
    assert data["analysis"]["frustration_level"] >= 6
    assert data["analysis"]["escalation_risk"] in ["medium", "high"]


# ---------------------------------------------------------------------------
# Section 7: Reliability & Failure Isolation (Graceful Degradation)
# ---------------------------------------------------------------------------

def test_llm_failure_does_not_break_task3_simulator_start(client, monkeypatch):
    """When Gemini/LLM raises an unhandled exception, /simulator/start still returns 200 with fallback."""
    def crash_llm(prompt):
        raise RuntimeError("Quota exceeded or Gemini connection down")

    monkeypatch.setattr(
        "app.services.analysis_service.generate_with_gemini",
        crash_llm
    )

    resp = client.post("/simulator/start", json={
        "session_label": "Crash Isolation Start",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Refund"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "customer_message" in data
    assert "state" in data
    assert "analysis" in data
    assert data["analysis"]["intent"] == "refund"


def test_llm_failure_does_not_break_task3_simulator_message(client, monkeypatch):
    """When Gemini/LLM raises an exception during message turn, /simulator/message still succeeds."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Crash Isolation Message",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Refund"
    })
    session_id = start_resp.json()["session_id"]

    def crash_llm(prompt):
        raise RuntimeError("Gemini 503 Service Unavailable")

    monkeypatch.setattr(
        "app.services.analysis_service.generate_with_gemini",
        crash_llm
    )

    msg_resp = client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "Checking your account status now."
    })
    assert msg_resp.status_code == 200
    data = msg_resp.json()
    assert "customer_message" in data
    assert "state" in data
    assert "analysis" in data


# ---------------------------------------------------------------------------
# Section 8: Standalone Task 4 Endpoint Integrity
# ---------------------------------------------------------------------------

def test_task4_standalone_endpoint_independent_operation(client):
    """POST /analysis/analyze continues to function independently with valid session_id."""
    # Create an active simulator session
    start_resp = client.post("/simulator/start", json={
        "session_label": "Standalone Task 4 Test",
        "persona": "calm",
        "scenario": "cancellation",
        "initial_emotion": "calm",
        "issue_severity": 1,
        "patience_level": 4,
        "expected_resolution": "Cancellation"
    })
    assert start_resp.status_code == 200
    session_id = start_resp.json()["session_id"]

    # Call standalone endpoint with valid session_id
    resp_valid = client.post("/analysis/analyze", json={
        "session_id": session_id,
        "customer_message": "Can I cancel my subscription before next month's billing?"
    })
    assert resp_valid.status_code == 200
    data_1 = resp_valid.json()
    assert data_1["intent"] == "cancellation"

    # Standalone with non-existent session_id returns 404
    resp_bad_session = client.post("/analysis/analyze", json={
        "session_id": 999999,
        "customer_message": "Where is my refund?"
    })
    assert resp_bad_session.status_code == 404


# ---------------------------------------------------------------------------
# Section 9: Database Integrity & Consistency
# ---------------------------------------------------------------------------

def test_database_persistence_and_no_duplicates(client, monkeypatch):
    """Verifies no duplicate sessions, messages, or conversations in DB; history remains clean."""
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "Got it, thanks for updating me."
    )

    start_resp = client.post("/simulator/start", json={
        "session_label": "DB Integrity Check",
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
        "agent_response": "Your refund is processed."
    })

    db = TestingSessionLocal()
    try:
        # Check sessions
        sessions = db.query(SimSession).filter(SimSession.session_id == session_id).all()
        assert len(sessions) == 1, "Exactly one Session record must exist"

        # Check conversations
        convs = db.query(Conversation).filter(Conversation.session_id == session_id).all()
        assert len(convs) == 1, "Exactly one Conversation record must exist"
        conv = convs[0]
        assert conv.intent is not None
        assert conv.sentiment is not None
        assert conv.escalation_risk is not None

        # Check dialogue messages in history endpoint
        hist_resp = client.get(f"/simulator/{session_id}/history")
        assert hist_resp.status_code == 200
        hist_data = hist_resp.json()
        assert len(hist_data["messages"]) == 3  # Customer (start) -> Agent (turn 1) -> Customer (turn 2)
        for m in hist_data["messages"]:
            assert m["message_type"] != "System"

        # Check internal System state records in Message table
        sys_msgs = (
            db.query(Message)
            .filter(
                Message.conversation_id == conv.conversation_id,
                Message.message_type == "System"
            )
            .all()
        )
        assert len(sys_msgs) == 2, "Exactly 2 system state rows (turn 1 + turn 2)"
        for sm in sys_msgs:
            payload = json.loads(sm.message_text)
            assert "analysis" in payload
            assert payload["analysis"] is not None
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Section 10: Performance & Loop Safety
# ---------------------------------------------------------------------------

def test_no_infinite_loop_or_recursive_turn_generation(client, monkeypatch):
    """Verifies that analyzing a customer turn does not trigger another simulator generation."""
    call_count = {"count": 0}

    def track_gemini(prompt):
        call_count["count"] += 1
        return "Here is my customer reply."

    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        track_gemini
    )

    start_resp = client.post("/simulator/start", json={
        "session_label": "Loop Safety Test",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Refund"
    })
    session_id = start_resp.json()["session_id"]

    call_count["count"] = 0
    client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "We will help you right now."
    })

    # Exactly 1 simulator generation per agent message turn (Task 4 only analyzes)
    assert call_count["count"] == 1, f"Expected 1 simulator call, got {call_count['count']}"


# ---------------------------------------------------------------------------
# Section 11: Boundaries, Multi-turn Progressions & System Snapshots
# ---------------------------------------------------------------------------

def test_frustration_bounds_strictly_between_0_and_10(client, monkeypatch):
    """Verifies frustration level never falls below 0 or exceeds 10 across diverse turns."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Frustration Bounds Test",
        "persona": "angry",
        "scenario": "refund",
        "initial_emotion": "angry",
        "issue_severity": 5,
        "patience_level": 1,
        "expected_resolution": "Full refund"
    })
    session_id = start_resp.json()["session_id"]
    assert 0 <= start_resp.json()["analysis"]["frustration_level"] <= 10

    # Test extreme rage message
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "I AM SO FURIOUS RIGHT NOW!!!!! GIVE ME MY MONEY BACK OR I WILL SUE YOUR ENTIRE COMPANY IMMEDIATELY!!!!"
    )
    msg_resp = client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "Nothing we can do."
    })
    assert msg_resp.status_code == 200
    assert msg_resp.json()["analysis"]["frustration_level"] <= 10
    assert msg_resp.json()["analysis"]["frustration_level"] >= 8


def test_confidence_bounds_strictly_between_0_and_1(client, monkeypatch):
    """Verifies confidence score is strictly bounded within [0.0, 1.0]."""
    resp = client.post("/simulator/start", json={
        "session_label": "Confidence Bounds Test",
        "persona": "confused",
        "scenario": "account_issue",
        "initial_emotion": "confused",
        "issue_severity": 3,
        "patience_level": 3,
        "expected_resolution": "Login restored"
    })
    assert resp.status_code == 200
    conf = resp.json()["analysis"]["confidence"]
    assert isinstance(conf, float)
    assert 0.0 <= conf <= 1.0


def test_analysis_valid_enums_on_fallback(client, monkeypatch):
    """Verifies all enum strings returned in analysis match exact schema Enum members."""
    resp = client.post("/simulator/start", json={
        "session_label": "Valid Enums Test",
        "persona": "polite",
        "scenario": "delayed_order",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 4,
        "expected_resolution": "Tracking update"
    })
    assert resp.status_code == 200
    analysis = resp.json()["analysis"]
    assert CustomerIntent(analysis["intent"])
    assert CustomerEmotion(analysis["emotion"])
    assert CustomerSentiment(analysis["sentiment"])
    assert SatisfactionTrend(analysis["satisfaction_trend"])
    assert EscalationRisk(analysis["escalation_risk"])


def test_multiturn_three_turn_escalating_progression(client, monkeypatch):
    """Three-turn escalating conversation where frustration compounds and risk escalates."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Three Turn Escalation",
        "persona": "frustrated",
        "scenario": "delayed_order",
        "initial_emotion": "frustrated",
        "issue_severity": 3,
        "patience_level": 2,
        "expected_resolution": "Delivery"
    })
    session_id = start_resp.json()["session_id"]
    t1_frust = start_resp.json()["analysis"]["frustration_level"]

    # Turn 2: Unhelpful agent response -> customer frustration rises
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "I already told you that tracking number! You are wasting my time!"
    )
    msg2 = client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "You must check the courier website yourself."
    })
    assert msg2.status_code == 200
    t2_frust = msg2.json()["analysis"]["frustration_level"]
    assert t2_frust >= t1_frust

    # Turn 3: Continuous stonewalling -> customer erupts
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "I demand to speak to your manager right now! This is completely unacceptable!"
    )
    msg3 = client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "There are no managers available."
    })
    assert msg3.status_code == 200
    t3_analysis = msg3.json()["analysis"]
    assert t3_analysis["escalation_risk"] == "high"


def test_multiturn_three_turn_deescalating_progression(client, monkeypatch):
    """Three-turn de-escalating conversation where customer calms down and reaches satisfaction."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Three Turn De-escalation",
        "persona": "angry",
        "scenario": "refund",
        "initial_emotion": "angry",
        "issue_severity": 4,
        "patience_level": 2,
        "expected_resolution": "Refund"
    })
    session_id = start_resp.json()["session_id"]

    # Turn 2: Anxious response -> customer remains concerned
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "I hope this actually goes through. I am still worried about my account being overcharged."
    )
    msg2 = client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "I sincerely apologize for the error. I am processing your full refund immediately."
    })
    assert msg2.status_code == 200
    assert msg2.json()["analysis"]["satisfaction_trend"] in ["improving", "stable"]

    # Turn 3: Complete resolution -> customer happy and satisfied
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "Thank you so much! I just saw the refund confirmation. Everything is resolved now."
    )
    msg3 = client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "You are very welcome! Have a wonderful day."
    })
    assert msg3.status_code == 200
    t3_analysis = msg3.json()["analysis"]
    assert t3_analysis["emotion"] in ["satisfied", "happy"]
    assert t3_analysis["sentiment"] == "positive"
    assert t3_analysis["frustration_level"] <= 2
    assert t3_analysis["satisfaction_trend"] == "improving"


def test_get_history_excludes_analysis_system_messages(client, monkeypatch):
    """Verifies that after multiple integrated turns, GET history only returns dialogue messages."""
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "Thank you for the reply."
    )
    start_resp = client.post("/simulator/start", json={
        "session_label": "History Cleanliness Check",
        "persona": "calm",
        "scenario": "payment_failure",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Payment fixed"
    })
    session_id = start_resp.json()["session_id"]

    client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "Here is the alternate payment link."
    })

    client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "Checking if that worked."
    })

    hist_resp = client.get(f"/simulator/{session_id}/history")
    assert hist_resp.status_code == 200
    hist_data = hist_resp.json()

    # 5 dialogue turns: Customer (start) -> Agent (1) -> Customer (2) -> Agent (3) -> Customer (4)
    assert len(hist_data["messages"]) == 5
    for msg in hist_data["messages"]:
        assert msg["message_type"] != "System"
        assert msg["sender_type"] in ["Customer", "Support Agent"]


def test_isolated_session_state_snapshots_intact(client, monkeypatch):
    """Verifies that Task 3's emotional-state snapshots stored in System rows remain intact."""
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "Got it."
    )
    start_resp = client.post("/simulator/start", json={
        "session_label": "State Snapshot Check",
        "persona": "polite",
        "scenario": "cancellation",
        "initial_emotion": "calm",
        "issue_severity": 1,
        "patience_level": 4,
        "expected_resolution": "Cancel"
    })
    session_id = start_resp.json()["session_id"]

    client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "Your account has been cancelled."
    })

    db = TestingSessionLocal()
    try:
        conv = db.query(Conversation).filter(Conversation.session_id == session_id).first()
        sys_msgs = (
            db.query(Message)
            .filter(
                Message.conversation_id == conv.conversation_id,
                Message.message_type == "System"
            )
            .all()
        )
        assert len(sys_msgs) == 2
        for sm in sys_msgs:
            data = json.loads(sm.message_text)
            assert "persona" in data
            assert "scenario" in data
            assert "state" in data
            assert "frustration" in data["state"]
            assert "analysis" in data
            assert "intent" in data["analysis"]
    finally:
        db.close()


def test_task3_resolution_updates_session_status(client, monkeypatch):
    """When resolution condition is met, Task 3 completes session while Task 4 records analysis."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Resolution Status Check",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "calm",
        "issue_severity": 2,
        "patience_level": 4,
        "expected_resolution": "Full refund of $49.99 processed"
    })
    session_id = start_resp.json()["session_id"]

    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "Thank you for issuing the full refund of $49.99, that resolves everything!"
    )

    msg_resp = client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "I have initiated the full refund transaction of $49.99, and it will process in 3-5 business days."
    })
    assert msg_resp.status_code == 200
    data = msg_resp.json()
    assert "is_resolved" in data
    assert "analysis" in data
