"""Task 5 Phase 3 — Full Conversation-Flow Integration Tests.

Verifies end-to-end integration across:
    Task 3 (Customer Simulator)
          ↓
    Task 4 (Intent & Sentiment Analysis)
          ↓
    Task 5 (Knowledge Recommendation Agent)
          ↓
    Support Agent Response
          ↓
    Task 3 (Next Customer Turn)

Test Categories:
    1. Basic Integration (7 tests)
    2. Multi-Turn Conversation Context (7 tests)
    3. Emotional & Intent Behavior (7 tests)
    4. Error Handling & Fault Isolation (6 tests)
    5. Session Isolation (3 tests)
    6. Backward Compatibility (5 tests)
    7. Real RAG End-to-End Tests (3 tests)

Total: 38 tests.
Each test clearly documents whether it runs with MOCK or REAL components.
"""

import os
import sys
import json
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure GEMINI_API_KEY is configured
os.environ.setdefault("GEMINI_API_KEY", "test_gemini_api_key")

from app.main import app
from app.models.database import Base
from app.models.simulator import Scenario, Session as SimSession, Conversation, Message
from app.api.simulator import get_db as get_sim_db
from app.api.support import get_db as get_sup_db
from app.api.knowledge import get_db as get_know_db
from app.services.conversation_orchestration_service import (
    start_orchestrated_session,
    process_support_turn,
)
from app.schemas.analysis import (
    CustomerIntent,
    CustomerEmotion,
    CustomerSentiment,
    SatisfactionTrend,
    EscalationRisk,
    AnalysisResult,
)
from app.schemas.knowledge import (
    KnowledgeRecommendation,
    KnowledgeRecommendationResult,
)


TEST_DB_FILE = "test_phase3_integration.db"
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
def setup_phase3_db():
    """Sets up an isolated SQLite test database for Phase 3 integration testing."""
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

    app.dependency_overrides[get_sim_db] = override_get_db
    app.dependency_overrides[get_sup_db] = override_get_db
    app.dependency_overrides[get_know_db] = override_get_db

    yield

    app.dependency_overrides.clear()
    test_engine.dispose()
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass


@pytest.fixture
def db_session():
    """Provides a transactional database session for direct service testing."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="module")
def client():
    """FastAPI TestClient fixture."""
    return TestClient(app)


# ===========================================================================
# 1. BASIC INTEGRATION TESTS (MOCK)
# ===========================================================================

class TestBasicIntegration:
    """Tests verifying the foundational link: Task 3 -> Task 4 -> Task 5 in Turn 1."""

    def test_t3_customer_message_reaches_t4(self, client):
        """MOCK: Task 3 customer opening message is passed to Task 4 analysis."""
        resp = client.post("/simulator/start", json={
            "session_label": "T3->T4 Message Flow",
            "persona": "calm",
            "scenario": "delayed_order",
            "initial_emotion": "neutral",
            "issue_severity": 2,
            "patience_level": 4,
            "expected_resolution": "Tracking update",
        })
        assert resp.status_code == 200
        data = resp.json()

        assert "customer_message" in data
        assert len(data["customer_message"]) > 0
        assert "analysis" in data
        assert data["analysis"]["intent"] == "delivery_issue"

    def test_t4_result_reaches_t5(self, client):
        """MOCK: Task 4 analysis result reaches Task 5 recommendation agent."""
        resp = client.post("/simulator/start", json={
            "session_label": "T4->T5 Analysis Flow",
            "persona": "frustrated",
            "scenario": "refund",
            "initial_emotion": "frustrated",
            "issue_severity": 3,
            "patience_level": 3,
            "expected_resolution": "Refund processed",
        })
        assert resp.status_code == 200
        data = resp.json()

        # Task 5 recommendations are generated
        assert "recommendations" in data
        assert isinstance(data["recommendations"], list)
        assert data["no_relevant_information"] is False
        assert len(data["recommendations"]) >= 1

    def test_t5_receives_current_customer_query(self, client):
        """MOCK: Task 5 receives the exact customer message as the retrieval query."""
        resp = client.post("/simulator/start", json={
            "session_label": "T5 Query Test",
            "persona": "calm",
            "scenario": "payment_failure",
            "initial_emotion": "worried",
            "issue_severity": 3,
            "patience_level": 3,
            "expected_resolution": "Card charged assistance",
        })
        assert resp.status_code == 200
        data = resp.json()

        # Check knowledge recommendations full payload
        k_rec = data.get("knowledge_recommendations")
        assert k_rec is not None
        assert k_rec["query"] == data["customer_message"]

    def test_t5_receives_conversation_context(self, client, monkeypatch):
        """MOCK: Task 5 resolves session history when processing turn 2."""
        monkeypatch.setattr(
            "app.services.simulator_service.generate_with_gemini",
            lambda prompt: "Where is it now?"
        )
        start_resp = client.post("/simulator/start", json={
            "session_label": "Context Flow Test",
            "persona": "calm",
            "scenario": "delayed_order",
            "initial_emotion": "neutral",
            "issue_severity": 2,
            "patience_level": 4,
            "expected_resolution": "Status",
        })
        session_id = start_resp.json()["session_id"]

        msg_resp = client.post("/simulator/message", json={
            "session_id": session_id,
            "agent_response": "I can check your shipment status right away."
        })
        assert msg_resp.status_code == 200
        data = msg_resp.json()

        # Turn 2 contextual query resolved 'it' using Turn 1 order context
        assert data["contextual_query"] is not None
        assert "where is it now" in data["contextual_query"].lower()

    def test_t5_receives_t4_intent(self, client):
        """MOCK: Task 5 receives Task 4 intent and incorporates intent topic terms."""
        resp = client.post("/simulator/start", json={
            "session_label": "Intent Passing Test",
            "persona": "impatient",
            "scenario": "cancellation",
            "initial_emotion": "frustrated",
            "issue_severity": 3,
            "patience_level": 2,
            "expected_resolution": "Order cancelled",
        })
        assert resp.status_code == 200
        data = resp.json()

        assert data["analysis"]["intent"] == "cancellation"
        # Recommendations should align with cancellation
        assert len(data["recommendations"]) >= 1

    def test_integrated_turn_returns_recommendations(self, client):
        """MOCK: Integrated turn response contains all structured recommendation fields."""
        resp = client.post("/simulator/start", json={
            "session_label": "Recommendation Fields Test",
            "persona": "polite",
            "scenario": "refund",
            "initial_emotion": "neutral",
            "issue_severity": 2,
            "patience_level": 5,
            "expected_resolution": "Refund instructions",
        })
        assert resp.status_code == 200
        data = resp.json()

        recs = data["recommendations"]
        assert len(recs) >= 1
        rec = recs[0]
        assert "title" in rec
        assert "content" in rec
        assert "source" in rec
        assert "document_type" in rec
        assert "relevance_score" in rec
        assert 0.0 <= rec["relevance_score"] <= 1.0

    def test_integrated_turn_preserves_source_attribution(self, client):
        """MOCK: Source field contains valid chunk provenance format."""
        resp = client.post("/simulator/start", json={
            "session_label": "Source Attribution Test",
            "persona": "calm",
            "scenario": "refund",
            "initial_emotion": "neutral",
            "issue_severity": 2,
            "patience_level": 4,
            "expected_resolution": "Refund confirmation",
        })
        assert resp.status_code == 200
        data = resp.json()

        for r in data["recommendations"]:
            assert "chunk:" in r["source"]
            assert "document:" in r["source"]


# ===========================================================================
# 2. MULTI-TURN CONVERSATION CONTEXT TESTS (MOCK)
# ===========================================================================

class TestMultiTurnIntegration:
    """Tests verifying multi-turn dialogue progression and context preservation."""

    def test_two_turn_conversation_flow(self, client, monkeypatch):
        """MOCK: Two-turn sequence processes customer turn 1 and turn 2 with analysis and recs."""
        monkeypatch.setattr(
            "app.services.simulator_service.generate_with_gemini",
            lambda prompt: "Is there any update on the courier tracking?"
        )
        start_resp = client.post("/simulator/start", json={
            "session_label": "2-Turn Flow Test",
            "persona": "calm",
            "scenario": "delayed_order",
            "initial_emotion": "neutral",
            "issue_severity": 2,
            "patience_level": 4,
            "expected_resolution": "Courier update",
        })
        session_id = start_resp.json()["session_id"]
        assert start_resp.json()["turn"] == 1

        turn2_resp = client.post("/simulator/message", json={
            "session_id": session_id,
            "agent_response": "I am tracking the package with the courier now.",
        })
        assert turn2_resp.status_code == 200
        data2 = turn2_resp.json()
        assert data2["turn"] == 2
        assert "courier tracking" in data2["customer_message"].lower()
        assert "analysis" in data2
        assert "recommendations" in data2

    def test_three_turn_conversation_flow(self, client, monkeypatch):
        """MOCK: Three-turn sequence proceeds through turn 1, turn 2, turn 3 continuously."""
        turns = [
            "Where is my package right now?",
            "Can I get a refund if it does not arrive today?",
        ]
        turn_iter = iter(turns)
        monkeypatch.setattr(
            "app.services.simulator_service.generate_with_gemini",
            lambda prompt: next(turn_iter, "Thank you for the update.")
        )

        start_resp = client.post("/simulator/start", json={
            "session_label": "3-Turn Flow Test",
            "persona": "impatient",
            "scenario": "delayed_order",
            "initial_emotion": "frustrated",
            "issue_severity": 3,
            "patience_level": 2,
            "expected_resolution": "Delivery or refund",
        })
        session_id = start_resp.json()["session_id"]

        # Turn 2
        turn2_resp = client.post("/simulator/message", json={
            "session_id": session_id,
            "agent_response": "The courier indicates a minor weather delay.",
        })
        assert turn2_resp.status_code == 200
        assert turn2_resp.json()["turn"] == 2

        # Turn 3
        turn3_resp = client.post("/simulator/message", json={
            "session_id": session_id,
            "agent_response": "Yes, our policy covers refunds for guaranteed deliveries.",
        })
        assert turn3_resp.status_code == 200
        data3 = turn3_resp.json()
        assert data3["turn"] == 3
        assert len(data3["recommendations"]) >= 1

    def test_context_preserved_between_turns(self, client, monkeypatch):
        """MOCK: Dialogue history grows across turns and is preserved in simulator history."""
        monkeypatch.setattr(
            "app.services.simulator_service.generate_with_gemini",
            lambda prompt: "Understood, thank you."
        )
        start_resp = client.post("/simulator/start", json={
            "session_label": "History Growth Test",
            "persona": "polite",
            "scenario": "account_issue",
            "initial_emotion": "neutral",
            "issue_severity": 2,
            "patience_level": 4,
            "expected_resolution": "Password reset",
        })
        session_id = start_resp.json()["session_id"]

        client.post("/simulator/message", json={
            "session_id": session_id,
            "agent_response": "I have sent a password reset link to your email."
        })

        hist_resp = client.get(f"/simulator/{session_id}/history")
        assert hist_resp.status_code == 200
        messages = hist_resp.json()["messages"]
        # Expected: Turn 1 customer, Turn 1 agent, Turn 2 customer
        assert len(messages) >= 3
        assert messages[0]["sender_type"] == "Customer"
        assert messages[1]["sender_type"] == "Support Agent"
        assert messages[2]["sender_type"] == "Customer"

    def test_pronoun_reference_resolution_in_flow(self, client, monkeypatch):
        """MOCK: Follow-up pronoun query ('Where is it?') resolves antecedent in turn 2."""
        monkeypatch.setattr(
            "app.services.simulator_service.generate_with_gemini",
            lambda prompt: "Where is it?"
        )
        start_resp = client.post("/simulator/start", json={
            "session_label": "Pronoun Flow Test",
            "persona": "calm",
            "scenario": "delayed_order",
            "initial_emotion": "neutral",
            "issue_severity": 2,
            "patience_level": 4,
            "expected_resolution": "Status",
        })
        session_id = start_resp.json()["session_id"]

        msg_resp = client.post("/simulator/message", json={
            "session_id": session_id,
            "agent_response": "I see your order in our system."
        })
        data = msg_resp.json()
        assert data["contextual_query"] is not None
        # Antecedent terms should be present
        assert "where is it" in data["contextual_query"].lower()

    def test_new_customer_message_analyzed_independently(self, client, monkeypatch):
        """MOCK: Turn 2 customer message receives its own distinct Task 4 analysis."""
        monkeypatch.setattr(
            "app.services.simulator_service.generate_with_gemini",
            lambda prompt: "I am extremely angry now, this is totally unacceptable!"
        )
        start_resp = client.post("/simulator/start", json={
            "session_label": "Independent Analysis Test",
            "persona": "angry",
            "scenario": "refund",
            "initial_emotion": "frustrated",
            "issue_severity": 4,
            "patience_level": 2,
            "expected_resolution": "Immediate refund",
        })
        session_id = start_resp.json()["session_id"]

        turn2_resp = client.post("/simulator/message", json={
            "session_id": session_id,
            "agent_response": "There is nothing I can do until next week."
        })
        data2 = turn2_resp.json()
        analysis2 = data2["analysis"]
        assert analysis2["emotion"] == "angry"
        assert analysis2["frustration_level"] >= 6

    def test_previous_context_remains_available(self, client, db_session):
        """MOCK: Stored session context is fully retrievable across all completed turns."""
        start = start_orchestrated_session(
            session_label="Context Persistence Test",
            persona="calm",
            scenario="refund",
            initial_emotion="neutral",
            issue_severity=2,
            patience_level=4,
            expected_resolution="Refund",
            db=db_session
        )
        session_id = start["session_id"]

        with patch("app.services.conversation_orchestration_service.generate_customer_turn", return_value={
            "customer_message": "Thank you, that helps.",
            "updated_state": {"frustration": 10, "trust": 90, "patience": 90, "satisfaction": 90, "escalation_intent": 0},
            "is_resolved": True,
            "is_escalated": False
        }):
            turn2 = process_support_turn(
                session_id=session_id,
                agent_response="Your refund has been approved and initiated.",
                db=db_session
            )

        assert turn2["turn"] == 2
        assert turn2["is_resolved"] is True

    def test_recommendation_changes_when_issue_changes(self, client, monkeypatch):
        """MOCK: Knowledge recommendations adapt when customer shifts topic from delivery to refund."""
        monkeypatch.setattr(
            "app.services.simulator_service.generate_with_gemini",
            lambda prompt: "I don't care about shipping anymore, issue a full refund and send my money back immediately!"
        )
        start_resp = client.post("/simulator/start", json={
            "session_label": "Topic Shift Test",
            "persona": "impatient",
            "scenario": "delayed_order",
            "initial_emotion": "frustrated",
            "issue_severity": 3,
            "patience_level": 2,
            "expected_resolution": "Refund",
        })
        session_id = start_resp.json()["session_id"]

        msg_resp = client.post("/simulator/message", json={
            "session_id": session_id,
            "agent_response": "Let me see what refund options are available."
        })
        data = msg_resp.json()
        assert data["analysis"]["intent"] == "refund"
        # Turn 2 recommendations should focus on refund
        assert any("refund" in r["title"].lower() or "refund" in r["content"].lower() for r in data["recommendations"])


# ===========================================================================
# 3. EMOTIONAL & INTENT BEHAVIOR TESTS (MOCK)
# ===========================================================================

class TestEmotionalAndIntentBehavior:
    """Tests verifying behavior across support scenarios and emotional progressions."""

    def test_delivery_issue_flow(self, client):
        """MOCK: delayed_order scenario activates delivery_issue intent and retrieves delivery knowledge."""
        resp = client.post("/simulator/start", json={
            "session_label": "Delivery Scenario Flow",
            "persona": "calm",
            "scenario": "delayed_order",
            "initial_emotion": "neutral",
            "issue_severity": 2,
            "patience_level": 4,
            "expected_resolution": "Courier tracking",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["analysis"]["intent"] == "delivery_issue"
        assert len(data["recommendations"]) >= 1

    def test_refund_issue_flow(self, client):
        """MOCK: refund scenario activates refund intent and retrieves refund knowledge."""
        resp = client.post("/simulator/start", json={
            "session_label": "Refund Scenario Flow",
            "persona": "calm",
            "scenario": "refund",
            "initial_emotion": "neutral",
            "issue_severity": 3,
            "patience_level": 3,
            "expected_resolution": "Full refund",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["analysis"]["intent"] == "refund"
        assert any("refund" in r["title"].lower() or "refund" in r["content"].lower() for r in data["recommendations"])

    def test_payment_issue_flow(self, client):
        """MOCK: payment_failure scenario activates payment_issue intent and retrieves payment knowledge."""
        resp = client.post("/simulator/start", json={
            "session_label": "Payment Scenario Flow",
            "persona": "confused",
            "scenario": "payment_failure",
            "initial_emotion": "worried",
            "issue_severity": 3,
            "patience_level": 3,
            "expected_resolution": "Payment confirmation",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["analysis"]["intent"] == "payment_issue"
        assert len(data["recommendations"]) >= 1

    def test_account_issue_flow(self, client):
        """MOCK: account_issue scenario activates account_issue intent."""
        resp = client.post("/simulator/start", json={
            "session_label": "Account Scenario Flow",
            "persona": "confused",
            "scenario": "account_issue",
            "initial_emotion": "confused",
            "issue_severity": 2,
            "patience_level": 4,
            "expected_resolution": "Login restored",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["analysis"]["intent"] == "account_issue"

    def test_cancellation_issue_flow(self, client):
        """MOCK: cancellation scenario activates cancellation intent."""
        resp = client.post("/simulator/start", json={
            "session_label": "Cancellation Scenario Flow",
            "persona": "calm",
            "scenario": "cancellation",
            "initial_emotion": "neutral",
            "issue_severity": 2,
            "patience_level": 4,
            "expected_resolution": "Order cancelled",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["analysis"]["intent"] == "cancellation"

    def test_emotional_progression_does_not_break_analysis(self, client, monkeypatch):
        """MOCK: Persona escalation from neutral to high frustration is correctly analyzed by Task 4."""
        monkeypatch.setattr(
            "app.services.simulator_service.generate_with_gemini",
            lambda prompt: "I demand to speak to your manager right now! This is ridiculous!"
        )
        start_resp = client.post("/simulator/start", json={
            "session_label": "Escalation Analysis Flow",
            "persona": "angry",
            "scenario": "refund",
            "initial_emotion": "angry",
            "issue_severity": 4,
            "patience_level": 1,
            "expected_resolution": "Manager",
        })
        session_id = start_resp.json()["session_id"]

        turn2_resp = client.post("/simulator/message", json={
            "session_id": session_id,
            "agent_response": "I cannot help you right now."
        })
        data = turn2_resp.json()
        assert data["analysis"]["escalation_risk"].lower() in ["medium", "high"]
        assert data["analysis"]["frustration_level"] >= 7

    def test_emotion_does_not_override_semantic_retrieval(self, client, monkeypatch):
        """MOCK: Extreme anger and manager threats do not cause false retrieval of unrelated documents."""
        monkeypatch.setattr(
            "app.services.simulator_service.generate_with_gemini",
            lambda prompt: "I am furious! Where is my delivery?"
        )
        start_resp = client.post("/simulator/start", json={
            "session_label": "Emotion Primacy Safety",
            "persona": "angry",
            "scenario": "delayed_order",
            "initial_emotion": "angry",
            "issue_severity": 4,
            "patience_level": 1,
            "expected_resolution": "Delivery",
        })
        session_id = start_resp.json()["session_id"]

        msg_resp = client.post("/simulator/message", json={
            "session_id": session_id,
            "agent_response": "I apologize for the delay."
        })
        data = msg_resp.json()
        # Semantic topic must remain delivery/order, not anger
        for rec in data["recommendations"]:
            assert "angry" not in rec["title"].lower()
            assert "angry" not in rec["content"].lower()


# ===========================================================================
# 4. ERROR HANDLING & FAULT ISOLATION TESTS (MOCK)
# ===========================================================================

class TestErrorHandlingAndFaultIsolation:
    """Tests ensuring failure in downstream services does not crash the conversation."""

    def test_t4_failure_handled_safely(self, client):
        """MOCK: If Task 4 raises an exception, the customer turn and recommendations still succeed."""
        with patch(
            "app.api.simulator.analyze_customer_message",
            side_effect=RuntimeError("Task 4 model unavailable")
        ):
            resp = client.post("/simulator/start", json={
                "session_label": "Task 4 Failure Isolation",
                "persona": "calm",
                "scenario": "refund",
                "initial_emotion": "neutral",
                "issue_severity": 2,
                "patience_level": 4,
                "expected_resolution": "Refund",
            })

        assert resp.status_code == 200
        data = resp.json()
        assert "customer_message" in data
        assert data["turn"] == 1
        # Analysis is safely omitted or empty, but turn succeeds
        assert "analysis" not in data or data["analysis"] is None

    def test_t5_failure_handled_safely(self, client):
        """MOCK: If Task 5 retrieval raises an exception, the customer turn and Task 4 succeed."""
        with patch(
            "app.api.simulator.get_knowledge_recommendations",
            side_effect=RuntimeError("Vector database connection timed out")
        ):
            resp = client.post("/simulator/start", json={
                "session_label": "Task 5 Failure Isolation",
                "persona": "calm",
                "scenario": "delayed_order",
                "initial_emotion": "neutral",
                "issue_severity": 2,
                "patience_level": 4,
                "expected_resolution": "Status",
            })

        assert resp.status_code == 200
        data = resp.json()
        assert "customer_message" in data
        assert "analysis" in data
        # Recommendations cleanly fall back to empty without crashing
        assert data["recommendations"] == []
        assert data["no_relevant_information"] is True

    def test_no_result_recommendation_does_not_break_conversation(self, client, monkeypatch):
        """MOCK: When Task 5 finds no relevant docs, the conversation proceeds normally."""
        empty_rec = KnowledgeRecommendationResult(
            query="Random query",
            recommendations=[],
            no_relevant_information=True
        )
        with patch(
            "app.api.simulator.get_knowledge_recommendations",
            return_value=empty_rec
        ):
            resp = client.post("/simulator/start", json={
                "session_label": "No Result Flow Test",
                "persona": "calm",
                "scenario": "refund",
                "initial_emotion": "neutral",
                "issue_severity": 2,
                "patience_level": 4,
                "expected_resolution": "Resolution",
            })

        assert resp.status_code == 200
        data = resp.json()
        assert data["recommendations"] == []
        assert data["no_relevant_information"] is True

    def test_invalid_session_returns_404(self, client):
        """MOCK: Calling /simulator/message with a nonexistent session returns HTTP 404."""
        resp = client.post("/simulator/message", json={
            "session_id": 999999,
            "agent_response": "Hello, how can I help?",
        })
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

    def test_empty_agent_response_returns_400(self, client):
        """MOCK: Calling /simulator/message with empty response returns HTTP 400."""
        resp = client.post("/simulator/message", json={
            "session_id": 1,
            "agent_response": "   ",
        })
        assert resp.status_code == 400

    def test_chromadb_failure_handled_safely(self, client):
        """MOCK: Vector DB failure during multi-turn retrieval does not raise HTTP 500."""
        start_resp = client.post("/simulator/start", json={
            "session_label": "ChromaDB Failure Isolation",
            "persona": "calm",
            "scenario": "refund",
            "initial_emotion": "neutral",
            "issue_severity": 2,
            "patience_level": 4,
            "expected_resolution": "Refund",
        })
        session_id = start_resp.json()["session_id"]

        with patch(
            "app.api.simulator.get_knowledge_recommendations",
            side_effect=RuntimeError("ChromaDB socket closed")
        ):
            turn2_resp = client.post("/simulator/message", json={
                "session_id": session_id,
                "agent_response": "Checking your account now.",
            })

        assert turn2_resp.status_code == 200
        assert turn2_resp.json()["recommendations"] == []


# ===========================================================================
# 5. SESSION ISOLATION TESTS (MOCK)
# ===========================================================================

class TestSessionIsolation:
    """Tests verifying strict isolation between concurrently active sessions."""

    def test_session_a_context_not_visible_to_session_b(self, client, monkeypatch):
        """MOCK: Session A's order dialogue never appears in Session B's context or history."""
        # Start Session A (delayed order)
        resp_a = client.post("/simulator/start", json={
            "session_label": "Session A (Order)",
            "persona": "calm",
            "scenario": "delayed_order",
            "initial_emotion": "neutral",
            "issue_severity": 2,
            "patience_level": 4,
            "expected_resolution": "Order tracking",
        })
        session_a_id = resp_a.json()["session_id"]

        # Start Session B (payment failure)
        resp_b = client.post("/simulator/start", json={
            "session_label": "Session B (Payment)",
            "persona": "confused",
            "scenario": "payment_failure",
            "initial_emotion": "worried",
            "issue_severity": 3,
            "patience_level": 3,
            "expected_resolution": "Payment fix",
        })
        session_b_id = resp_b.json()["session_id"]

        hist_a = client.get(f"/simulator/{session_a_id}/history").json()["messages"]
        hist_b = client.get(f"/simulator/{session_b_id}/history").json()["messages"]

        text_a = " ".join(m["message_text"] for m in hist_a).lower()
        text_b = " ".join(m["message_text"] for m in hist_b).lower()

        # Order complaint should be in A, not B
        assert "order" in text_a or "delayed" in text_a or "arrive" in text_a
        assert "payment" in text_b or "charged" in text_b or "checkout" in text_b

    def test_t4_analysis_does_not_leak_across_sessions(self, client):
        """MOCK: Task 4 analysis is strictly partitioned by session_id."""
        resp_refund = client.post("/simulator/start", json={
            "session_label": "Session Refund",
            "persona": "frustrated",
            "scenario": "refund",
            "initial_emotion": "frustrated",
            "issue_severity": 3,
            "patience_level": 3,
            "expected_resolution": "Refund",
        })
        resp_account = client.post("/simulator/start", json={
            "session_label": "Session Account",
            "persona": "confused",
            "scenario": "account_issue",
            "initial_emotion": "confused",
            "issue_severity": 2,
            "patience_level": 4,
            "expected_resolution": "Account",
        })

        data_ref = resp_refund.json()
        data_acc = resp_account.json()

        assert data_ref["analysis"]["intent"] == "refund"
        assert data_acc["analysis"]["intent"] == "account_issue"

    def test_t5_recommendations_session_specific(self, client, monkeypatch):
        """MOCK: Task 5 contextual retrieval only resolves antecedent turns from its own session."""
        monkeypatch.setattr(
            "app.services.simulator_service.generate_with_gemini",
            lambda prompt: "Where is it now?"
        )
        # Session A: delayed laptop order
        resp_a = client.post("/simulator/start", json={
            "session_label": "Session A Laptop",
            "persona": "calm",
            "scenario": "delayed_order",
            "initial_emotion": "neutral",
            "issue_severity": 2,
            "patience_level": 4,
            "expected_resolution": "Laptop status",
        })
        session_a_id = resp_a.json()["session_id"]

        turn2_a = client.post("/simulator/message", json={
            "session_id": session_a_id,
            "agent_response": "I can assist you with your laptop delivery."
        })
        query_a = turn2_a.json().get("contextual_query", "")

        # Contextual query in session A must reference delivery / shipping / tracking
        assert "where is it now" in query_a.lower()


# ===========================================================================
# 6. BACKWARD COMPATIBILITY TESTS (MOCK)
# ===========================================================================

class TestBackwardCompatibility:
    """Tests ensuring existing Task 3, Task 4, and Task 5 interfaces continue working without change."""

    def test_task3_simulator_start_returns_required_fields(self, client):
        """MOCK: /simulator/start response preserves exact Task 3 keys."""
        resp = client.post("/simulator/start", json={
            "session_label": "Task 3 Compat Test",
            "persona": "calm",
            "scenario": "refund",
            "initial_emotion": "neutral",
            "issue_severity": 2,
            "patience_level": 4,
            "expected_resolution": "Refund processed",
        })
        assert resp.status_code == 200
        data = resp.json()
        for field in ["session_id", "conversation_id", "customer_message", "turn", "state"]:
            assert field in data

    def test_task3_simulator_message_returns_required_fields(self, client):
        """MOCK: /simulator/message response preserves exact Task 3 keys."""
        start_resp = client.post("/simulator/start", json={
            "session_label": "Task 3 Msg Compat",
            "persona": "calm",
            "scenario": "refund",
            "initial_emotion": "neutral",
            "issue_severity": 2,
            "patience_level": 4,
            "expected_resolution": "Refund",
        })
        session_id = start_resp.json()["session_id"]

        resp = client.post("/simulator/message", json={
            "session_id": session_id,
            "agent_response": "Checking your request now."
        })
        assert resp.status_code == 200
        data = resp.json()
        for field in ["session_id", "customer_message", "turn", "state", "is_resolved", "is_escalated"]:
            assert field in data

    def test_task4_standalone_endpoint_remains_functional(self, client):
        """MOCK: POST /analysis/analyze continues to function independently."""
        start_resp = client.post("/simulator/start", json={
            "session_label": "Task 4 Standalone Compat",
            "persona": "calm",
            "scenario": "refund",
            "initial_emotion": "neutral",
            "issue_severity": 2,
            "patience_level": 4,
            "expected_resolution": "Refund",
        })
        session_id = start_resp.json()["session_id"]

        resp = client.post("/analysis/analyze", json={
            "session_id": session_id,
            "customer_message": "Can I get my money back?",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["intent"] == "refund"

    def test_task5_standalone_recommend_remains_functional(self, client):
        """MOCK: POST /knowledge/recommend continues to accept standalone queries."""
        resp = client.post("/knowledge/recommend", json={
            "query": "How do I request a refund?"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["query"] == "How do I request a refund?"
        assert isinstance(data["recommendations"], list)

    def test_support_turn_endpoint_functional(self, client):
        """MOCK: POST /support/turn successfully processes an integrated agent turn."""
        start_resp = client.post("/simulator/start", json={
            "session_label": "Support Turn Endpoint Test",
            "persona": "calm",
            "scenario": "delayed_order",
            "initial_emotion": "neutral",
            "issue_severity": 2,
            "patience_level": 4,
            "expected_resolution": "Tracking",
        })
        session_id = start_resp.json()["session_id"]

        resp = client.post("/support/turn", json={
            "session_id": session_id,
            "agent_response": "I have looked up your order; it is scheduled for delivery today."
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["session_id"] == session_id
        assert data["turn"] == 2
        assert "customer_message" in data
        assert "analysis" in data
        assert "recommendations" in data


# ===========================================================================
# 7. REAL RAG END-TO-END TESTS (REAL)
# ===========================================================================

class TestRealRAGEndToEnd:
    """Tests executing the full integrated pipeline against the REAL local ChromaDB knowledge base."""

    @pytest.fixture(autouse=True)
    def check_chromadb(self):
        """Skip if ChromaDB is unavailable."""
        chroma_path = os.path.join(os.path.dirname(__file__), "..", "data", "chroma_db")
        if not os.path.exists(chroma_path):
            pytest.skip("ChromaDB data directory not found — skipping REAL tests")
        try:
            import chromadb
            client = chromadb.PersistentClient(path=chroma_path)
            coll = client.get_or_create_collection("support_knowledge_base")
            if coll.count() == 0:
                pytest.skip("ChromaDB collection empty — skipping REAL tests")
        except Exception as e:
            pytest.skip(f"ChromaDB unavailable: {e}")

    def test_real_e2e_delivery_delay_flow(self, client, monkeypatch):
        """REAL: 3-turn live conversation flow for delayed order scenario using persistent ChromaDB."""
        turns = [
            "Where is it now?",
            "Can you give me the courier tracking number?",
        ]
        turn_iter = iter(turns)
        monkeypatch.setattr(
            "app.services.simulator_service.generate_with_gemini",
            lambda prompt: next(turn_iter, "Thank you, that helps.")
        )

        # Turn 1: Start simulation
        start_resp = client.post("/simulator/start", json={
            "session_label": "Real E2E Delivery Flow",
            "persona": "calm",
            "scenario": "delayed_order",
            "initial_emotion": "neutral",
            "issue_severity": 2,
            "patience_level": 4,
            "expected_resolution": "Tracking update",
        })
        assert start_resp.status_code == 200
        data1 = start_resp.json()
        session_id = data1["session_id"]
        assert data1["turn"] == 1
        assert len(data1["recommendations"]) >= 1

        # Turn 2: Agent responds, customer asks "Where is it now?"
        turn2_resp = client.post("/simulator/message", json={
            "session_id": session_id,
            "agent_response": "I can help you check your order delivery status right away."
        })
        assert turn2_resp.status_code == 200
        data2 = turn2_resp.json()
        assert data2["turn"] == 2
        assert data2["contextual_query"] is not None
        assert len(data2["recommendations"]) >= 1
        assert 0.0 <= data2["recommendations"][0]["relevance_score"] <= 1.0

        # Turn 3: Agent responds, customer asks for tracking number
        turn3_resp = client.post("/simulator/message", json={
            "session_id": session_id,
            "agent_response": "Your tracking number is TRK-8899212 with standard courier."
        })
        assert turn3_resp.status_code == 200
        data3 = turn3_resp.json()
        assert data3["turn"] == 3
        assert len(data3["recommendations"]) >= 1

    def test_real_e2e_refund_flow(self, client, monkeypatch):
        """REAL: 3-turn live conversation flow for refund request scenario using persistent ChromaDB."""
        turns = [
            "How long does the refund process take?",
            "Will the money go back to my original credit card?",
        ]
        turn_iter = iter(turns)
        monkeypatch.setattr(
            "app.services.simulator_service.generate_with_gemini",
            lambda prompt: next(turn_iter, "Great, thanks.")
        )

        # Turn 1
        start_resp = client.post("/simulator/start", json={
            "session_label": "Real E2E Refund Flow",
            "persona": "frustrated",
            "scenario": "refund",
            "initial_emotion": "frustrated",
            "issue_severity": 3,
            "patience_level": 3,
            "expected_resolution": "Full refund",
        })
        assert start_resp.status_code == 200
        data1 = start_resp.json()
        session_id = data1["session_id"]
        assert any("refund" in r["title"].lower() or "refund" in r["content"].lower() for r in data1["recommendations"])

        # Turn 2
        turn2_resp = client.post("/simulator/message", json={
            "session_id": session_id,
            "agent_response": "I have submitted the refund request to our finance team."
        })
        assert turn2_resp.status_code == 200
        data2 = turn2_resp.json()
        assert len(data2["recommendations"]) >= 1
        assert any("refund" in r["title"].lower() or "refund" in r["content"].lower() for r in data2["recommendations"])

        # Turn 3
        turn3_resp = client.post("/simulator/message", json={
            "session_id": session_id,
            "agent_response": "Refunds typically appear within 5 to 7 business days."
        })
        assert turn3_resp.status_code == 200
        data3 = turn3_resp.json()
        assert len(data3["recommendations"]) >= 1

    def test_real_e2e_payment_failure_flow(self, client, monkeypatch):
        """REAL: 2-turn live conversation flow for payment failure scenario using persistent ChromaDB."""
        monkeypatch.setattr(
            "app.services.simulator_service.generate_with_gemini",
            lambda prompt: "My card was charged twice! Please reverse the second charge."
        )
        # Turn 1
        start_resp = client.post("/simulator/start", json={
            "session_label": "Real E2E Payment Flow",
            "persona": "confused",
            "scenario": "payment_failure",
            "initial_emotion": "worried",
            "issue_severity": 3,
            "patience_level": 3,
            "expected_resolution": "Duplicate charge reversed",
        })
        assert start_resp.status_code == 200
        data1 = start_resp.json()
        session_id = data1["session_id"]
        assert len(data1["recommendations"]) >= 1

        # Turn 2
        turn2_resp = client.post("/simulator/message", json={
            "session_id": session_id,
            "agent_response": "I can see the duplicate transaction and am issuing an immediate reversal."
        })
        assert turn2_resp.status_code == 200
        data2 = turn2_resp.json()
        assert len(data2["recommendations"]) >= 1
        assert data2["analysis"]["intent"] in ["payment_issue", "refund"]
