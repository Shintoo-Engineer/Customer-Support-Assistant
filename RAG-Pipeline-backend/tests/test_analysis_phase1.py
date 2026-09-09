"""Tests for Task 4 Phase 1: Foundation, API Contracts, and Schema Validation."""

import os
import sys
from unittest.mock import MagicMock
import pytest
from pydantic import ValidationError

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
    AnalysisRequest,
    AnalysisResponse,
)
from app.services.analysis_service import (
    get_conversation_context,
    analyze_customer_message,
)


# ---------------------------------------------------------------------------
# Isolated Test Database
# ---------------------------------------------------------------------------

TEST_DB_FILE = "test_analysis_phase1.db"
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
# Section 1: Pydantic Schema Unit Tests
# ---------------------------------------------------------------------------

def test_analysis_request_valid():
    """Valid request payload passes schema validation."""
    req = AnalysisRequest(
        session_id=1,
        customer_message="I have been waiting for my refund for 10 days!"
    )
    assert req.session_id == 1
    assert req.customer_message == "I have been waiting for my refund for 10 days!"


def test_analysis_request_missing_fields():
    """Missing session_id or customer_message raises ValidationError."""
    with pytest.raises(ValidationError):
        AnalysisRequest(customer_message="Hello")

    with pytest.raises(ValidationError):
        AnalysisRequest(session_id=1)


def test_analysis_request_invalid_session_id():
    """session_id <= 0 or invalid type raises ValidationError."""
    with pytest.raises(ValidationError):
        AnalysisRequest(session_id=0, customer_message="Hello")

    with pytest.raises(ValidationError):
        AnalysisRequest(session_id=-5, customer_message="Hello")

    with pytest.raises(ValidationError):
        AnalysisRequest(session_id="not_a_number", customer_message="Hello")


def test_analysis_request_empty_message():
    """Empty customer_message raises ValidationError due to min_length=1."""
    with pytest.raises(ValidationError):
        AnalysisRequest(session_id=1, customer_message="")


def test_analysis_response_valid():
    """Valid response dictionary passes schema validation."""
    resp = AnalysisResponse(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=8,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.HIGH,
        confidence=0.94
    )
    assert resp.intent == CustomerIntent.REFUND
    assert resp.emotion == CustomerEmotion.FRUSTRATED
    assert resp.sentiment == CustomerSentiment.NEGATIVE
    assert resp.frustration_level == 8
    assert resp.satisfaction_trend == SatisfactionTrend.DECLINING
    assert resp.escalation_risk == EscalationRisk.HIGH
    assert resp.confidence == 0.94


def test_analysis_response_enum_values_enforced():
    """Invalid enum strings raise ValidationError."""
    with pytest.raises(ValidationError):
        AnalysisResponse(
            intent="invalid_intent_xyz",
            emotion=CustomerEmotion.NEUTRAL,
            sentiment=CustomerSentiment.NEUTRAL,
            frustration_level=5,
            satisfaction_trend=SatisfactionTrend.STABLE,
            escalation_risk=EscalationRisk.LOW,
            confidence=0.9
        )

    with pytest.raises(ValidationError):
        AnalysisResponse(
            intent=CustomerIntent.REFUND,
            emotion="ecstatic_not_in_enum",
            sentiment=CustomerSentiment.NEUTRAL,
            frustration_level=5,
            satisfaction_trend=SatisfactionTrend.STABLE,
            escalation_risk=EscalationRisk.LOW,
            confidence=0.9
        )


def test_analysis_response_numeric_boundaries():
    """frustration_level outside [0, 10] or confidence outside [0.0, 1.0] raises ValidationError."""
    # frustration_level > 10
    with pytest.raises(ValidationError):
        AnalysisResponse(
            intent=CustomerIntent.REFUND,
            emotion=CustomerEmotion.FRUSTRATED,
            sentiment=CustomerSentiment.NEGATIVE,
            frustration_level=11,
            satisfaction_trend=SatisfactionTrend.DECLINING,
            escalation_risk=EscalationRisk.HIGH,
            confidence=0.8
        )

    # frustration_level < 0
    with pytest.raises(ValidationError):
        AnalysisResponse(
            intent=CustomerIntent.REFUND,
            emotion=CustomerEmotion.FRUSTRATED,
            sentiment=CustomerSentiment.NEGATIVE,
            frustration_level=-1,
            satisfaction_trend=SatisfactionTrend.DECLINING,
            escalation_risk=EscalationRisk.HIGH,
            confidence=0.8
        )

    # confidence > 1.0
    with pytest.raises(ValidationError):
        AnalysisResponse(
            intent=CustomerIntent.REFUND,
            emotion=CustomerEmotion.FRUSTRATED,
            sentiment=CustomerSentiment.NEGATIVE,
            frustration_level=5,
            satisfaction_trend=SatisfactionTrend.DECLINING,
            escalation_risk=EscalationRisk.HIGH,
            confidence=1.05
        )

    # confidence < 0.0
    with pytest.raises(ValidationError):
        AnalysisResponse(
            intent=CustomerIntent.REFUND,
            emotion=CustomerEmotion.FRUSTRATED,
            sentiment=CustomerSentiment.NEGATIVE,
            frustration_level=5,
            satisfaction_trend=SatisfactionTrend.DECLINING,
            escalation_risk=EscalationRisk.HIGH,
            confidence=-0.1
        )


# ---------------------------------------------------------------------------
# Section 2: Context Retrieval & Service Tests
# ---------------------------------------------------------------------------

def test_get_conversation_context_existing_session():
    """get_conversation_context extracts scenario and ordered dialogue messages."""
    db = TestingSessionLocal()
    try:
        scenario = Scenario(
            title="Context Test Scenario",
            category="refund",
            difficulty="Medium",
            objective="Process refund",
            description="Test description"
        )
        db.add(scenario)
        db.flush()

        session = SimSession(
            scenario_id=scenario.scenario_id,
            status="In Progress"
        )
        db.add(session)
        db.flush()

        conversation = Conversation(
            session_id=session.session_id,
            intent="refund",
            sentiment="frustrated"
        )
        db.add(conversation)
        db.flush()

        msg1 = Message(
            conversation_id=conversation.conversation_id,
            sender_type="Customer",
            message_text="Where is my refund?",
            message_type="Text"
        )
        msg_system = Message(
            conversation_id=conversation.conversation_id,
            sender_type="AI",
            message_text='{"state": {}}',
            message_type="System"
        )
        msg2 = Message(
            conversation_id=conversation.conversation_id,
            sender_type="Support Agent",
            message_text="I am checking on it now.",
            message_type="Text"
        )
        db.add_all([msg1, msg_system, msg2])
        db.commit()

        context = get_conversation_context(session.session_id, db)
        assert context is not None
        assert context["session_id"] == session.session_id
        assert context["scenario_category"] == "refund"
        assert len(context["dialogue_history"]) == 2
        assert context["dialogue_history"][0]["sender_type"] == "Customer"
        assert context["dialogue_history"][1]["sender_type"] == "Support Agent"
    finally:
        db.close()


def test_get_conversation_context_nonexistent_session():
    """get_conversation_context returns None for unknown session."""
    db = TestingSessionLocal()
    try:
        context = get_conversation_context(999999, db)
        assert context is None
    finally:
        db.close()


def test_analyze_customer_message_service():
    """analyze_customer_message returns contract-compliant AnalysisResponse."""
    db = TestingSessionLocal()
    try:
        scenario = Scenario(title="Service Test", category="refund", difficulty="Low")
        db.add(scenario)
        db.flush()
        session = SimSession(scenario_id=scenario.scenario_id)
        db.add(session)
        db.commit()

        result = analyze_customer_message(
            session_id=session.session_id,
            customer_message="Please check my status.",
            db=db
        )
        assert isinstance(result, AnalysisResponse)
        assert result.confidence >= 0.0 and result.confidence <= 1.0
        assert result.frustration_level >= 0 and result.frustration_level <= 10
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Section 3: API Endpoint Tests (POST /analysis/analyze)
# ---------------------------------------------------------------------------

def test_api_analyze_valid_request(client):
    """POST /analysis/analyze returns 200 and schema-conforming response."""
    # Start a simulator session first to establish an existing session ID
    start_resp = client.post("/simulator/start", json={
        "session_label": "Analysis API Test Session",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "calm",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Full refund"
    })
    assert start_resp.status_code == 200
    session_id = start_resp.json()["session_id"]

    # Now call POST /analysis/analyze
    resp = client.post("/analysis/analyze", json={
        "session_id": session_id,
        "customer_message": "Can you check the progress of my refund?"
    })
    assert resp.status_code == 200
    data = resp.json()

    assert "intent" in data
    assert "emotion" in data
    assert "sentiment" in data
    assert "frustration_level" in data
    assert "satisfaction_trend" in data
    assert "escalation_risk" in data
    assert "confidence" in data

    # Validate against Pydantic schema
    validated = AnalysisResponse(**data)
    assert validated.confidence >= 0.0


def test_api_analyze_nonexistent_session(client):
    """POST /analysis/analyze with unknown session_id returns 404."""
    resp = client.post("/analysis/analyze", json={
        "session_id": 999999,
        "customer_message": "Hello?"
    })
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_api_analyze_missing_fields(client):
    """POST /analysis/analyze with missing fields returns 422."""
    resp = client.post("/analysis/analyze", json={
        "customer_message": "Missing session ID"
    })
    assert resp.status_code == 422


def test_api_analyze_empty_message(client):
    """POST /analysis/analyze with empty customer_message returns 422."""
    resp = client.post("/analysis/analyze", json={
        "session_id": 1,
        "customer_message": ""
    })
    assert resp.status_code == 422


def test_api_analyze_malformed_json(client):
    """POST /analysis/analyze with malformed body returns 422."""
    resp = client.post(
        "/analysis/analyze",
        content="not valid json",
        headers={"Content-Type": "application/json"}
    )
    assert resp.status_code == 422
