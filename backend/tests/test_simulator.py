"""Automated test suite for Customer Simulator models, services, state engine, and API endpoints."""

import os
import sys
from unittest.mock import MagicMock
import pytest

# Ensure GEMINI_API_KEY is configured so imports succeed without real credentials
os.environ.setdefault("GEMINI_API_KEY", "mock_key_for_testing")

# Mock optional packages if not present in the current Python environment
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
from app.models.simulator import Scenario, Session, Conversation, Message
from app.api.simulator import get_db
from app.services.persona_service import get_persona_brief, PERSONAS
from app.services.scenario_service import get_scenario_brief, SCENARIOS
from app.services.simulator_state import (
    initial_state,
    update_state,
    is_resolved,
    is_escalated,
)
from app.services.simulator_service import generate_customer_turn


# ---------------------------------------------------------------------------
# Test Database Isolation & Pytest Fixtures
# ---------------------------------------------------------------------------

TEST_DB_FILE = "test_simulator.db"
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
    """Sets up an isolated SQLite test database and overrides FastAPI dependency."""
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass

    # Create all simulator tables in the test database
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
    """FastAPI TestClient fixture."""
    return TestClient(app)


# ---------------------------------------------------------------------------
# Section 1: Unit Tests for simulator_state.py (No DB, No HTTP, No LLM)
# ---------------------------------------------------------------------------

def test_empathy_signals_lower_frustration_and_raise_trust():
    """An agent response with empathy signals lowers frustration and raises trust/satisfaction."""
    initial = {
        "frustration": 65,
        "trust": 40,
        "patience": 45,
        "satisfaction": 30,
        "escalation_intent": 55,
    }
    agent_response = "I understand, I'm sorry for the trouble, let me fix this right away."
    updated = update_state(initial, agent_response, persona="calm")

    assert updated["frustration"] < initial["frustration"], (
        f"Frustration should decrease: was {initial['frustration']}, now {updated['frustration']}"
    )
    assert updated["trust"] > initial["trust"], (
        f"Trust should increase: was {initial['trust']}, now {updated['trust']}"
    )
    assert updated["satisfaction"] > initial["satisfaction"], (
        f"Satisfaction should increase: was {initial['satisfaction']}, now {updated['satisfaction']}"
    )
    assert updated["patience"] >= initial["patience"], (
        f"Patience should increase: was {initial['patience']}, now {updated['patience']}"
    )


def test_dismissive_signals_increase_frustration_and_lower_trust():
    """A dismissive agent response raises frustration/escalation and lowers trust/patience."""
    initial = {
        "frustration": 35,
        "trust": 65,
        "patience": 60,
        "satisfaction": 50,
        "escalation_intent": 25,
    }
    agent_response = "Not possible, that's against our policy. Nothing I can do."
    updated = update_state(initial, agent_response, persona="calm")

    assert updated["frustration"] > initial["frustration"], (
        f"Frustration should increase: was {initial['frustration']}, now {updated['frustration']}"
    )
    assert updated["escalation_intent"] > initial["escalation_intent"], (
        f"Escalation intent should increase: was {initial['escalation_intent']}, now {updated['escalation_intent']}"
    )
    assert updated["trust"] < initial["trust"], (
        f"Trust should decrease: was {initial['trust']}, now {updated['trust']}"
    )
    assert updated["patience"] < initial["patience"], (
        f"Patience should decrease: was {initial['patience']}, now {updated['patience']}"
    )


def test_persona_escalation_tendency_multiplier_difference():
    """A dismissive response produces a larger frustration delta for angry (high) than calm (low)."""
    base_state = {
        "frustration": 30,
        "trust": 50,
        "patience": 60,
        "satisfaction": 40,
        "escalation_intent": 20,
    }
    dismissive_msg = "Not possible, that's against our policy."

    angry_state = update_state(base_state, dismissive_msg, persona="angry")
    calm_state = update_state(base_state, dismissive_msg, persona="calm")

    angry_delta = angry_state["frustration"] - base_state["frustration"]
    calm_delta = calm_state["frustration"] - base_state["frustration"]

    assert angry_delta > calm_delta, (
        f"Angry frustration delta ({angry_delta}) should be greater than calm delta ({calm_delta})"
    )


def test_is_resolved_condition():
    """is_resolved returns True only when satisfaction >= 75 and frustration <= 25."""
    passing_state = {"satisfaction": 75, "frustration": 25, "trust": 80, "patience": 70, "escalation_intent": 10}
    high_satisfaction_state = {"satisfaction": 85, "frustration": 15, "trust": 90, "patience": 80, "escalation_intent": 5}
    failing_satisfaction = {"satisfaction": 74, "frustration": 25, "trust": 70, "patience": 60, "escalation_intent": 15}
    failing_frustration = {"satisfaction": 80, "frustration": 26, "trust": 70, "patience": 60, "escalation_intent": 15}

    assert is_resolved(passing_state) is True, "Boundary state (75 sat, 25 frust) should be resolved"
    assert is_resolved(high_satisfaction_state) is True, "High satisfaction state should be resolved"
    assert is_resolved(failing_satisfaction) is False, "Satisfaction < 75 should NOT be resolved"
    assert is_resolved(failing_frustration) is False, "Frustration > 25 should NOT be resolved"


def test_is_escalated_condition():
    """is_escalated returns True only when escalation_intent >= 85."""
    assert is_escalated({"escalation_intent": 85}) is True, "85 escalation_intent should be escalated"
    assert is_escalated({"escalation_intent": 95}) is True, "95 escalation_intent should be escalated"
    assert is_escalated({"escalation_intent": 84}) is False, "84 escalation_intent should NOT be escalated"
    assert is_escalated({"escalation_intent": 40}) is False, "40 escalation_intent should NOT be escalated"


def test_initial_state_severity_comparison():
    """issue_severity=5 produces higher starting frustration and escalation than issue_severity=1."""
    state_sev1 = initial_state(persona="calm", initial_emotion="calm", issue_severity=1, patience_level=3)
    state_sev5 = initial_state(persona="calm", initial_emotion="calm", issue_severity=5, patience_level=3)

    assert state_sev5["frustration"] > state_sev1["frustration"], (
        f"Severity 5 frustration ({state_sev5['frustration']}) must exceed severity 1 ({state_sev1['frustration']})"
    )
    assert state_sev5["escalation_intent"] > state_sev1["escalation_intent"], (
        f"Severity 5 escalation ({state_sev5['escalation_intent']}) must exceed severity 1 ({state_sev1['escalation_intent']})"
    )


# ---------------------------------------------------------------------------
# Section 2: Unit Tests for persona_service.py / scenario_service.py
# ---------------------------------------------------------------------------

def test_persona_and_scenario_brief_content():
    """Brief functions return non-empty strings containing expected key terms."""
    persona_brief = get_persona_brief("angry")
    assert isinstance(persona_brief, str) and len(persona_brief) > 0, "Persona brief must not be empty"
    assert "Angry" in persona_brief, "Persona brief should identify the Angry persona"
    assert "Tone:" in persona_brief, "Persona brief should describe tone"
    assert "Escalation Tendency:" in persona_brief, "Persona brief should include escalation tendency"

    scenario_brief = get_scenario_brief("refund")
    assert isinstance(scenario_brief, str) and len(scenario_brief) > 0, "Scenario brief must not be empty"
    assert "Refund" in scenario_brief, "Scenario brief should identify the scenario"
    assert "Opening Complaint:" in scenario_brief, "Scenario brief must include the opening complaint"
    assert "Key Facts:" in scenario_brief, "Scenario brief must list key facts"


def test_persona_and_scenario_invalid_keys_raise_value_error():
    """Invalid keys raise ValueError and list available valid options in the message."""
    with pytest.raises(ValueError) as exc_p:
        get_persona_brief("joyful")
    p_error = str(exc_p.value)
    assert "Invalid persona 'joyful'" in p_error
    for expected_persona in ["calm", "confused", "frustrated", "angry", "impatient", "polite"]:
        assert expected_persona in p_error, f"Error message must list '{expected_persona}'"

    with pytest.raises(ValueError) as exc_s:
        get_scenario_brief("broken_hardware")
    s_error = str(exc_s.value)
    assert "Invalid scenario type 'broken_hardware'" in s_error
    for expected_scenario in ["refund", "delayed_order", "payment_failure", "account_issue", "cancellation"]:
        assert expected_scenario in s_error, f"Error message must list '{expected_scenario}'"


# ---------------------------------------------------------------------------
# Section 3: Unit Tests for simulator_service.py (Mocked LLM)
# ---------------------------------------------------------------------------

def test_generate_customer_turn_success(monkeypatch):
    """generate_customer_turn returns cleaned LLM response and invokes update_state properly."""
    fake_reply = 'Customer: "Alright, please make sure the refund is completed quickly."'
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: fake_reply
    )

    state = initial_state("calm", "calm", 2, 4)
    result = generate_customer_turn(
        persona="calm",
        scenario="refund",
        state=state,
        conversation_history=[],
        agent_response="I understand your concern and I have issued your refund right away."
    )

    assert result["customer_message"] == "Alright, please make sure the refund is completed quickly.", (
        f"Customer message should be cleaned of quotes/prefix: {result['customer_message']}"
    )
    assert result["updated_state"]["frustration"] < state["frustration"], "Frustration should have decreased"
    assert "is_resolved" in result, "Turn result must include is_resolved"
    assert "is_escalated" in result, "Turn result must include is_escalated"


def test_generate_customer_turn_fallback_on_exception(monkeypatch):
    """When Gemini raises an exception, generate_customer_turn falls back to a persona sample phrase."""
    def fail_gemini(prompt):
        raise RuntimeError("Quota exceeded or API connection failed")

    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        fail_gemini
    )

    state = initial_state("angry", "angry", 4, 2)
    result = generate_customer_turn(
        persona="angry",
        scenario="refund",
        state=state,
        conversation_history=[],
        agent_response="We cannot process that request."
    )

    assert result["customer_message"] in PERSONAS["angry"]["sample_phrases"], (
        f"Customer message must fall back to an angry sample phrase, got: {result['customer_message']}"
    )
    assert isinstance(result["updated_state"], dict), "Updated state must still be a dictionary"
    assert "frustration" in result["updated_state"], "Updated state must track emotional metrics"


# ---------------------------------------------------------------------------
# Section 4: Integration Tests via FastAPI TestClient (3 Combinations + Errors)
# ---------------------------------------------------------------------------

def test_scenario_angry_refund_e2e(client, monkeypatch):
    """E2E Test 1: Angry persona in a refund scenario."""
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "I see the refund request, but when will the money actually be in my account?"
    )

    # 1. Start simulation
    start_resp = client.post("/simulator/start", json={
        "session_label": "Test Angry Refund Session",
        "persona": "angry",
        "scenario": "refund",
        "initial_emotion": "angry",
        "issue_severity": 4,
        "patience_level": 2,
        "expected_resolution": "Full refund of $49.99 processed",
    })
    assert start_resp.status_code == 200, f"Start failed: {start_resp.text}"
    start_data = start_resp.json()
    session_id = start_data["session_id"]
    assert start_data["turn"] == 1
    assert "customer_message" in start_data
    state_turn1 = start_data["state"]

    # 2. Empathetic agent response -> state improves
    msg1_resp = client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "I sincerely apologize for the frustration. I have submitted your full refund of $49.99 right away."
    })
    assert msg1_resp.status_code == 200, f"Turn 2 failed: {msg1_resp.text}"
    msg1_data = msg1_resp.json()
    assert msg1_data["turn"] == 2
    state_turn2 = msg1_data["state"]
    assert state_turn2["frustration"] < state_turn1["frustration"], "Frustration should drop after empathy"
    assert state_turn2["trust"] > state_turn1["trust"], "Trust should rise after empathy"

    # 3. Dismissive agent response -> state worsens
    msg2_resp = client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "Policy doesn't allow any expedited processing. Nothing I can do, call your bank."
    })
    assert msg2_resp.status_code == 200, f"Turn 3 failed: {msg2_resp.text}"
    msg2_data = msg2_resp.json()
    assert msg2_data["turn"] == 3
    state_turn3 = msg2_data["state"]
    assert state_turn3["frustration"] > state_turn2["frustration"], "Frustration should rise after dismissive response"
    assert state_turn3["escalation_intent"] > state_turn2["escalation_intent"], "Escalation should rise"


def test_scenario_polite_delayed_order_e2e(client, monkeypatch):
    """E2E Test 2: Polite persona in a delayed_order scenario."""
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "Thank you so much for looking into the courier tracking for me."
    )

    start_resp = client.post("/simulator/start", json={
        "session_label": "Test Polite Delayed Order Session",
        "persona": "polite",
        "scenario": "delayed_order",
        "initial_emotion": "calm",
        "issue_severity": 2,
        "patience_level": 5,
        "expected_resolution": "Tracking update and waived shipping fee",
    })
    assert start_resp.status_code == 200, f"Start failed: {start_resp.text}"
    start_data = start_resp.json()
    session_id = start_data["session_id"]
    state_turn1 = start_data["state"]

    # Empathetic response
    msg_resp = client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "I understand how important this delivery is. I'm happy to help waive the shipping fee and track this right away."
    })
    assert msg_resp.status_code == 200
    msg_data = msg_resp.json()
    assert msg_data["session_id"] == session_id
    assert msg_data["turn"] == 2
    assert "is_resolved" in msg_data
    assert "is_escalated" in msg_data
    assert msg_data["state"]["satisfaction"] > state_turn1["satisfaction"], "Satisfaction should increase"


def test_scenario_impatient_payment_failure_e2e(client, monkeypatch):
    """E2E Test 3: Impatient persona in a payment_failure scenario."""
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "Just give me the alternate payment link right now so I can finish this."
    )

    start_resp = client.post("/simulator/start", json={
        "session_label": "Test Impatient Payment Failure Session",
        "persona": "impatient",
        "scenario": "payment_failure",
        "initial_emotion": "impatient",
        "issue_severity": 3,
        "patience_level": 1,
        "expected_resolution": "Alternate payment checkout link verified",
    })
    assert start_resp.status_code == 200
    start_data = start_resp.json()
    session_id = start_data["session_id"]
    state_turn1 = start_data["state"]

    # Empathetic response with resolution keyword
    msg_resp = client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "I understand you are in a hurry. Let me help you with an alternate link right away to get this resolved."
    })
    assert msg_resp.status_code == 200
    msg_data = msg_resp.json()
    assert msg_data["turn"] == 2
    assert msg_data["state"]["frustration"] < state_turn1["frustration"]


def test_start_with_invalid_scenario_returns_400(client):
    """POST /simulator/start with an invalid scenario returns 400 Bad Request."""
    resp = client.post("/simulator/start", json={
        "session_label": "Invalid Scenario Session",
        "persona": "calm",
        "scenario": "unsupported_scenario_type",
        "initial_emotion": "calm",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "None",
    })
    assert resp.status_code == 400, f"Expected 400, got: {resp.status_code}"
    error_detail = resp.json()["detail"]
    assert "Invalid scenario type" in error_detail


def test_message_with_nonexistent_session_returns_404(client):
    """POST /simulator/message with a nonexistent session_id returns 404 Not Found."""
    resp = client.post("/simulator/message", json={
        "session_id": 999999,
        "agent_response": "Hello, how may I help you?",
    })
    assert resp.status_code == 404, f"Expected 404, got: {resp.status_code}"
    assert "Simulator session not found" in resp.json()["detail"]


def test_get_history_excludes_system_messages(client, monkeypatch):
    """GET /simulator/{session_id}/history returns only dialogue messages, excluding System rows."""
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "I got the updated invoice, thank you."
    )

    # Start session (creates Customer opening message + System state message)
    start_resp = client.post("/simulator/start", json={
        "session_label": "History Test Session",
        "persona": "calm",
        "scenario": "cancellation",
        "initial_emotion": "calm",
        "issue_severity": 1,
        "patience_level": 4,
        "expected_resolution": "Subscription cancelled cleanly",
    })
    session_id = start_resp.json()["session_id"]

    # Send one agent message (creates Agent message + Customer reply + System state message)
    client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "I can help you cancel your subscription right away."
    })

    # Fetch history
    hist_resp = client.get(f"/simulator/{session_id}/history")
    assert hist_resp.status_code == 200
    hist_data = hist_resp.json()

    messages = hist_data["messages"]
    # Total dialogue messages should be 3: Customer opening -> Support Agent -> Customer reply
    assert len(messages) == 3, f"Expected 3 dialogue messages, found {len(messages)}"

    for msg in messages:
        assert msg["message_type"] != "System", (
            f"System message should be excluded from history endpoint: {msg}"
        )
        assert msg["sender_type"] in ["Customer", "Support Agent"], (
            f"Unexpected sender type in history: {msg['sender_type']}"
        )
