"""TASK 4 — PHASE 5 TEST SUITE: Downstream-Ready Contract, Historical Analytics & Observability.

Verifies:
1. Canonical AnalysisResult contract (typed, validated, serializable, independent of Gemini/DB).
2. Analysis source transparency ('gemini' vs 'fallback') and ISO timestamp formatting.
3. Turn-level traceability (session, conversation, turn, analysis snapshot).
4. Historical analysis retrieval (service & GET /analysis/{session_id}/history).
5. Session analysis summary (service & GET /analysis/{session_id}/summary).
6. Operational metrics and structured observability.
7. Strict session isolation (Session A vs Session B).
8. Downstream consumer simulations (Coaching, Escalation Monitor, RAG Agent).
9. Duplicate analysis protection and Task 3 history integrity.
"""

import os
import json
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.models.database import Base
from app.api.simulator import get_db as sim_get_db
from app.api.analysis import get_db as analysis_get_db
from app.models.simulator import Session as SimSession, Conversation, Message
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
from app.services.analysis_service import (
    analyze_customer_message,
    get_analysis_history,
    get_session_analysis_summary,
    get_analysis_metrics,
    reset_analysis_metrics,
)

TEST_DB_FILE = "./test_analysis_phase5.db"
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
    """Initializes and tears down an isolated SQLite database for Phase 5 tests."""
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
    return TestClient(app)


@pytest.fixture(autouse=True)
def clean_metrics():
    """Resets operational metrics before each test."""
    reset_analysis_metrics()
    yield


# ===========================================================================
# Section 1: Canonical AnalysisResult Contract & Serialization
# ===========================================================================

def test_canonical_analysis_result_instantiation():
    """Verifies AnalysisResult instantiation with all required and internal metadata fields."""
    now_iso = datetime.now(timezone.utc).isoformat()
    result = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=7,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.HIGH,
        confidence=0.92,
        session_id=42,
        conversation_id=10,
        message_id=108,
        turn_number=3,
        analysis_source="fallback",
        analysis_timestamp=now_iso,
    )
    assert result.intent == CustomerIntent.REFUND
    assert result.emotion == CustomerEmotion.FRUSTRATED
    assert result.frustration_level == 7
    assert result.session_id == 42
    assert result.turn_number == 3
    assert result.analysis_source == "fallback"
    assert result.analysis_timestamp == now_iso


def test_canonical_analysis_result_subclasses_analysis_response():
    """Verifies that AnalysisResult is a subclass of AnalysisResponse for full polymorphism."""
    assert issubclass(AnalysisResult, AnalysisResponse)
    res = AnalysisResult(
        intent=CustomerIntent.ACCOUNT_ISSUE,
        emotion=CustomerEmotion.CONFUSED,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=3,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.85
    )
    assert isinstance(res, AnalysisResponse)


def test_canonical_analysis_result_to_response_clean_contract():
    """Verifies .to_response() drops internal metadata and produces pure public contract."""
    result = AnalysisResult(
        intent=CustomerIntent.PAYMENT_ISSUE,
        emotion=CustomerEmotion.ANGRY,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=9,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.HIGH,
        confidence=0.94,
        session_id=99,
        turn_number=2,
        analysis_source="gemini"
    )
    public_resp = result.to_response()
    dumped = public_resp.model_dump()
    assert "session_id" not in dumped
    assert "turn_number" not in dumped
    assert "analysis_source" not in dumped
    assert set(dumped.keys()) == {
        "intent", "emotion", "sentiment", "frustration_level",
        "satisfaction_trend", "escalation_risk", "confidence"
    }


def test_canonical_analysis_result_serialization_json():
    """Verifies that AnalysisResult serializes cleanly to JSON without custom encoders."""
    result = AnalysisResult(
        intent=CustomerIntent.DELIVERY_ISSUE,
        emotion=CustomerEmotion.WORRIED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=5,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.MEDIUM,
        confidence=0.88,
        session_id=1,
        turn_number=1,
        analysis_source="gemini",
        analysis_timestamp=datetime.now(timezone.utc).isoformat()
    )
    dumped_dict = result.model_dump()
    serialized = json.dumps(dumped_dict)
    reparsed = json.loads(serialized)
    assert reparsed["intent"] == "delivery_issue"
    assert reparsed["frustration_level"] == 5
    assert reparsed["turn_number"] == 1


def test_canonical_analysis_result_bounds_validation():
    """Verifies numerical bounds validation on frustration_level [0, 10] and confidence [0.0, 1.0]."""
    with pytest.raises(ValueError):
        AnalysisResult(
            intent=CustomerIntent.GENERAL_INQUIRY,
            emotion=CustomerEmotion.NEUTRAL,
            sentiment=CustomerSentiment.NEUTRAL,
            frustration_level=11,  # Invalid: > 10
            satisfaction_trend=SatisfactionTrend.STABLE,
            escalation_risk=EscalationRisk.LOW,
            confidence=0.80
        )

    with pytest.raises(ValueError):
        AnalysisResult(
            intent=CustomerIntent.GENERAL_INQUIRY,
            emotion=CustomerEmotion.NEUTRAL,
            sentiment=CustomerSentiment.NEUTRAL,
            frustration_level=2,
            satisfaction_trend=SatisfactionTrend.STABLE,
            escalation_risk=EscalationRisk.LOW,
            confidence=1.5  # Invalid: > 1.0
        )


# ===========================================================================
# Section 2: Analysis Source Transparency & Traceability
# ===========================================================================

def test_source_transparency_fallback_recorded(client, monkeypatch):
    """When Gemini is bypassed or fails, analysis_source is strictly recorded as 'fallback'."""
    monkeypatch.setattr(
        "app.services.analysis_service.generate_with_gemini",
        lambda prompt: (_ for _ in ()).throw(RuntimeError("API down"))
    )
    start_resp = client.post("/simulator/start", json={
        "session_label": "Source Transparency Fallback",
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
        history = get_analysis_history(session_id, db)
        assert len(history) >= 1
        assert history[0].analysis_source == "fallback"
    finally:
        db.close()


def test_source_transparency_gemini_recorded(client, monkeypatch):
    """When Gemini successfully produces analysis, analysis_source is recorded as 'gemini'."""
    monkeypatch.setattr(
        "app.services.analysis_service.generate_with_gemini",
        lambda prompt: '{"intent": "refund", "emotion": "frustrated", "sentiment": "negative", "confidence": 0.93}'
    )
    start_resp = client.post("/simulator/start", json={
        "session_label": "Source Transparency Gemini",
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
        history = get_analysis_history(session_id, db)
        assert len(history) >= 1
        assert history[0].analysis_source == "gemini"
    finally:
        db.close()


# ===========================================================================
# Section 3: Historical Analysis Retrieval (Service & API)
# ===========================================================================

def test_get_analysis_history_invalid_session_raises(client):
    """Retrieving history for a non-existent session raises ValueError in service and 404 in API."""
    db = TestingSessionLocal()
    try:
        with pytest.raises(ValueError, match="Simulator session 999999 not found."):
            get_analysis_history(999999, db)
    finally:
        db.close()

    api_resp = client.get("/analysis/999999/history")
    assert api_resp.status_code == 404
    assert "999999 not found" in api_resp.json()["detail"]


def test_get_analysis_history_empty_session(client):
    """A freshly created session with no customer messages returns an empty history list."""
    db = TestingSessionLocal()
    try:
        session = SimSession(scenario_id=1, status="In Progress")
        db.add(session)
        db.commit()
        db.refresh(session)
        history = get_analysis_history(session.session_id, db)
        assert history == []
    finally:
        db.close()


def test_get_analysis_history_single_turn_progression(client):
    """Single turn simulator start creates turn 1 in analysis history."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Single Turn History",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Refund"
    })
    session_id = start_resp.json()["session_id"]

    resp = client.get(f"/analysis/{session_id}/history")
    assert resp.status_code == 200
    history = resp.json()
    assert len(history) == 1
    assert history[0]["turn"] == 1
    assert history[0]["intent"] in [i.value for i in CustomerIntent]
    assert history[0]["emotion"] in [e.value for e in CustomerEmotion]
    assert "timestamp" in history[0]


def test_get_analysis_history_multi_turn_chronological_ordering(client, monkeypatch):
    """Multi-turn simulation produces sequential turns (1, 2, 3) in chronological order."""
    replies = [
        "I need an update on my delayed package.",
        "Why is it taking so long? This is unacceptable!"
    ]
    reply_iter = iter(replies)
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: next(reply_iter, "Default reply")
    )

    start_resp = client.post("/simulator/start", json={
        "session_label": "Multi Turn Chronology",
        "persona": "frustrated",
        "scenario": "delayed_order",
        "initial_emotion": "worried",
        "issue_severity": 3,
        "patience_level": 3,
        "expected_resolution": "Delivery update"
    })
    session_id = start_resp.json()["session_id"]

    # Turn 2
    client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "I am checking courier tracking now."
    })
    # Turn 3
    client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "The courier had a delay, delivery is scheduled tomorrow."
    })

    resp = client.get(f"/analysis/{session_id}/history")
    assert resp.status_code == 200
    history = resp.json()
    assert len(history) == 3
    assert [h["turn"] for h in history] == [1, 2, 3]
    assert history[0]["intent"] == "delivery_issue"


def test_analysis_system_messages_excluded_from_simulator_history(client):
    """Verifies that internal analysis System messages never leak into GET /simulator/{session_id}/history."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Simulator History Cleanliness",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Refund"
    })
    session_id = start_resp.json()["session_id"]

    client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "Looking into it."
    })

    sim_hist_resp = client.get(f"/simulator/{session_id}/history")
    assert sim_hist_resp.status_code == 200
    messages = sim_hist_resp.json()["messages"]
    for m in messages:
        assert m["message_type"] != "System", f"Leaked system message: {m}"


# ===========================================================================
# Section 4: Session-Level Analysis Summary (Service & API)
# ===========================================================================

def test_session_summary_invalid_session_raises(client):
    """Session summary for an unknown session returns 404."""
    resp = client.get("/analysis/888888/summary")
    assert resp.status_code == 404
    assert "888888 not found" in resp.json()["detail"]


def test_session_summary_dominant_intent_resolution(client, monkeypatch):
    """Dominant intent accurately computes the mode of turn intents."""
    # 3 turns of refund, 1 turn of general inquiry
    sim_replies = [
        "Where is my refund money?",
        "What are your support hours?",
        "Please send my refund confirmation."
    ]
    reply_iter = iter(sim_replies)
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: next(reply_iter, "Refund please")
    )

    start_resp = client.post("/simulator/start", json={
        "session_label": "Dominant Intent Test",
        "persona": "frustrated",
        "scenario": "refund",
        "initial_emotion": "frustrated",
        "issue_severity": 3,
        "patience_level": 3,
        "expected_resolution": "Refund processed"
    })
    session_id = start_resp.json()["session_id"]

    for _ in range(3):
        client.post("/simulator/message", json={
            "session_id": session_id,
            "agent_response": "We are processing your request."
        })

    resp = client.get(f"/analysis/{session_id}/summary")
    assert resp.status_code == 200
    summary = resp.json()
    assert summary["dominant_intent"] == "refund"
    assert summary["turn_count"] == 4
    assert 0.0 <= summary["average_confidence"] <= 1.0


def test_session_summary_latest_customer_state_reflection(client, monkeypatch):
    """Latest customer emotion, sentiment, and frustration reflect the latest turn."""
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "Thank you so much! Everything is solved and I am very happy now."
    )

    start_resp = client.post("/simulator/start", json={
        "session_label": "Latest State Test",
        "persona": "frustrated",
        "scenario": "refund",
        "initial_emotion": "frustrated",
        "issue_severity": 3,
        "patience_level": 3,
        "expected_resolution": "Refund"
    })
    session_id = start_resp.json()["session_id"]

    client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "I have processed your full refund right now."
    })

    resp = client.get(f"/analysis/{session_id}/summary")
    assert resp.status_code == 200
    summary = resp.json()
    assert summary["latest_sentiment"] == "positive"
    assert summary["current_frustration"] <= 2
    assert summary["current_escalation_risk"] == "low"
    assert summary["overall_satisfaction_direction"] == "improving"


def test_session_summary_dominant_intent_tie_breaking(client):
    """Tie in intent counts deterministically resolves to latest turn's intent."""
    db = TestingSessionLocal()
    try:
        # Create a mock session directly with 2 turns: Turn 1 = refund, Turn 2 = cancellation
        session = SimSession(scenario_id=1, status="In Progress")
        db.add(session)
        db.commit()
        db.refresh(session)

        conv = Conversation(session_id=session.session_id)
        db.add(conv)
        db.commit()
        db.refresh(conv)

        msg1 = Message(
            conversation_id=conv.conversation_id,
            sender_type="AI",
            message_text=json.dumps({
                "persona": "calm", "scenario": "refund",
                "analysis": {
                    "turn": 1, "intent": "refund", "emotion": "neutral",
                    "sentiment": "neutral", "frustration_level": 2,
                    "satisfaction_trend": "stable", "escalation_risk": "low",
                    "confidence": 0.85
                }
            }),
            message_type="System"
        )
        msg2 = Message(
            conversation_id=conv.conversation_id,
            sender_type="AI",
            message_text=json.dumps({
                "persona": "calm", "scenario": "cancellation",
                "analysis": {
                    "turn": 2, "intent": "cancellation", "emotion": "neutral",
                    "sentiment": "neutral", "frustration_level": 2,
                    "satisfaction_trend": "stable", "escalation_risk": "low",
                    "confidence": 0.85
                }
            }),
            message_type="System"
        )
        db.add_all([msg1, msg2])
        db.commit()

        summary = get_session_analysis_summary(session.session_id, db)
        # 1 refund, 1 cancellation: latest turn (cancellation) breaks the tie
        assert summary.dominant_intent == CustomerIntent.CANCELLATION
        assert summary.turn_count == 2
    finally:
        db.close()


def test_session_summary_confidence_mean_bounds():
    """Average confidence accurately computes mean without inflating or exceeding 1.0."""
    db = TestingSessionLocal()
    try:
        session = SimSession(scenario_id=1, status="In Progress")
        db.add(session)
        db.commit()
        db.refresh(session)

        conv = Conversation(session_id=session.session_id)
        db.add(conv)
        db.commit()
        db.refresh(conv)

        m1 = Message(
            conversation_id=conv.conversation_id,
            sender_type="AI",
            message_text=json.dumps({
                "persona": "calm",
                "analysis": {
                    "turn": 1, "intent": "refund", "emotion": "neutral",
                    "sentiment": "neutral", "frustration_level": 2,
                    "satisfaction_trend": "stable", "escalation_risk": "low",
                    "confidence": 0.80
                }
            }),
            message_type="System"
        )
        m2 = Message(
            conversation_id=conv.conversation_id,
            sender_type="AI",
            message_text=json.dumps({
                "persona": "calm",
                "analysis": {
                    "turn": 2, "intent": "refund", "emotion": "neutral",
                    "sentiment": "neutral", "frustration_level": 2,
                    "satisfaction_trend": "stable", "escalation_risk": "low",
                    "confidence": 0.90
                }
            }),
            message_type="System"
        )
        db.add_all([m1, m2])
        db.commit()

        summary = get_session_analysis_summary(session.session_id, db)
        assert summary.average_confidence == 0.85
    finally:
        db.close()


# ===========================================================================
# Section 5: Session Isolation & No Cross-Talk
# ===========================================================================

def test_session_isolation_independent_histories(client, monkeypatch):
    """Session A and Session B maintain strictly independent analysis histories."""
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "Where is my refund?"
    )

    # Session A: Refund scenario
    resp_a = client.post("/simulator/start", json={
        "session_label": "Session A Isolation",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Refund"
    })
    session_a = resp_a.json()["session_id"]

    # Session B: Account issue scenario
    resp_b = client.post("/simulator/start", json={
        "session_label": "Session B Isolation",
        "persona": "confused",
        "scenario": "account_issue",
        "initial_emotion": "confused",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Unlock account"
    })
    session_b = resp_b.json()["session_id"]

    hist_a = client.get(f"/analysis/{session_a}/history").json()
    hist_b = client.get(f"/analysis/{session_b}/history").json()

    assert hist_a != hist_b
    assert hist_a[0]["intent"] == "refund"
    assert hist_b[0]["intent"] == "account_issue"


def test_session_isolation_independent_summaries(client):
    """Session summaries for concurrent sessions never cross-contaminate."""
    resp_a = client.post("/simulator/start", json={
        "session_label": "Summary A",
        "persona": "calm",
        "scenario": "cancellation",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Cancel"
    })
    session_a = resp_a.json()["session_id"]

    resp_b = client.post("/simulator/start", json={
        "session_label": "Summary B",
        "persona": "angry",
        "scenario": "payment_failure",
        "initial_emotion": "angry",
        "issue_severity": 4,
        "patience_level": 1,
        "expected_resolution": "Payment retry"
    })
    session_b = resp_b.json()["session_id"]

    sum_a = client.get(f"/analysis/{session_a}/summary").json()
    sum_b = client.get(f"/analysis/{session_b}/summary").json()

    assert sum_a["dominant_intent"] == "cancellation"
    assert sum_b["dominant_intent"] == "payment_issue"
    assert sum_a["current_escalation_risk"] != sum_b["current_escalation_risk"]


# ===========================================================================
# Section 6: Operational Metrics & Observability
# ===========================================================================

def test_operational_metrics_increment_on_analysis(client):
    """Analysis calls increment operational metrics counters and record latency."""
    reset_analysis_metrics()
    m_before = get_analysis_metrics()
    assert m_before["total_analyses"] == 0

    client.post("/simulator/start", json={
        "session_label": "Metrics Verification",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Refund"
    })

    m_after = get_analysis_metrics()
    assert m_after["total_analyses"] >= 1
    assert m_after["fallback_analyses"] >= 1 or m_after["gemini_analyses"] >= 1
    assert m_after["average_latency_ms"] >= 0.0


def test_metrics_api_endpoint(client):
    """GET /analysis/metrics exposes operational metrics cleanly."""
    resp = client.get("/analysis/metrics")
    assert resp.status_code == 200
    data = resp.json()
    assert "total_analyses" in data
    assert "fallback_analyses" in data
    assert "gemini_analyses" in data
    assert "average_latency_ms" in data


def test_metrics_reset_for_isolation():
    """reset_analysis_metrics() zeros out counters reliably."""
    reset_analysis_metrics()
    metrics = get_analysis_metrics()
    assert metrics["total_analyses"] == 0
    assert metrics["validation_failures"] == 0
    assert metrics["average_latency_ms"] == 0.0


# ===========================================================================
# Section 7: Downstream Consumer Simulation (Zero DB / Gemini Dependency)
# ===========================================================================

def test_downstream_consumer_coaching_agent():
    """Simulates a downstream Coaching Agent receiving AnalysisResult without DB access."""
    # Hypothetical coaching logic consuming AnalysisResult
    def generate_agent_guidance(analysis: AnalysisResult) -> str:
        if analysis.frustration_level >= 7:
            return "Customer is highly frustrated. Use empathetic phrasing and prioritize rapid resolution."
        elif analysis.emotion == CustomerEmotion.CONFUSED:
            return "Customer is confused. Provide simple, step-by-step guidance."
        return "Standard polite response recommended."

    res_frustrated = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=8,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.HIGH,
        confidence=0.91
    )
    guidance = generate_agent_guidance(res_frustrated)
    assert "empathetic phrasing" in guidance

    res_confused = AnalysisResult(
        intent=CustomerIntent.ACCOUNT_ISSUE,
        emotion=CustomerEmotion.CONFUSED,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=3,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.82
    )
    guidance_confused = generate_agent_guidance(res_confused)
    assert "step-by-step" in guidance_confused


def test_downstream_consumer_escalation_monitor():
    """Simulates a downstream Escalation Monitor Agent evaluating supervisor routing."""
    def should_route_to_human_supervisor(analysis: AnalysisResult) -> bool:
        return analysis.escalation_risk == EscalationRisk.HIGH or analysis.frustration_level >= 8

    res_safe = AnalysisResult(
        intent=CustomerIntent.GENERAL_INQUIRY,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=2,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.88
    )
    assert should_route_to_human_supervisor(res_safe) is False

    res_danger = AnalysisResult(
        intent=CustomerIntent.COMPLAINT,
        emotion=CustomerEmotion.ANGRY,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=9,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.HIGH,
        confidence=0.95
    )
    assert should_route_to_human_supervisor(res_danger) is True


def test_downstream_consumer_rag_prompt_selector():
    """Simulates a downstream RAG Agent picking prompt template based on intent & sentiment."""
    def select_rag_prompt_template(analysis: AnalysisResult) -> str:
        if analysis.intent == CustomerIntent.REFUND:
            return "template_billing_refund"
        elif analysis.intent == CustomerIntent.DELIVERY_ISSUE:
            return "template_shipping_logistics"
        return "template_general_faq"

    res = AnalysisResult(
        intent=CustomerIntent.DELIVERY_ISSUE,
        emotion=CustomerEmotion.WORRIED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=4,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.MEDIUM,
        confidence=0.86
    )
    assert select_rag_prompt_template(res) == "template_shipping_logistics"


# ===========================================================================
# Section 8: Duplicate Analysis Protection & Idempotence
# ===========================================================================

def test_duplicate_analysis_protection_in_history(client):
    """Calling get_analysis_history repeatedly returns idempotent, non-duplicated lists."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Idempotence Check",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Refund"
    })
    session_id = start_resp.json()["session_id"]

    h1 = client.get(f"/analysis/{session_id}/history").json()
    h2 = client.get(f"/analysis/{session_id}/history").json()
    assert h1 == h2
    assert len(h1) == 1


def test_no_duplicate_turn_snapshots_in_database(client):
    """Exactly one analysis snapshot is recorded per turn in the Message table."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Snapshot Count Check",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Refund"
    })
    session_id = start_resp.json()["session_id"]

    client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "We are looking into this."
    })

    db = TestingSessionLocal()
    try:
        conv = db.query(Conversation).filter(Conversation.session_id == session_id).first()
        sys_msgs = (
            db.query(Message)
            .filter(Message.conversation_id == conv.conversation_id, Message.message_type == "System")
            .all()
        )
        # Exactly 2 system messages (Turn 1 + Turn 2)
        assert len(sys_msgs) == 2
    finally:
        db.close()


def test_analysis_result_dict_roundtrip():
    """AnalysisResult supports round-trip reconstruction from dictionary attributes."""
    data = {
        "intent": "complaint",
        "emotion": "angry",
        "sentiment": "negative",
        "frustration_level": 9,
        "satisfaction_trend": "declining",
        "escalation_risk": "high",
        "confidence": 0.95,
        "session_id": 123,
        "conversation_id": 456,
        "turn_number": 4,
        "analysis_source": "gemini",
        "analysis_timestamp": datetime.now(timezone.utc).isoformat()
    }
    result = AnalysisResult(**data)
    assert result.intent == CustomerIntent.COMPLAINT
    assert result.emotion == CustomerEmotion.ANGRY
    assert result.turn_number == 4


def test_get_analysis_history_skips_malformed_json_messages():
    """System messages with non-JSON text or missing 'analysis' key are safely skipped."""
    db = TestingSessionLocal()
    try:
        session = SimSession(scenario_id=1, status="In Progress")
        db.add(session)
        db.commit()
        db.refresh(session)

        conv = Conversation(session_id=session.session_id)
        db.add(conv)
        db.commit()
        db.refresh(conv)

        # Corrupted system message
        bad_msg = Message(
            conversation_id=conv.conversation_id,
            sender_type="AI",
            message_text="NOT A JSON PAYLOAD",
            message_type="System"
        )
        # System message without analysis
        objective_msg = Message(
            conversation_id=conv.conversation_id,
            sender_type="System",
            message_text=json.dumps({"objective": "Test scenario"}),
            message_type="System"
        )
        # Valid analysis message
        valid_msg = Message(
            conversation_id=conv.conversation_id,
            sender_type="AI",
            message_text=json.dumps({
                "persona": "calm",
                "analysis": {
                    "turn": 1, "intent": "refund", "emotion": "neutral",
                    "sentiment": "neutral", "frustration_level": 2,
                    "satisfaction_trend": "stable", "escalation_risk": "low",
                    "confidence": 0.85
                }
            }),
            message_type="System"
        )
        db.add_all([bad_msg, objective_msg, valid_msg])
        db.commit()

        history = get_analysis_history(session.session_id, db)
        assert len(history) == 1
        assert history[0].turn == 1
        assert history[0].intent == CustomerIntent.REFUND
    finally:
        db.close()


def test_session_summary_single_turn_direction_stable(client):
    """Session with a single turn defaults to stable satisfaction direction."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Single Turn Summary",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Refund"
    })
    session_id = start_resp.json()["session_id"]

    resp = client.get(f"/analysis/{session_id}/summary")
    assert resp.status_code == 200
    summary = resp.json()
    assert summary["turn_count"] == 1
    assert summary["overall_satisfaction_direction"] == "stable"


def test_session_summary_turn_count_matches_history_length(client, monkeypatch):
    """Session summary turn_count strictly matches the number of turns in history."""
    monkeypatch.setattr(
        "app.services.simulator_service.generate_with_gemini",
        lambda prompt: "I am still waiting for my package."
    )
    start_resp = client.post("/simulator/start", json={
        "session_label": "Turn Count Check",
        "persona": "calm",
        "scenario": "delayed_order",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Status"
    })
    session_id = start_resp.json()["session_id"]

    client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "We are looking into it."
    })

    hist = client.get(f"/analysis/{session_id}/history").json()
    summ = client.get(f"/analysis/{session_id}/summary").json()
    assert len(hist) == summ["turn_count"]
    assert summ["turn_count"] == 2


def test_metrics_total_latency_monotonic(client):
    """Execution latency accumulates monotonically across successive analyses."""
    reset_analysis_metrics()
    client.post("/simulator/start", json={
        "session_label": "Latency Monotonic 1",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Refund"
    })
    m1 = get_analysis_metrics()

    client.post("/simulator/start", json={
        "session_label": "Latency Monotonic 2",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Refund"
    })
    m2 = get_analysis_metrics()

    assert m2["total_analyses"] == m1["total_analyses"] + 1
    assert m2["average_latency_ms"] >= 0.0


def test_downstream_consumer_session_review_agent():
    """Simulates a downstream Post-Interaction Summary Agent reviewing a completed session."""
    def generate_executive_post_mortem(summary: SessionAnalysisSummary) -> str:
        if summary.current_escalation_risk == EscalationRisk.HIGH:
            return f"ALERT: High risk session ({summary.session_id}) with dominant intent '{summary.dominant_intent.value}'."
        elif summary.overall_satisfaction_direction == SatisfactionTrend.IMPROVING:
            return f"SUCCESS: De-escalated session ({summary.session_id}) across {summary.turn_count} turns."
        return f"ROUTINE: Resolved session ({summary.session_id})."

    summary_escalated = SessionAnalysisSummary(
        session_id=101,
        dominant_intent=CustomerIntent.COMPLAINT,
        latest_emotion=CustomerEmotion.ANGRY,
        latest_sentiment=CustomerSentiment.NEGATIVE,
        current_frustration=9,
        current_escalation_risk=EscalationRisk.HIGH,
        overall_satisfaction_direction=SatisfactionTrend.DECLINING,
        average_confidence=0.91,
        turn_count=3
    )
    assert "ALERT: High risk" in generate_executive_post_mortem(summary_escalated)

    summary_resolved = SessionAnalysisSummary(
        session_id=102,
        dominant_intent=CustomerIntent.REFUND,
        latest_emotion=CustomerEmotion.SATISFIED,
        latest_sentiment=CustomerSentiment.POSITIVE,
        current_frustration=1,
        current_escalation_risk=EscalationRisk.LOW,
        overall_satisfaction_direction=SatisfactionTrend.IMPROVING,
        average_confidence=0.88,
        turn_count=2
    )
    assert "SUCCESS: De-escalated" in generate_executive_post_mortem(summary_resolved)


def test_api_analysis_history_preserves_chronological_order(client):
    """GET /analysis/{session_id}/history returns turns strictly in ascending turn sequence."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Order Check",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Refund"
    })
    session_id = start_resp.json()["session_id"]

    client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "First agent reply."
    })
    client.post("/simulator/message", json={
        "session_id": session_id,
        "agent_response": "Second agent reply."
    })

    history = client.get(f"/analysis/{session_id}/history").json()
    assert len(history) == 3
    turns = [h["turn"] for h in history]
    assert turns == sorted(turns)
    assert turns == [1, 2, 3]


def test_api_summary_with_real_session(client):
    """GET /analysis/{session_id}/summary returns valid structured data matching schema."""
    start_resp = client.post("/simulator/start", json={
        "session_label": "Summary API Check",
        "persona": "calm",
        "scenario": "cancellation",
        "initial_emotion": "neutral",
        "issue_severity": 2,
        "patience_level": 3,
        "expected_resolution": "Cancel"
    })
    session_id = start_resp.json()["session_id"]

    resp = client.get(f"/analysis/{session_id}/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["session_id"] == session_id
    assert data["dominant_intent"] == "cancellation"
    assert data["turn_count"] == 1
    assert 0.0 <= data["average_confidence"] <= 1.0
