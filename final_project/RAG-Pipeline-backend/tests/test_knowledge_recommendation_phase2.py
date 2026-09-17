"""Task 5 Phase 2 — Context-Aware Knowledge Recommendation Tests.

Test categories:
    1. CONTEXT tests         — Dialogue history, pronoun resolution, reference extraction
    2. TASK 4 INTEGRATION   — Intent-aware query expansion, intent ranking boost, emotion safety
    3. RANKING & THRESHOLD  — Ordering, score bounds, threshold filtering, deduplication
    4. SOURCE ATTRIBUTION   — Exact metadata preservation, no fabrication
    5. NO-RESULT tests      — Safe empty response, context does not create false positives
    6. API tests            — Standalone backward compatibility, context payloads, session 404
    7. REAL RAG tests       — Real multi-turn retrieval against persistent ChromaDB

Each test is clearly documented as MOCK or REAL.
"""

import os
import sys
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime

# Ensure project root is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.schemas.knowledge import (
    KnowledgeRecommendation,
    KnowledgeRecommendationRequest,
    KnowledgeRecommendationResult,
)
from app.schemas.analysis import (
    CustomerIntent,
    CustomerEmotion,
    CustomerSentiment,
    SatisfactionTrend,
    EscalationRisk,
    AnalysisResponse,
    AnalysisResult,
)
from app.services.knowledge_recommendation_service import (
    build_contextual_query,
    get_knowledge_recommendations,
    get_session_context,
    _extract_intent,
    _calculate_intent_boost,
    _distance_to_relevance,
    DEFAULT_RELEVANCE_THRESHOLD,
    MAX_RECOMMENDATIONS,
)


# ===========================================================================
# HELPERS — Mocked ChromaDB result builders
# ===========================================================================

def _build_chroma_results(items):
    """Build a ChromaDB-style result dict from a list of (id, text, metadata, distance) tuples."""
    ids = [item[0] for item in items]
    documents = [item[1] for item in items]
    metadatas = [item[2] for item in items]
    distances = [item[3] for item in items]
    return {
        "ids": [ids],
        "documents": [documents],
        "metadatas": [metadatas],
        "distances": [distances],
    }


SAMPLE_FAQ_ITEM = (
    "doc_5_v1_p1_c1",
    "To request a refund, visit your order history and click 'Request Refund'.",
    {"document_id": 5, "document_name": "Customer Support FAQ", "document_type": "faq",
     "version": 1, "page_number": 1, "uploaded_by": "admin"},
    0.35,
)

SAMPLE_POLICY_ITEM = (
    "doc_1_v1_p1_c1",
    "Our cancellation policy allows free cancellation within 24 hours of purchase.",
    {"document_id": 1, "document_name": "Cancel policy", "document_type": "policy",
     "version": 1, "page_number": 1, "uploaded_by": "admin"},
    0.50,
)

SAMPLE_DELIVERY_ITEM = (
    "doc_10_v1_p1_c1",
    "Standard delivery takes 3 to 5 business days. You can track your package using the tracking ID.",
    {"document_id": 10, "document_name": "Delivery policy", "document_type": "policy",
     "version": 1, "page_number": 1, "uploaded_by": "admin"},
    0.40,
)

SAMPLE_PAYMENT_ITEM = (
    "doc_3_v1_p1_c1",
    "Payment failures may occur due to incorrect card details or 3D-Secure timeout.",
    {"document_id": 3, "document_name": "Payment policy", "document_type": "policy",
     "version": 1, "page_number": 1, "uploaded_by": "admin"},
    0.42,
)


# ===========================================================================
# 1. CONTEXT TESTS (MOCK)
# ===========================================================================

class TestContextAwareRetrieval:
    """Tests for conversation context handling, pronoun resolution, and history extraction. [MOCK]"""

    def test_standalone_query_unaffected_by_context_module(self):
        """MOCK: Standalone query without history produces clean identical query."""
        q = "How do I request a refund for my order?"
        built = build_contextual_query(q, dialogue_history=None, intent=None)
        assert built == q

    def test_pronoun_reference_resolution(self):
        """MOCK: Short pronoun query ('Where is it?') expands with previous customer turn keywords."""
        history = [
            {"sender_type": "Customer", "message_text": "I ordered a laptop last week and it was supposed to arrive yesterday."},
            {"sender_type": "Support Agent", "message_text": "I can certainly look into your order status."},
        ]
        built = build_contextual_query("Where is it?", dialogue_history=history, intent=None)
        assert "Where is it?" in built
        assert any(term in built.lower() for term in ["laptop", "ordered", "arrive", "yesterday"])

    def test_that_reference_resolution(self):
        """MOCK: 'How long does that take?' expands with antecedent turn context."""
        history = [
            {"sender_type": "Customer", "message_text": "I submitted a refund request for my defective charger."},
        ]
        built = build_contextual_query("How long does that take?", dialogue_history=history, intent="refund")
        assert "refund" in built.lower()

    def test_system_messages_excluded_from_context(self):
        """MOCK: Internal system messages or state rows are never injected into retrieval query."""
        history = [
            {"sender_type": "Customer", "message_text": "My payment failed twice."},
            {"sender_type": "AI", "message_type": "System", "message_text": '{"state": {"frustration": 80}, "persona": "angry"}'},
            {"sender_type": "Support Agent", "message_text": "Let me help you check that payment."},
        ]
        built = build_contextual_query("Why did it fail?", dialogue_history=history, intent=None)
        assert "frustration" not in built
        assert "persona" not in built
        assert "payment" in built.lower()

    def test_empty_history_handled_safely(self):
        """MOCK: Empty list history does not cause error or modify query."""
        built = build_contextual_query("Cancel my order", dialogue_history=[], intent=None)
        assert built == "Cancel my order"

    def test_long_history_bounded_to_recent_turns(self):
        """MOCK: Older irrelevant turns (>2 turns ago) do not dominate query construction."""
        history = [
            {"sender_type": "Customer", "message_text": "Last year I had an account login issue with my old email."},
            {"sender_type": "Support Agent", "message_text": "That was resolved."},
            {"sender_type": "Customer", "message_text": "My new package is late."},
            {"sender_type": "Support Agent", "message_text": "Let me check the courier."},
        ]
        built = build_contextual_query("Where is it now?", dialogue_history=history, intent=None)
        # Should contain 'package' / 'late', but NOT 'email' or 'login'
        assert "package" in built.lower() or "late" in built.lower()
        assert "email" not in built.lower()

    def test_contextual_query_returned_in_result_observability(self):
        """MOCK: When context is used, contextual_query field is populated in result."""
        mock_embedding = [0.1] * 384
        chroma_results = _build_chroma_results([SAMPLE_DELIVERY_ITEM])
        active_ids = {SAMPLE_DELIVERY_ITEM[2]["document_id"]}
        history = [
            {"sender_type": "Customer", "message_text": "I ordered a tablet."},
        ]

        with patch(
            "app.services.knowledge_recommendation_service.generate_embedding",
            return_value=mock_embedding,
        ), patch(
            "app.services.knowledge_recommendation_service.search_documents",
            return_value=chroma_results,
        ), patch(
            "app.services.knowledge_recommendation_service.get_latest_active_document_ids",
            return_value=active_ids,
        ), patch(
            "app.services.knowledge_recommendation_service.normalize_question",
            side_effect=lambda q: q.lower(),
        ):
            res = get_knowledge_recommendations(
                query="Where is it?",
                conversation_history=history,
            )

        assert res.contextual_query is not None
        assert "tablet" in res.contextual_query.lower()


# ===========================================================================
# 2. TASK 4 INTEGRATION TESTS (MOCK)
# ===========================================================================

class TestTask4Integration:
    """Tests for consuming Task 4 AnalysisResult, intent signals, and emotion safety. [MOCK]"""

    def test_intent_expansion_adds_topic_keywords(self):
        """MOCK: Task 4 intent expands query with relevant domain terms."""
        built = build_contextual_query("I have a problem", dialogue_history=None, intent="refund")
        assert "refund" in built.lower()

    def test_intent_from_analysis_result_object(self):
        """MOCK: AnalysisResult instance is correctly parsed for intent."""
        analysis = AnalysisResult(
            intent=CustomerIntent.DELIVERY_ISSUE,
            emotion=CustomerEmotion.FRUSTRATED,
            sentiment=CustomerSentiment.NEGATIVE,
            frustration_level=7,
            satisfaction_trend=SatisfactionTrend.DECLINING,
            escalation_risk=EscalationRisk.HIGH,
            confidence=0.92,
        )
        extracted = _extract_intent(analysis)
        assert extracted == "delivery_issue"

    def test_intent_from_analysis_response_object(self):
        """MOCK: AnalysisResponse instance is correctly parsed for intent."""
        resp = AnalysisResponse(
            intent=CustomerIntent.PAYMENT_ISSUE,
            emotion=CustomerEmotion.WORRIED,
            sentiment=CustomerSentiment.NEGATIVE,
            frustration_level=5,
            satisfaction_trend=SatisfactionTrend.STABLE,
            escalation_risk=EscalationRisk.MEDIUM,
            confidence=0.88,
        )
        extracted = _extract_intent(resp)
        assert extracted == "payment_issue"

    def test_intent_from_dict(self):
        """MOCK: Dict with 'intent' key is parsed properly."""
        extracted = _extract_intent({"intent": "cancellation", "emotion": "angry"})
        assert extracted == "cancellation"

    def test_intent_from_enum(self):
        """MOCK: CustomerIntent enum directly passed is parsed properly."""
        extracted = _extract_intent(CustomerIntent.REFUND)
        assert extracted == "refund"

    def test_missing_or_none_analysis_safe(self):
        """MOCK: None or empty analysis does not fail and returns None."""
        assert _extract_intent(None) is None
        assert _extract_intent({}) is None
        assert _extract_intent("invalid_intent_string_xyz") is None

    def test_emotion_does_not_override_semantic_relevance(self):
        """MOCK: Emotion (angry) does NOT change query topic or inject irrelevant anger content."""
        analysis = {
            "intent": "delivery_issue",
            "emotion": "angry",
            "frustration_level": 9,
        }
        built = build_contextual_query("Where is my shipment?", dialogue_history=None, intent=_extract_intent(analysis))
        assert "angry" not in built.lower()
        assert "frustration" not in built.lower()
        assert "shipment" in built.lower()

    def test_intent_boost_applied_to_matching_document(self):
        """MOCK: Document matching customer intent gets bounded +0.02 boost."""
        boost = _calculate_intent_boost(
            document_name="Refund Policy",
            content="Customers can request a refund within 14 days.",
            intent="refund"
        )
        assert boost == 0.02

    def test_intent_boost_not_applied_to_unrelated_document(self):
        """MOCK: Document unrelated to intent gets 0.0 boost."""
        boost = _calculate_intent_boost(
            document_name="Cancel policy",
            content="Cancellation is allowed before dispatch.",
            intent="refund"
        )
        assert boost == 0.0


# ===========================================================================
# 3. RANKING & THRESHOLD TESTS (MOCK)
# ===========================================================================

class TestRankingAndThresholdPhase2:
    """Tests verifying relevance ranking, intent alignment, thresholding, and deduplication. [MOCK]"""

    def test_intent_boost_reorders_close_relevance_documents(self):
        """MOCK: Intent boost allows an intent-aligned document to rank ahead when distances are identical."""
        # Doc A: Cancel policy (dist 0.40)
        # Doc B: Refund Policy (dist 0.40)
        # When intent is 'refund', Doc B gets the +0.02 boost and ranks first
        items = [
            ("doc_1", "Cancel policy text", {"document_id": 1, "document_name": "Cancel policy", "document_type": "policy"}, 0.40),
            ("doc_2", "Refund Policy text", {"document_id": 2, "document_name": "Refund Policy", "document_type": "policy"}, 0.40),
        ]
        mock_embedding = [0.1] * 384
        chroma_results = _build_chroma_results(items)

        with patch(
            "app.services.knowledge_recommendation_service.generate_embedding",
            return_value=mock_embedding,
        ), patch(
            "app.services.knowledge_recommendation_service.search_documents",
            return_value=chroma_results,
        ), patch(
            "app.services.knowledge_recommendation_service.get_latest_active_document_ids",
            return_value={1, 2},
        ), patch(
            "app.services.knowledge_recommendation_service.normalize_question",
            side_effect=lambda q: q.lower(),
        ):
            res = get_knowledge_recommendations(
                query="I need help with my transaction",
                analysis={"intent": "refund"},
            )

        assert res.recommendations[0].title == "Refund Policy"
        assert res.recommendations[0].relevance_score > res.recommendations[1].relevance_score

    def test_deduplication_removes_identical_content_chunks(self):
        """MOCK: Identical chunks across different versions are deduplicated."""
        identical_text = "Page 2: Standard refund turnaround is 5 to 7 days."
        items = [
            ("doc_1_v1", identical_text, {"document_id": 1, "document_name": "Refund Policy", "version": 1, "document_type": "policy"}, 0.35),
            ("doc_1_v2", identical_text, {"document_id": 2, "document_name": "Refund Policy", "version": 2, "document_type": "policy"}, 0.36),
        ]
        mock_embedding = [0.1] * 384
        chroma_results = _build_chroma_results(items)

        with patch(
            "app.services.knowledge_recommendation_service.generate_embedding",
            return_value=mock_embedding,
        ), patch(
            "app.services.knowledge_recommendation_service.search_documents",
            return_value=chroma_results,
        ), patch(
            "app.services.knowledge_recommendation_service.get_latest_active_document_ids",
            return_value={1, 2},
        ), patch(
            "app.services.knowledge_recommendation_service.normalize_question",
            side_effect=lambda q: q.lower(),
        ):
            res = get_knowledge_recommendations(query="refund timeline")

        # Deduplication ensures only 1 recommendation is returned, not 2 duplicates
        assert len(res.recommendations) == 1

    def test_max_recommendations_never_exceeds_5(self):
        """MOCK: Recommendation count never exceeds MAX_RECOMMENDATIONS (5)."""
        items = [
            (f"doc_{i}", f"Unique content paragraph {i}.", {"document_id": i, "document_name": f"Policy {i}", "document_type": "policy"}, 0.30 + (i * 0.02))
            for i in range(8)
        ]
        mock_embedding = [0.1] * 384
        chroma_results = _build_chroma_results(items)

        with patch(
            "app.services.knowledge_recommendation_service.generate_embedding",
            return_value=mock_embedding,
        ), patch(
            "app.services.knowledge_recommendation_service.search_documents",
            return_value=chroma_results,
        ), patch(
            "app.services.knowledge_recommendation_service.get_latest_active_document_ids",
            return_value=set(range(8)),
        ), patch(
            "app.services.knowledge_recommendation_service.normalize_question",
            side_effect=lambda q: q.lower(),
        ):
            res = get_knowledge_recommendations(query="general policy info", max_results=10)

        assert len(res.recommendations) <= MAX_RECOMMENDATIONS

    def test_relevance_scores_within_zero_to_one(self):
        """MOCK: All computed relevance scores fall strictly within [0.0, 1.0]."""
        items = [SAMPLE_FAQ_ITEM, SAMPLE_POLICY_ITEM, SAMPLE_DELIVERY_ITEM]
        mock_embedding = [0.1] * 384
        chroma_results = _build_chroma_results(items)

        with patch(
            "app.services.knowledge_recommendation_service.generate_embedding",
            return_value=mock_embedding,
        ), patch(
            "app.services.knowledge_recommendation_service.search_documents",
            return_value=chroma_results,
        ), patch(
            "app.services.knowledge_recommendation_service.get_latest_active_document_ids",
            return_value={1, 3, 5, 10},
        ), patch(
            "app.services.knowledge_recommendation_service.normalize_question",
            side_effect=lambda q: q.lower(),
        ):
            res = get_knowledge_recommendations(query="test support query", analysis={"intent": "refund"})

        for r in res.recommendations:
            assert 0.0 <= r.relevance_score <= 1.0


# ===========================================================================
# 4. SOURCE ATTRIBUTION TESTS (MOCK)
# ===========================================================================

class TestSourceAttributionPhase2:
    """Tests ensuring source provenance is intact and un-fabricated. [MOCK]"""

    def test_source_contains_chunk_and_document_provenance(self):
        """MOCK: Source string contains chunk ID, document name, version, and page."""
        item = (
            "doc_25_v4_p2_c1",
            "Refund process details.",
            {"document_id": 25, "document_name": "Regression Refund Policy", "version": 4, "page_number": 2, "document_type": "policy"},
            0.35,
        )
        mock_embedding = [0.1] * 384
        chroma_results = _build_chroma_results([item])

        with patch(
            "app.services.knowledge_recommendation_service.generate_embedding",
            return_value=mock_embedding,
        ), patch(
            "app.services.knowledge_recommendation_service.search_documents",
            return_value=chroma_results,
        ), patch(
            "app.services.knowledge_recommendation_service.get_latest_active_document_ids",
            return_value={25},
        ), patch(
            "app.services.knowledge_recommendation_service.normalize_question",
            side_effect=lambda q: q.lower(),
        ):
            res = get_knowledge_recommendations(query="refund process")

        rec = res.recommendations[0]
        assert "chunk:doc_25_v4_p2_c1" in rec.source
        assert "document:Regression Refund Policy" in rec.source
        assert "v4" in rec.source
        assert "p2" in rec.source

    def test_missing_version_page_does_not_fabricate(self):
        """MOCK: Chunks missing version or page number do not fabricate synthetic numbers."""
        item = (
            "doc_99_c1",
            "Generic support text.",
            {"document_id": 99, "document_name": "Quick Guide", "document_type": "faq"},
            0.40,
        )
        mock_embedding = [0.1] * 384
        chroma_results = _build_chroma_results([item])

        with patch(
            "app.services.knowledge_recommendation_service.generate_embedding",
            return_value=mock_embedding,
        ), patch(
            "app.services.knowledge_recommendation_service.search_documents",
            return_value=chroma_results,
        ), patch(
            "app.services.knowledge_recommendation_service.get_latest_active_document_ids",
            return_value={99},
        ), patch(
            "app.services.knowledge_recommendation_service.normalize_question",
            side_effect=lambda q: q.lower(),
        ):
            res = get_knowledge_recommendations(query="quick guide info")

        rec = res.recommendations[0]
        assert "chunk:doc_99_c1" in rec.source
        assert "document:Quick Guide" in rec.source
        assert "vNone" not in rec.source
        assert "pNone" not in rec.source


# ===========================================================================
# 5. NO-RESULT HANDLING TESTS (MOCK)
# ===========================================================================

class TestNoResultHandlingPhase2:
    """Tests for safe no-result handling when nothing meets threshold. [MOCK]"""

    def test_irrelevant_query_with_context_still_returns_no_relevant(self):
        """MOCK: An irrelevant query ('Jupiter mass') with laptop context does not return false positives."""
        # Distances all > 1.8 (relevance < 0.35, below 0.38 threshold)
        items = [
            ("doc_1", "Refund text", {"document_id": 1, "document_name": "Refund Policy", "document_type": "policy"}, 1.85),
            ("doc_2", "Delivery text", {"document_id": 2, "document_name": "Delivery Policy", "document_type": "policy"}, 1.90),
        ]
        mock_embedding = [0.1] * 384
        chroma_results = _build_chroma_results(items)
        history = [
            {"sender_type": "Customer", "message_text": "I ordered a laptop yesterday."},
        ]

        with patch(
            "app.services.knowledge_recommendation_service.generate_embedding",
            return_value=mock_embedding,
        ), patch(
            "app.services.knowledge_recommendation_service.search_documents",
            return_value=chroma_results,
        ), patch(
            "app.services.knowledge_recommendation_service.get_latest_active_document_ids",
            return_value={1, 2},
        ), patch(
            "app.services.knowledge_recommendation_service.normalize_question",
            side_effect=lambda q: q.lower(),
        ):
            res = get_knowledge_recommendations(
                query="What is the mass of Jupiter in kilograms?",
                conversation_history=history,
            )

        assert res.recommendations == []
        assert res.no_relevant_information is True


# ===========================================================================
# 6. API TESTS (MOCK)
# ===========================================================================

class TestKnowledgeAPIPhase2:
    """API endpoint tests for Phase 2 contracts and session handling. [MOCK]"""

    @pytest.fixture
    def client(self):
        from fastapi.testclient import TestClient
        from app.main import app
        return TestClient(app)

    def test_phase1_standalone_payload_backward_compatibility(self, client):
        """MOCK: Standalone Phase 1 payload {'query': '...'} works on POST /knowledge/recommend."""
        mock_embedding = [0.1] * 384
        chroma_results = _build_chroma_results([SAMPLE_FAQ_ITEM])

        with patch(
            "app.services.knowledge_recommendation_service.generate_embedding",
            return_value=mock_embedding,
        ), patch(
            "app.services.knowledge_recommendation_service.search_documents",
            return_value=chroma_results,
        ), patch(
            "app.services.knowledge_recommendation_service.get_latest_active_document_ids",
            return_value={5},
        ), patch(
            "app.services.knowledge_recommendation_service.normalize_question",
            side_effect=lambda q: q.lower(),
        ):
            resp = client.post(
                "/knowledge/recommend",
                json={"query": "How to get a refund?"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["query"] == "How to get a refund?"
        assert isinstance(data["recommendations"], list)
        assert data["no_relevant_information"] is False

    def test_context_aware_payload_with_conversation_history(self, client):
        """MOCK: POST /knowledge/recommend accepts conversation_history and analysis."""
        mock_embedding = [0.1] * 384
        chroma_results = _build_chroma_results([SAMPLE_DELIVERY_ITEM])

        with patch(
            "app.services.knowledge_recommendation_service.generate_embedding",
            return_value=mock_embedding,
        ), patch(
            "app.services.knowledge_recommendation_service.search_documents",
            return_value=chroma_results,
        ), patch(
            "app.services.knowledge_recommendation_service.get_latest_active_document_ids",
            return_value={10},
        ), patch(
            "app.services.knowledge_recommendation_service.normalize_question",
            side_effect=lambda q: q.lower(),
        ):
            resp = client.post(
                "/knowledge/recommend",
                json={
                    "query": "Where is it now?",
                    "conversation_history": [
                        {"sender_type": "Customer", "message_text": "I ordered a phone 3 days ago."}
                    ],
                    "analysis": {
                        "intent": "delivery_issue",
                        "emotion": "frustrated",
                        "sentiment": "negative"
                    }
                },
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["query"] == "Where is it now?"
        assert data["contextual_query"] is not None
        assert "phone" in data["contextual_query"].lower()

    def test_nonexistent_session_id_returns_404(self, client):
        """MOCK: Providing a nonexistent session_id returns HTTP 404."""
        resp = client.post(
            "/knowledge/recommend",
            json={
                "query": "Where is my item?",
                "session_id": 999999,
            },
        )
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

    def test_empty_query_returns_422(self, client):
        """MOCK: Empty query string returns HTTP 422 Unprocessable Entity."""
        resp = client.post(
            "/knowledge/recommend",
            json={"query": ""},
        )
        assert resp.status_code == 422


# ===========================================================================
# 7. REAL RAG TESTS — Multi-turn against persistent ChromaDB
# ===========================================================================

class TestRealRAGPhase2:
    """Tests executing context-aware queries against the ACTUAL local ChromaDB knowledge base. [REAL]"""

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

    def test_real_multiturn_order_tracking(self):
        """REAL: Multi-turn order reference query ('Where is it now?') resolves laptop order and retrieves delivery/order policy."""
        history = [
            {"sender_type": "Customer", "message_text": "I ordered a laptop last week and it was supposed to arrive yesterday."},
            {"sender_type": "Support Agent", "message_text": "I can assist you with checking your order status."},
        ]
        res = get_knowledge_recommendations(
            query="Where is it now?",
            conversation_history=history,
            analysis={"intent": "delivery_issue"},
        )
        assert res.no_relevant_information is False
        assert len(res.recommendations) >= 1
        assert res.contextual_query is not None
        # Verify retrieved document belongs to knowledge base (FAQ or Policy)
        assert res.recommendations[0].document_type in ["faq", "policy"]
        assert 0.0 <= res.recommendations[0].relevance_score <= 1.0

    def test_real_multiturn_refund_timeline(self):
        """REAL: Multi-turn refund query ('How long does that take?') resolves refund request and retrieves refund policy."""
        history = [
            {"sender_type": "Customer", "message_text": "I submitted a refund request for my damaged item yesterday."},
        ]
        res = get_knowledge_recommendations(
            query="How long does that take?",
            conversation_history=history,
            analysis={"intent": "refund"},
        )
        assert res.no_relevant_information is False
        assert len(res.recommendations) >= 1
        assert any("refund" in r.title.lower() or "refund" in r.content.lower() for r in res.recommendations)

    def test_real_irrelevant_query_with_history_safe(self):
        """REAL: Unrelated question ('What is the mass of Jupiter in kilograms?') with support history safely returns no results."""
        history = [
            {"sender_type": "Customer", "message_text": "I ordered a laptop yesterday."},
        ]
        res = get_knowledge_recommendations(
            query="What is the mass of Jupiter in kilograms?",
            conversation_history=history,
        )
        assert res.no_relevant_information is True
        assert len(res.recommendations) == 0
