"""
Whole-Project Backend — 5 End-to-End Test Cases
================================================
These 5 tests verify the full backend pipeline across all 3 tasks:

  TC1: Task 3 — Customer Simulator Session (start + multi-turn via HTTP API)
  TC2: Task 4 — Intent & Sentiment Analysis (analyze a message, verify all output fields)
  TC3: Task 5 — Knowledge Recommendation (retrieve relevant articles from real ChromaDB)
  TC4: Integration — Task 3 → Task 4 → Task 5 full pipeline (end-to-end turn)
  TC5: API Health — All critical API endpoints respond correctly

Run with:
    python -m pytest tests/test_backend_e2e.py -v
"""

import sys
import os
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from app.main import app
from app.models.database import SessionLocal
from app.models.simulator import Scenario, Session, Conversation, Message
from app.services.analysis_service import analyze_customer_message
from app.services.knowledge_recommendation_service import get_knowledge_recommendations
from datetime import datetime

client = TestClient(app)


# ═══════════════════════════════════════════════════════════════════════
# HELPER: Create a real DB session with scenario + conversation for tests
# ═══════════════════════════════════════════════════════════════════════
@pytest.fixture
def db_session_with_scenario():
    """Creates a real DB scenario → session → conversation → customer message
    and yields (db, session_id, conversation_id). Cleans up after test."""
    db = SessionLocal()
    try:
        # 1. Create Scenario
        scen = Scenario(
            title="E2E Test Refund Scenario",
            category="refund",
            difficulty="Medium",
            objective="Process refund request",
            is_active=True,
        )
        db.add(scen)
        db.flush()

        # 2. Create Session
        sess = Session(
            scenario_id=scen.scenario_id,
            start_time=datetime.utcnow(),
            status="In Progress",
        )
        db.add(sess)
        db.flush()

        # 3. Create Conversation
        conv = Conversation(
            session_id=sess.session_id,
            intent="refund",
            sentiment="frustrated",
            resolution_status="Unresolved",
            escalation_risk="Low",
            created_at=datetime.utcnow(),
        )
        db.add(conv)
        db.flush()

        # 4. Create a customer message
        msg = Message(
            conversation_id=conv.conversation_id,
            sender_type="Customer",
            message_text="I want a refund for my order #ORD-99001, the product arrived damaged.",
            timestamp=datetime.utcnow(),
            message_type="Text",
        )
        db.add(msg)
        db.flush()

        yield db, sess.session_id, conv.conversation_id
    finally:
        db.close()


# ──────────────────────────────────────────────────────────────────────
# TC1: Task 3 — Customer Simulator Start & Turn via HTTP API
# ──────────────────────────────────────────────────────────────────────
class TestTC1_SimulatorSession:
    """Verifies the Customer Simulator (Task 3) can start a session and
    process a multi-turn conversation through the HTTP API."""

    def test_start_simulator_and_send_message(self):
        # Step 1: Start a simulator session
        start_payload = {
            "session_label": "E2E Backend Test",
            "persona": "calm",
            "scenario": "refund",
            "initial_emotion": "neutral",
            "issue_severity": 3,
            "patience_level": 5,
            "expected_resolution": "Full refund",
        }
        start_resp = client.post("/simulator/start", json=start_payload)
        assert start_resp.status_code == 200, (
            f"Simulator start failed: {start_resp.status_code} {start_resp.text}"
        )

        start_data = start_resp.json()

        # Must return a session_id and opening customer message
        assert "session_id" in start_data, "Response missing session_id"
        assert start_data["session_id"] > 0
        assert "customer_message" in start_data, "Response missing customer_message"
        assert len(start_data["customer_message"]) > 10, (
            "Customer opening message too short"
        )

        session_id = start_data["session_id"]

        # Step 2: Send an agent response to get the next customer turn
        turn_payload = {
            "session_id": session_id,
            "agent_response": "I understand your concern. Could you please provide your order number so I can look into the refund?",
        }
        turn_resp = client.post("/simulator/message", json=turn_payload)
        assert turn_resp.status_code == 200, (
            f"Simulator send failed: {turn_resp.status_code} {turn_resp.text}"
        )

        turn_data = turn_resp.json()
        assert "customer_message" in turn_data, "Turn response missing customer_message"
        assert len(turn_data["customer_message"]) > 5, (
            "Follow-up customer message too short"
        )


# ──────────────────────────────────────────────────────────────────────
# TC2: Task 4 — Intent & Sentiment Analysis
# ──────────────────────────────────────────────────────────────────────
class TestTC2_IntentSentimentAnalysis:
    """Verifies Task 4 can analyze a customer message and return all
    required fields: intent, emotion, sentiment, frustration_level,
    satisfaction_trend, escalation_risk, and confidence."""

    def test_analyze_refund_complaint(self, db_session_with_scenario):
        db, session_id, conv_id = db_session_with_scenario

        result = analyze_customer_message(
            session_id=session_id,
            customer_message="I want a refund for my order #ORD-99001, the product arrived damaged.",
            db=db,
        )

        # Must return an AnalysisResult with all required fields
        assert result is not None, "Analysis returned None"
        assert hasattr(result, "intent"), "Missing intent field"
        assert hasattr(result, "emotion"), "Missing emotion field"
        assert hasattr(result, "sentiment"), "Missing sentiment field"
        assert hasattr(result, "frustration_level"), "Missing frustration_level"
        assert hasattr(result, "satisfaction_trend"), "Missing satisfaction_trend"
        assert hasattr(result, "escalation_risk"), "Missing escalation_risk"
        assert hasattr(result, "confidence"), "Missing confidence"

        # Intent should be refund-related
        intent_str = str(result.intent).lower()
        assert intent_str in [
            "refund", "return_exchange", "complaint", "general_inquiry",
            "customerintent.refund", "customerintent.return_exchange",
            "customerintent.complaint", "customerintent.general_inquiry",
        ], f"Unexpected intent '{intent_str}' for a refund complaint"

        # Frustration level should be a number
        assert isinstance(result.frustration_level, (int, float))
        assert 0 <= result.frustration_level <= 10

        # Confidence should be between 0 and 1
        assert 0.0 <= result.confidence <= 1.0

    def test_analyze_angry_escalation(self, db_session_with_scenario):
        db, session_id, conv_id = db_session_with_scenario

        result = analyze_customer_message(
            session_id=session_id,
            customer_message="This is absolutely unacceptable! I want to speak to a supervisor immediately! I'm filing a dispute!",
            db=db,
        )

        assert result is not None
        # Should detect high frustration for angry messages
        assert result.frustration_level >= 5, (
            f"Expected high frustration for angry message, got {result.frustration_level}"
        )


# ──────────────────────────────────────────────────────────────────────
# TC3: Task 5 — Knowledge Recommendation from Real ChromaDB
# ──────────────────────────────────────────────────────────────────────
class TestTC3_KnowledgeRecommendation:
    """Verifies Task 5 retrieves relevant knowledge articles from the
    real ChromaDB knowledge base for different customer query types."""

    def test_payment_query_retrieves_payment_docs(self):
        result = get_knowledge_recommendations(
            query="My payment keeps failing at checkout with an error code"
        )

        assert len(result.recommendations) >= 3
        assert result.no_relevant_information is False

        # At least one recommendation should mention payment/checkout
        payment_found = any(
            "payment" in r.content.lower() or "checkout" in r.content.lower()
            for r in result.recommendations
        )
        assert payment_found, "No payment/checkout content in recommendations"

        # All recommendations must have valid sources and scores
        for rec in result.recommendations:
            assert rec.relevance_score >= 0.38
            assert "chunk:" in rec.source
            assert rec.document_type in ["faq", "policy", "support_document"]

    def test_login_query_retrieves_account_docs(self):
        result = get_knowledge_recommendations(
            query="I cannot log in to my account, how do I reset my password?"
        )

        assert len(result.recommendations) >= 3

        # Top recommendation should be about login/password
        top = result.recommendations[0]
        top_text = (top.content + " " + top.title).lower()
        assert any(
            kw in top_text for kw in ["login", "log in", "password", "reset", "account"]
        ), f"Top recommendation not about login: {top.title}"


# ──────────────────────────────────────────────────────────────────────
# TC4: Integration — Full Task 3 → Task 4 → Task 5 Pipeline
# ──────────────────────────────────────────────────────────────────────
class TestTC4_FullPipelineIntegration:
    """Verifies the complete integrated pipeline: starting a simulator
    session (Task 3), analyzing the customer message (Task 4), and
    retrieving knowledge recommendations (Task 5) — all in one flow."""

    def test_end_to_end_pipeline(self, db_session_with_scenario):
        db, session_id, conv_id = db_session_with_scenario

        customer_msg = "I want a refund for my order #ORD-99001, the product arrived damaged."

        # ── Step 1: Task 4 — Analyze the customer message ──
        analysis = analyze_customer_message(
            session_id=session_id,
            customer_message=customer_msg,
            db=db,
        )
        assert analysis is not None
        assert hasattr(analysis, "intent")

        # ── Step 2: Task 5 — Get knowledge recommendations using analysis ──
        analysis_dict = analysis.model_dump() if hasattr(analysis, "model_dump") else {}

        rec_result = get_knowledge_recommendations(
            query=customer_msg,
            session_id=session_id,
            conversation_id=conv_id,
            analysis=analysis_dict,
            db=db,
        )

        # Should return 3-5 recommendations
        assert 3 <= len(rec_result.recommendations) <= 5, (
            f"Expected 3-5 recommendations, got {len(rec_result.recommendations)}"
        )
        assert rec_result.no_relevant_information is False

        # Recommendations should contain refund/return/policy content
        all_content = " ".join(r.content.lower() for r in rec_result.recommendations)
        assert any(
            kw in all_content for kw in ["refund", "return", "policy", "eligibility"]
        ), "Pipeline should retrieve refund-related knowledge"

        # Source attribution must be intact
        for rec in rec_result.recommendations:
            assert rec.source, "Recommendation missing source"
            assert "chunk:" in rec.source
            assert "document:" in rec.source

        # ── Step 3: Verify contextual query was built ──
        assert rec_result.contextual_query is not None
        assert len(rec_result.contextual_query) > len(customer_msg) * 0.5, (
            "Contextual query should include enrichment tokens"
        )


# ──────────────────────────────────────────────────────────────────────
# TC5: API Health — All Critical Endpoints Respond
# ──────────────────────────────────────────────────────────────────────
class TestTC5_APIEndpointHealth:
    """Verifies that all critical backend API endpoints are registered
    and respond to requests (correct status codes, no 500 errors)."""

    def test_simulator_start_endpoint_exists(self):
        """POST /simulator/start — should accept valid payload."""
        resp = client.post("/simulator/start", json={
            "session_label": "Health Check",
            "persona": "calm",
            "scenario": "refund",
            "initial_emotion": "neutral",
            "issue_severity": 3,
            "patience_level": 5,
            "expected_resolution": "Refund",
        })
        assert resp.status_code == 200

    def test_simulator_start_rejects_invalid_persona(self):
        """POST /simulator/start — should return 400 for invalid persona."""
        resp = client.post("/simulator/start", json={
            "session_label": "Bad Persona",
            "persona": "nonexistent_persona_xyz",
            "scenario": "refund",
            "initial_emotion": "neutral",
            "issue_severity": 3,
            "patience_level": 5,
            "expected_resolution": "Refund",
        })
        assert resp.status_code == 400

    def test_support_endpoint_exists(self):
        """POST /support/ — should accept a support request."""
        resp = client.post("/support/", json={
            "issue_type": "Technical Issue",
            "message": "My app keeps crashing when I try to upload documents",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert "support_response" in data

    def test_knowledge_endpoint_exists(self):
        """POST /knowledge/recommend — should return recommendations."""
        resp = client.post("/knowledge/recommend", json={
            "query": "How do I reset my password?",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "recommendations" in data
        assert len(data["recommendations"]) >= 1

    def test_support_turn_rejects_invalid_session(self):
        """POST /support/turn — should return 404 for non-existent session."""
        resp = client.post("/support/turn", json={
            "session_id": 999999,
            "agent_response": "Hello, how can I help?",
        })
        assert resp.status_code == 404
