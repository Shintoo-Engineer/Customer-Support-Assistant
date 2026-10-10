"""
Automated Test Suite for Task 8:
- Post-Interaction Summary
- Sentiment Journey Timeline
- Resolution Quality Score Calculation
- Strengths & Weaknesses Derivation
- Coaching Recommendations
- System-Wide Performance Analytics Aggregation
- Empty Database Handling
- API Endpoints
"""

import json
from datetime import datetime
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.models.database import Base
from app.models.simulator import (
    Scenario,
    Session,
    Conversation,
    Message,
    SessionSummary,
)
from app.services.summary_service import (
    calculate_resolution_quality_score,
    calculate_empathy_and_communication_scores,
    calculate_policy_adherence_score,
    derive_strengths_and_weaknesses,
    generate_conversation_summary,
    generate_session_summary,
)
from app.services.analytics_service import (
    calculate_performance_analytics,
)
from app.api.analytics import get_db


# ============================================================================
# TEST DATABASE FIXTURE
# ============================================================================

TEST_DB_URL = "sqlite:///./test_task8.db"
test_engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="module")
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session(setup_db):
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    test_client = TestClient(app)
    yield test_client
    app.dependency_overrides.clear()


# ============================================================================
# UNIT TESTS: FORMULAS & METRICS
# ============================================================================

def test_resolution_quality_score_resolved_positive():
    """A resolved conversation where frustration dropped from 8 to 0 should yield a high score."""
    score = calculate_resolution_quality_score(
        resolution_status="Resolved",
        initial_frustration=8,
        final_frustration=0,
        peak_frustration=8,
        escalation_risk="Low",
        turn_count=3,
    )
    # Base 100 - (0*4) + 15(delta bonus) - (8*1.5) - 0 + 10(resolved) = 100 + 15 - 12 + 10 = 113 -> clamped to 100.0
    assert score == 100.0


def test_resolution_quality_score_escalated_critical():
    """An escalated conversation with critical risk and high final frustration should yield a low score."""
    score = calculate_resolution_quality_score(
        resolution_status="Escalated",
        initial_frustration=6,
        final_frustration=10,
        peak_frustration=10,
        escalation_risk="Critical",
        turn_count=3,
    )
    # Base 100 - (10*4=40) - (4*3=12) - (10*1.5=15) - 25(critical) - 25(escalated) = 100 - 40 - 12 - 15 - 25 - 25 = -17 -> clamped to 0.0
    assert score == 0.0


def test_resolution_quality_score_unresolved_moderate():
    """An unresolved conversation with moderate frustration."""
    score = calculate_resolution_quality_score(
        resolution_status="Unresolved",
        initial_frustration=4,
        final_frustration=4,
        peak_frustration=5,
        escalation_risk="Low",
        turn_count=2,
    )
    # Base 100 - (4*4=16) + 0 - (5*1.5=7.5) - 0 - 15(unresolved) = 100 - 16 - 7.5 - 15 = 61.5
    assert score == 61.5


def test_empathy_and_communication_scoring():
    """Tests empathy and communication scoring with positive and negative agent responses."""
    agent_msgs_good = [
        "I completely understand your frustration and I sincerely apologize for the delay.",
        "Let me check the policy details and outline the next steps to resolve your order.",
    ]
    empathy, comm_score, rating = calculate_empathy_and_communication_scores(
        agent_messages=agent_msgs_good,
        customer_turns=[{"frustration_level": 7}, {"frustration_level": 2}],
    )
    assert empathy >= 70.0
    assert comm_score >= 70.0
    assert rating == "Good"

    agent_msgs_poor = ["Ok.", "No."]
    empathy_poor, comm_score_poor, rating_poor = calculate_empathy_and_communication_scores(
        agent_messages=agent_msgs_poor,
        customer_turns=[{"frustration_level": 7}],
    )
    assert empathy_poor < 70.0
    assert rating_poor == "Needs Improvement"


def test_policy_adherence_scoring():
    """Tests policy adherence score calculation."""
    recs = [{"relevance_score": 0.95, "document_name": "refund_policy_v2.pdf"}]
    msgs = ["Under our policy, returns are eligible within 15 calendar days."]
    score, note = calculate_policy_adherence_score(recs, msgs)
    assert score >= 85.0
    assert "refund_policy_v2.pdf" in note


def test_strengths_and_weaknesses_derivation():
    """Tests strengths, weaknesses, and coaching recommendation synthesis."""
    journey = [
        {"turn": 1, "frustration_level": 8, "escalation_risk": "High"},
        {"turn": 2, "frustration_level": 1, "escalation_risk": "Low"},
    ]
    agent_msgs = ["I apologize for the trouble and am happy to help resolve this today."]
    strengths, weaknesses, recs = derive_strengths_and_weaknesses(
        agent_messages=agent_msgs,
        sentiment_journey=journey,
        resolution_status="Resolved",
        resolution_quality_score=92.0,
        empathy_score=85.0,
    )
    assert any("de-escalated" in s.lower() for s in strengths)
    assert any("resolved" in s.lower() for s in strengths)
    assert len(recs) > 0


# ============================================================================
# CONVERSATION SUMMARY GENERATION TESTS (MANUAL & REPLAY)
# ============================================================================

def test_generate_conversation_summary_empty():
    """Empty conversation returns clean zero/fallback structure without crashing."""
    result = generate_conversation_summary(messages=[])
    assert result["total_turns"] == 0
    assert result["resolution_quality_score"] == 50.0
    assert result["sentiment_journey"] == []


def test_generate_conversation_summary_multi_turn():
    """Generates structured report across a 3-turn customer/agent conversation."""
    messages = [
        {"sender": "customer", "text": "My package was not delivered and it has been 10 days!"},
        {"sender": "agent", "text": "I apologize for the delay. Let me track the shipment details immediately."},
        {"sender": "customer", "text": "I really need this for my trip tomorrow!"},
        {"sender": "agent", "text": "Under our delivery policy, expedited replacements are shipped within 24 hours."},
        {"sender": "customer", "text": "Thank you, that would completely solve my issue!"},
    ]
    result = generate_conversation_summary(
        messages=messages,
        scenario_title="Delivery Delay Inquiry",
    )
    assert result["total_turns"] == 3
    assert len(result["sentiment_journey"]) == 3
    assert result["primary_customer_issue"] in ["Delivery Issue", "General Inquiry"]
    assert result["final_resolution"] == "Resolved"
    assert result["resolution_quality_score"] >= 80.0
    assert len(result["agent_strengths"]) > 0
    assert len(result["coaching_recommendations"]) > 0


# ============================================================================
# DATABASE SESSION SUMMARY & ANALYTICS INTEGRATION
# ============================================================================

def test_generate_session_summary_database(db_session):
    """Creates a session in the database, completes it, and verifies persisted SessionSummary."""
    # 1. Create scenario
    scenario = Scenario(
        title="Test Refund Scenario",
        category="refund",
        difficulty="Medium",
        is_active=True,
    )
    db_session.add(scenario)
    db_session.flush()

    # 2. Create session
    session = Session(
        scenario_id=scenario.scenario_id,
        status="In Progress",
    )
    db_session.add(session)
    db_session.flush()

    # 3. Create conversation & messages
    conv = Conversation(
        session_id=session.session_id,
        intent="refund_status",
        sentiment="Negative",
        resolution_status="In Progress",
        escalation_risk="Medium",
    )
    db_session.add(conv)
    db_session.flush()

    m1 = Message(
        conversation_id=conv.conversation_id,
        sender_type="Customer",
        message_text="I want a refund for item #999.",
    )
    m2 = Message(
        conversation_id=conv.conversation_id,
        sender_type="Support Agent",
        message_text="I understand and am happy to process this within our 15-day refund window.",
    )
    m3 = Message(
        conversation_id=conv.conversation_id,
        sender_type="Customer",
        message_text="Thank you so much, everything is settled.",
    )
    db_session.add_all([m1, m2, m3])
    db_session.commit()

    # Generate summary
    summary = generate_session_summary(
        session_id=session.session_id,
        db=db_session,
    )
    assert summary["session_id"] == session.session_id
    assert summary["final_resolution"] == "Resolved"
    assert summary["resolution_quality_score"] > 70.0

    # Verify persisted in SessionSummary table
    stored = (
        db_session.query(SessionSummary)
        .filter(SessionSummary.session_id == session.session_id)
        .first()
    )
    assert stored is not None
    assert stored.resolution_status == "Resolved"
    assert stored.resolution_quality_score == summary["resolution_quality_score"]


def test_performance_analytics_calculation(db_session):
    """Verifies calculate_performance_analytics computes correct rates and averages."""
    analytics = calculate_performance_analytics(db=db_session)
    assert analytics["total_sessions"] >= 1
    assert analytics["resolution_rate"] >= 0.0
    assert analytics["average_resolution_quality"] > 0.0
    assert isinstance(analytics["common_customer_intents"], list)
    assert isinstance(analytics["actionable_recommendations"], list)


# ============================================================================
# API ENDPOINT TESTS
# ============================================================================

def test_api_performance_analytics(client):
    """GET /api/analytics/performance returns status 200 with structured schema."""
    resp = client.get("/api/analytics/performance")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_sessions" in data
    assert "resolution_rate" in data
    assert "average_resolution_quality" in data
    assert "average_frustration" in data
    assert "escalation_frequency" in data
    assert "common_customer_intents" in data
    assert "actionable_recommendations" in data


def test_api_adhoc_summary(client):
    """POST /api/sessions/summary generates report from message list."""
    payload = {
        "messages": [
            {"sender": "customer", "text": "Can I cancel my account subscription?"},
            {"sender": "agent", "text": "I can help you cancel your subscription right away."},
            {"sender": "customer", "text": "Thanks, it is canceled now."},
        ],
        "scenario_title": "Cancellation Test",
        "resolution_status": "Resolved",
    }
    resp = client.post("/api/sessions/summary", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["final_resolution"] == "Resolved"
    assert data["resolution_quality_score"] >= 80.0
    assert len(data["sentiment_journey"]) == 2


def test_api_completed_sessions_list(client):
    """GET /api/sessions/completed returns list of completed sessions."""
    resp = client.get("/api/sessions/completed")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
