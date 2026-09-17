"""Task 5 Phase 1 — Knowledge Recommendation Agent Tests.

Test categories:
    1. CONTRACT tests         — Schema validation, serialization, field constraints
    2. RETRIEVAL tests        — Mocked retrieval of knowledge by type (MOCK)
    3. RANKING tests          — Relevance ordering, top-K limits (MOCK)
    4. RESULT COUNT tests     — 0, 1, 3, 5 result scenarios (MOCK)
    5. NO-RESULT tests        — Empty/safe results, no fabrication (MOCK)
    6. INPUT VALIDATION tests — Empty, whitespace, long, unicode, emoji, special chars
    7. FAILURE HANDLING tests  — Vector DB, embedding, metadata failures (MOCK)
    8. API tests              — Endpoint requests and responses (MOCK)
    9. REAL RAG tests         — Against actual ChromaDB knowledge base (REAL)

Each test is clearly marked as MOCK or REAL in its docstring.
"""

import os
import sys
import pytest
from unittest.mock import patch, MagicMock
from pydantic import ValidationError

# Ensure project root is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.schemas.knowledge import (
    KnowledgeRecommendation,
    KnowledgeRecommendationRequest,
    KnowledgeRecommendationResult,
)
from app.services.knowledge_recommendation_service import (
    _distance_to_relevance,
    _get_relevance_threshold,
    get_knowledge_recommendations,
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

SAMPLE_POLICY_ITEM_2 = (
    "doc_2_v1_p2_c1",
    "Refunds are processed within 5-7 business days after approval.",
    {"document_id": 2, "document_name": "Refund Policy", "document_type": "policy",
     "version": 1, "page_number": 2, "uploaded_by": "admin"},
    0.45,
)

SAMPLE_FAQ_ITEM_2 = (
    "doc_5_v1_p2_c1",
    "Delivery typically takes 3-5 business days for standard shipping.",
    {"document_id": 5, "document_name": "Customer Support FAQ", "document_type": "faq",
     "version": 1, "page_number": 2, "uploaded_by": "admin"},
    0.55,
)

SAMPLE_POLICY_ITEM_3 = (
    "doc_3_v1_p1_c1",
    "Payment failures may occur due to insufficient funds or card expiration.",
    {"document_id": 3, "document_name": "Payment policy", "document_type": "policy",
     "version": 1, "page_number": 1, "uploaded_by": "admin"},
    0.60,
)


# ===========================================================================
# 1. CONTRACT TESTS (MOCK — no RAG pipeline needed)
# ===========================================================================

class TestKnowledgeContracts:
    """Schema validation, serialization, and field constraint tests. [MOCK]"""

    def test_valid_recommendation_model(self):
        """MOCK: Valid KnowledgeRecommendation can be created with all fields."""
        rec = KnowledgeRecommendation(
            title="Refund Policy",
            content="Refunds are processed within 5-7 days.",
            source="chunk:doc_1_v1_p1_c1 | document:Refund Policy | v1 | p1",
            document_type="policy",
            relevance_score=0.85,
        )
        assert rec.title == "Refund Policy"
        assert rec.relevance_score == 0.85
        assert rec.document_type == "policy"

    def test_valid_result_with_recommendations(self):
        """MOCK: Valid KnowledgeRecommendationResult with a list of recommendations."""
        rec = KnowledgeRecommendation(
            title="FAQ", content="Answer.", source="src", document_type="faq", relevance_score=0.9
        )
        result = KnowledgeRecommendationResult(
            query="test", recommendations=[rec], no_relevant_information=False
        )
        assert len(result.recommendations) == 1
        assert result.no_relevant_information is False

    def test_valid_result_empty_recommendations(self):
        """MOCK: Valid result with empty recommendations and no_relevant flag."""
        result = KnowledgeRecommendationResult(
            query="unknown topic", recommendations=[], no_relevant_information=True
        )
        assert result.recommendations == []
        assert result.no_relevant_information is True

    def test_serialization_roundtrip(self):
        """MOCK: Model serializes to dict and deserializes back correctly."""
        rec = KnowledgeRecommendation(
            title="Policy", content="Content.", source="s", document_type="policy", relevance_score=0.75
        )
        result = KnowledgeRecommendationResult(
            query="q", recommendations=[rec], no_relevant_information=False
        )
        data = result.model_dump()
        restored = KnowledgeRecommendationResult(**data)
        assert restored.query == result.query
        assert len(restored.recommendations) == 1
        assert restored.recommendations[0].relevance_score == 0.75

    def test_invalid_relevance_score_above_1(self):
        """MOCK: Relevance score > 1.0 is rejected by Pydantic validation."""
        with pytest.raises(ValidationError):
            KnowledgeRecommendation(
                title="T", content="C", source="S", document_type="faq", relevance_score=1.5
            )

    def test_invalid_relevance_score_below_0(self):
        """MOCK: Relevance score < 0.0 is rejected by Pydantic validation."""
        with pytest.raises(ValidationError):
            KnowledgeRecommendation(
                title="T", content="C", source="S", document_type="faq", relevance_score=-0.1
            )

    def test_missing_required_title(self):
        """MOCK: Missing required 'title' raises ValidationError."""
        with pytest.raises(ValidationError):
            KnowledgeRecommendation(
                content="C", source="S", document_type="faq", relevance_score=0.5
            )

    def test_missing_required_content(self):
        """MOCK: Missing required 'content' raises ValidationError."""
        with pytest.raises(ValidationError):
            KnowledgeRecommendation(
                title="T", source="S", document_type="faq", relevance_score=0.5
            )

    def test_request_validation_empty_query(self):
        """MOCK: Empty query string is rejected."""
        with pytest.raises(ValidationError):
            KnowledgeRecommendationRequest(query="")

    def test_request_validation_whitespace_query(self):
        """MOCK: Whitespace-only query is rejected."""
        with pytest.raises(ValidationError):
            KnowledgeRecommendationRequest(query="   \t\n  ")


# ===========================================================================
# 2. RETRIEVAL TESTS (MOCK — mocked ChromaDB)
# ===========================================================================

class TestKnowledgeRetrieval:
    """Retrieval tests using mocked embedding and vector services. [MOCK]"""

    def _mock_retrieval(self, items, query="test query"):
        """Helper to run get_knowledge_recommendations with mocked RAG components."""
        mock_embedding = [0.1] * 384
        chroma_results = _build_chroma_results(items)
        active_ids = {item[2]["document_id"] for item in items}

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
            return_value=query.lower(),
        ):
            return get_knowledge_recommendations(query)

    def test_faq_retrieval(self):
        """MOCK: FAQ documents are retrieved and typed correctly."""
        result = self._mock_retrieval([SAMPLE_FAQ_ITEM])
        assert len(result.recommendations) == 1
        assert result.recommendations[0].document_type == "faq"
        assert result.no_relevant_information is False

    def test_policy_retrieval(self):
        """MOCK: Policy documents are retrieved and typed correctly."""
        result = self._mock_retrieval([SAMPLE_POLICY_ITEM])
        assert len(result.recommendations) == 1
        assert result.recommendations[0].document_type == "policy"

    def test_mixed_document_types(self):
        """MOCK: Mixed FAQ and policy types are retrieved and typed correctly."""
        result = self._mock_retrieval([SAMPLE_FAQ_ITEM, SAMPLE_POLICY_ITEM])
        types = {r.document_type for r in result.recommendations}
        assert "faq" in types
        assert "policy" in types

    def test_source_information_preserved(self):
        """MOCK: Source/reference information is included in each recommendation."""
        result = self._mock_retrieval([SAMPLE_FAQ_ITEM])
        rec = result.recommendations[0]
        assert rec.source  # not empty
        assert "doc_5_v1_p1_c1" in rec.source  # chunk ID is present
        assert "Customer Support FAQ" in rec.source  # document name is present


# ===========================================================================
# 3. RANKING TESTS (MOCK)
# ===========================================================================

class TestKnowledgeRanking:
    """Relevance ranking and ordering tests. [MOCK]"""

    def test_results_sorted_descending_relevance(self):
        """MOCK: Results are returned sorted by descending relevance score."""
        items = [SAMPLE_FAQ_ITEM, SAMPLE_POLICY_ITEM_2, SAMPLE_POLICY_ITEM]
        mock_embedding = [0.1] * 384
        chroma_results = _build_chroma_results(items)
        active_ids = {item[2]["document_id"] for item in items}

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
            return_value="test",
        ):
            result = get_knowledge_recommendations("test")

        scores = [r.relevance_score for r in result.recommendations]
        assert scores == sorted(scores, reverse=True)

    def test_highest_ranked_first(self):
        """MOCK: Highest relevance document appears first in results."""
        # SAMPLE_FAQ_ITEM has distance 0.35 → highest relevance
        items = [SAMPLE_POLICY_ITEM, SAMPLE_FAQ_ITEM, SAMPLE_POLICY_ITEM_2]
        mock_embedding = [0.1] * 384
        chroma_results = _build_chroma_results(items)
        active_ids = {item[2]["document_id"] for item in items}

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
            return_value="test",
        ):
            result = get_knowledge_recommendations("test")

        assert result.recommendations[0].title == "Customer Support FAQ"

    def test_top_k_limit_enforced(self):
        """MOCK: Maximum 5 recommendations returned even with more candidates."""
        # Create 7 items
        items = []
        for i in range(7):
            items.append((
                f"doc_{i}_v1_p1_c1",
                f"Content chunk {i}.",
                {"document_id": i, "document_name": f"Doc {i}",
                 "document_type": "policy", "version": 1, "page_number": 1,
                 "uploaded_by": "admin"},
                0.3 + (i * 0.05),  # distances from 0.3 to 0.6
            ))
        mock_embedding = [0.1] * 384
        chroma_results = _build_chroma_results(items)
        active_ids = {item[2]["document_id"] for item in items}

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
            return_value="test",
        ):
            result = get_knowledge_recommendations("test")

        assert len(result.recommendations) <= MAX_RECOMMENDATIONS


# ===========================================================================
# 4. RESULT COUNT TESTS (MOCK)
# ===========================================================================

class TestResultCounts:
    """Tests for varying numbers of relevant results. [MOCK]"""

    def _run_with_n_items(self, n, base_distance=0.3):
        """Helper: create n items and retrieve recommendations."""
        items = []
        for i in range(n):
            items.append((
                f"doc_{i + 10}_v1_p1_c1",
                f"Knowledge content {i}.",
                {"document_id": i + 10, "document_name": f"Document {i}",
                 "document_type": "faq" if i % 2 == 0 else "policy",
                 "version": 1, "page_number": 1, "uploaded_by": "admin"},
                base_distance + (i * 0.05),
            ))
        mock_embedding = [0.1] * 384
        chroma_results = _build_chroma_results(items)
        active_ids = {item[2]["document_id"] for item in items}

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
            return_value="test",
        ):
            return get_knowledge_recommendations("test")

    def test_5_relevant_results(self):
        """MOCK: When 5 relevant documents exist, return exactly 5."""
        result = self._run_with_n_items(5)
        assert len(result.recommendations) == 5
        assert result.no_relevant_information is False

    def test_3_relevant_results(self):
        """MOCK: When 3 relevant documents exist, return exactly 3."""
        result = self._run_with_n_items(3)
        assert len(result.recommendations) == 3
        assert result.no_relevant_information is False

    def test_1_relevant_result(self):
        """MOCK: When 1 relevant document exists, return exactly 1."""
        result = self._run_with_n_items(1)
        assert len(result.recommendations) == 1
        assert result.no_relevant_information is False

    def test_0_relevant_results(self):
        """MOCK: When no relevant documents exist, return empty list with flag."""
        # Use very high distances so all fail threshold
        result = self._run_with_n_items(3, base_distance=50.0)
        assert len(result.recommendations) == 0
        assert result.no_relevant_information is True


# ===========================================================================
# 5. NO-RESULT HANDLING TESTS (MOCK)
# ===========================================================================

class TestNoResultHandling:
    """Tests for safe no-result behavior. [MOCK]"""

    def test_no_result_safe_empty_response(self):
        """MOCK: No results returns safe empty response with flag."""
        mock_embedding = [0.1] * 384
        chroma_results = _build_chroma_results([])

        with patch(
            "app.services.knowledge_recommendation_service.generate_embedding",
            return_value=mock_embedding,
        ), patch(
            "app.services.knowledge_recommendation_service.search_documents",
            return_value=chroma_results,
        ), patch(
            "app.services.knowledge_recommendation_service.get_latest_active_document_ids",
            return_value={1, 2, 3},
        ), patch(
            "app.services.knowledge_recommendation_service.normalize_question",
            return_value="xyz",
        ):
            result = get_knowledge_recommendations("xyz totally unrelated")

        assert result.recommendations == []
        assert result.no_relevant_information is True
        assert result.query == "xyz totally unrelated"

    def test_no_fabricated_sources_in_empty_result(self):
        """MOCK: Empty result contains no fabricated sources or documents."""
        mock_embedding = [0.1] * 384
        chroma_results = _build_chroma_results([])

        with patch(
            "app.services.knowledge_recommendation_service.generate_embedding",
            return_value=mock_embedding,
        ), patch(
            "app.services.knowledge_recommendation_service.search_documents",
            return_value=chroma_results,
        ), patch(
            "app.services.knowledge_recommendation_service.get_latest_active_document_ids",
            return_value={1, 2, 3},
        ), patch(
            "app.services.knowledge_recommendation_service.normalize_question",
            return_value="nothing",
        ):
            result = get_knowledge_recommendations("nothing here")

        for rec in result.recommendations:
            pytest.fail(f"Unexpected fabricated recommendation: {rec.title}")


# ===========================================================================
# 6. INPUT VALIDATION TESTS
# ===========================================================================

class TestInputValidation:
    """Tests for input validation on the service layer. [MOCK]"""

    def test_empty_query_raises_error(self):
        """MOCK: Empty string query raises ValueError."""
        with pytest.raises(ValueError, match="empty"):
            get_knowledge_recommendations("")

    def test_whitespace_query_raises_error(self):
        """MOCK: Whitespace-only query raises ValueError."""
        with pytest.raises(ValueError, match="empty"):
            get_knowledge_recommendations("   \t\n  ")

    def test_long_query_handled(self):
        """MOCK: Very long query is handled without crashing."""
        long_query = "payment issue " * 500
        mock_embedding = [0.1] * 384
        chroma_results = _build_chroma_results([SAMPLE_FAQ_ITEM])
        active_ids = {SAMPLE_FAQ_ITEM[2]["document_id"]}

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
            return_value="payment issue",
        ):
            result = get_knowledge_recommendations(long_query)
        assert isinstance(result, KnowledgeRecommendationResult)

    def test_unicode_query_handled(self):
        """MOCK: Unicode characters in query handled safely."""
        unicode_query = "Ik wil graag een terugbetaling für meine Bestellung 返金"
        mock_embedding = [0.1] * 384
        chroma_results = _build_chroma_results([SAMPLE_FAQ_ITEM])
        active_ids = {SAMPLE_FAQ_ITEM[2]["document_id"]}

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
            return_value="terugbetaling bestellung",
        ):
            result = get_knowledge_recommendations(unicode_query)
        assert isinstance(result, KnowledgeRecommendationResult)

    def test_emoji_query_handled(self):
        """MOCK: Emoji in query handled without crash."""
        emoji_query = "😡 I want my money back! 💰"
        mock_embedding = [0.1] * 384
        chroma_results = _build_chroma_results([SAMPLE_FAQ_ITEM])
        active_ids = {SAMPLE_FAQ_ITEM[2]["document_id"]}

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
            return_value="i want my money back",
        ):
            result = get_knowledge_recommendations(emoji_query)
        assert isinstance(result, KnowledgeRecommendationResult)

    def test_special_characters_handled(self):
        """MOCK: SQL-like and JSON-like text handled safely."""
        dangerous_query = "'; DROP TABLE documents; -- {\"exploit\": true}"
        mock_embedding = [0.1] * 384
        chroma_results = _build_chroma_results([])

        with patch(
            "app.services.knowledge_recommendation_service.generate_embedding",
            return_value=mock_embedding,
        ), patch(
            "app.services.knowledge_recommendation_service.search_documents",
            return_value=chroma_results,
        ), patch(
            "app.services.knowledge_recommendation_service.get_latest_active_document_ids",
            return_value={1},
        ), patch(
            "app.services.knowledge_recommendation_service.normalize_question",
            return_value="drop table documents exploit true",
        ):
            result = get_knowledge_recommendations(dangerous_query)
        assert isinstance(result, KnowledgeRecommendationResult)


# ===========================================================================
# 7. FAILURE HANDLING TESTS (MOCK)
# ===========================================================================

class TestFailureHandling:
    """Tests for graceful failure handling. [MOCK]"""

    def test_vector_db_failure(self):
        """MOCK: Vector database failure raises RuntimeError with safe message."""
        with patch(
            "app.services.knowledge_recommendation_service.generate_embedding",
            return_value=[0.1] * 384,
        ), patch(
            "app.services.knowledge_recommendation_service.search_documents",
            side_effect=Exception("ChromaDB connection refused"),
        ), patch(
            "app.services.knowledge_recommendation_service.get_latest_active_document_ids",
            return_value={1},
        ), patch(
            "app.services.knowledge_recommendation_service.normalize_question",
            return_value="test",
        ):
            with pytest.raises(RuntimeError, match="vector database"):
                get_knowledge_recommendations("test query")

    def test_embedding_failure(self):
        """MOCK: Embedding generation failure raises RuntimeError."""
        with patch(
            "app.services.knowledge_recommendation_service.generate_embedding",
            side_effect=Exception("Model load failed"),
        ), patch(
            "app.services.knowledge_recommendation_service.normalize_question",
            return_value="test",
        ):
            with pytest.raises(RuntimeError, match="embedding"):
                get_knowledge_recommendations("test query")

    def test_malformed_metadata_handled(self):
        """MOCK: Documents with malformed/missing metadata are skipped gracefully."""
        items = [
            (
                "doc_bad_v1_p1_c1",
                "Some content here.",
                {"document_id": "not_a_number", "document_name": "Bad Doc",
                 "document_type": "policy", "version": 1, "page_number": 1,
                 "uploaded_by": "admin"},
                0.4,
            ),
            SAMPLE_FAQ_ITEM,
        ]
        mock_embedding = [0.1] * 384
        chroma_results = _build_chroma_results(items)
        # Only the FAQ item is in active set
        active_ids = {SAMPLE_FAQ_ITEM[2]["document_id"]}

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
            return_value="test",
        ):
            result = get_knowledge_recommendations("test query")

        # Bad metadata item is skipped; only the valid FAQ item is returned
        assert len(result.recommendations) == 1
        assert result.recommendations[0].document_type == "faq"


# ===========================================================================
# 8. API TESTS (MOCK — using FastAPI TestClient)
# ===========================================================================

class TestKnowledgeAPI:
    """API endpoint tests using FastAPI TestClient. [MOCK]"""

    @pytest.fixture
    def client(self):
        from fastapi.testclient import TestClient
        from app.main import app
        return TestClient(app)

    def test_valid_request_returns_200(self, client):
        """MOCK: Valid POST /knowledge/recommend returns 200 with expected shape."""
        mock_embedding = [0.1] * 384
        chroma_results = _build_chroma_results([SAMPLE_FAQ_ITEM])
        active_ids = {SAMPLE_FAQ_ITEM[2]["document_id"]}

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
            return_value="refund",
        ):
            response = client.post(
                "/knowledge/recommend",
                json={"query": "How do I get a refund?"},
            )

        assert response.status_code == 200
        data = response.json()
        assert "query" in data
        assert "recommendations" in data
        assert "no_relevant_information" in data
        assert isinstance(data["recommendations"], list)

    def test_empty_query_returns_422(self, client):
        """MOCK: Empty query returns 422 validation error."""
        response = client.post(
            "/knowledge/recommend",
            json={"query": ""},
        )
        assert response.status_code == 422

    def test_no_result_response(self, client):
        """MOCK: Query with no results returns 200 with empty list and flag."""
        mock_embedding = [0.1] * 384
        chroma_results = _build_chroma_results([])

        with patch(
            "app.services.knowledge_recommendation_service.generate_embedding",
            return_value=mock_embedding,
        ), patch(
            "app.services.knowledge_recommendation_service.search_documents",
            return_value=chroma_results,
        ), patch(
            "app.services.knowledge_recommendation_service.get_latest_active_document_ids",
            return_value={1},
        ), patch(
            "app.services.knowledge_recommendation_service.normalize_question",
            return_value="quantum physics",
        ):
            response = client.post(
                "/knowledge/recommend",
                json={"query": "Tell me about quantum physics"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["recommendations"] == []
        assert data["no_relevant_information"] is True

    def test_openapi_schema_includes_endpoint(self, client):
        """MOCK: OpenAPI schema includes /knowledge/recommend endpoint."""
        response = client.get("/openapi.json")
        assert response.status_code == 200
        schema = response.json()
        paths = schema.get("paths", {})
        assert "/knowledge/recommend" in paths
        assert "post" in paths["/knowledge/recommend"]


# ===========================================================================
# 9. REAL RAG TESTS — Against actual ChromaDB knowledge base
# ===========================================================================

class TestRealRAGRetrieval:
    """Tests using the ACTUAL local ChromaDB knowledge base. [REAL]

    These tests verify that the Knowledge Recommendation Agent is genuinely
    connected to the existing RAG system with real embeddings and real
    vector search.

    Skipped if the ChromaDB database is unavailable.
    """

    @pytest.fixture(autouse=True)
    def check_chromadb_available(self):
        """Skip all tests in this class if ChromaDB is unavailable."""
        chroma_path = os.path.join(
            os.path.dirname(__file__), "..", "data", "chroma_db"
        )
        if not os.path.exists(chroma_path):
            pytest.skip("ChromaDB data directory not found — skipping REAL RAG tests")

        # Verify collection has data
        try:
            import chromadb
            client = chromadb.PersistentClient(path=chroma_path)
            coll = client.get_or_create_collection("support_knowledge_base")
            if coll.count() == 0:
                pytest.skip("ChromaDB collection is empty — skipping REAL RAG tests")
        except Exception as e:
            pytest.skip(f"ChromaDB unavailable: {e}")

    def test_real_retrieval_refund_query(self):
        """REAL: Retrieve knowledge for 'refund request' from actual ChromaDB."""
        result = get_knowledge_recommendations("I want a refund for my order")

        assert isinstance(result, KnowledgeRecommendationResult)
        assert result.query == "I want a refund for my order"
        assert result.no_relevant_information is False
        assert len(result.recommendations) >= 1

        rec = result.recommendations[0]
        assert rec.title
        assert rec.content
        assert rec.source
        assert rec.document_type in ["faq", "policy"]
        assert 0.0 <= rec.relevance_score <= 1.0
        scores = [r.relevance_score for r in result.recommendations]
        assert scores == sorted(scores, reverse=True)

    def test_real_retrieval_payment_query(self):
        """REAL: Retrieve knowledge for 'payment failure' from actual ChromaDB."""
        result = get_knowledge_recommendations("My payment failed and I was still charged")

        assert isinstance(result, KnowledgeRecommendationResult)
        assert result.no_relevant_information is False
        assert len(result.recommendations) >= 1
        for rec in result.recommendations:
            assert rec.title
            assert rec.content
            assert rec.source
            assert 0.0 <= rec.relevance_score <= 1.0

    def test_real_retrieval_irrelevant_query_returns_no_relevant(self):
        """REAL: Completely irrelevant query safely returns empty list with no_relevant flag."""
        result = get_knowledge_recommendations("What is the mass of Jupiter in kilograms?")

        assert isinstance(result, KnowledgeRecommendationResult)
        assert result.no_relevant_information is True
        assert len(result.recommendations) == 0


# ===========================================================================
# 10. UTILITY FUNCTION TESTS
# ===========================================================================

class TestUtilityFunctions:
    """Unit tests for internal helper functions. [MOCK]"""

    def test_distance_to_relevance_zero(self):
        """MOCK: Distance 0 → relevance 1.0."""
        assert _distance_to_relevance(0.0) == 1.0

    def test_distance_to_relevance_one(self):
        """MOCK: Distance 1.0 → relevance 0.5."""
        assert _distance_to_relevance(1.0) == 0.5

    def test_distance_to_relevance_large(self):
        """MOCK: Large distance → relevance approaching 0."""
        assert _distance_to_relevance(100.0) < 0.02

    def test_distance_to_relevance_negative(self):
        """MOCK: Negative distance treated as 0 → relevance 1.0."""
        assert _distance_to_relevance(-5.0) == 1.0

    def test_distance_to_relevance_invalid(self):
        """MOCK: Invalid distance type returns 0.0."""
        assert _distance_to_relevance("not_a_number") == 0.0

    def test_get_relevance_threshold_default(self):
        """MOCK: Default threshold is returned when env var is not set."""
        with patch.dict(os.environ, {}, clear=False):
            # Remove the env var if it exists
            os.environ.pop("KNOWLEDGE_RELEVANCE_THRESHOLD", None)
            assert _get_relevance_threshold() == DEFAULT_RELEVANCE_THRESHOLD

    def test_get_relevance_threshold_custom(self):
        """MOCK: Custom threshold from environment variable."""
        with patch.dict(os.environ, {"KNOWLEDGE_RELEVANCE_THRESHOLD": "0.5"}):
            assert _get_relevance_threshold() == 0.5

    def test_get_relevance_threshold_invalid_falls_back(self):
        """MOCK: Invalid env var value falls back to default."""
        with patch.dict(os.environ, {"KNOWLEDGE_RELEVANCE_THRESHOLD": "abc"}):
            assert _get_relevance_threshold() == DEFAULT_RELEVANCE_THRESHOLD
