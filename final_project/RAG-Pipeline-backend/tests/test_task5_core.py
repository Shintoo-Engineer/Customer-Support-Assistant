"""
Task 5 — 5 Core Test Cases for Knowledge Recommendation Agent
=============================================================
These 5 tests verify the key capabilities of Task 5:

  TC1: Basic Retrieval — A refund query retrieves relevant refund policy docs
  TC2: Context-Aware Multi-Turn — A vague follow-up retrieves correctly using prior context
  TC3: Out-of-Domain Safe Rejection — An irrelevant query returns zero recommendations
  TC4: Intent-Guided Ranking — Task 4 intent signal boosts relevant domain docs
  TC5: Source Attribution & Deduplication — Every recommendation has a valid source, no duplicates

Run with:
    python -m pytest tests/test_task5_core.py -v
"""

import sys
import os
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.knowledge_recommendation_service import (
    get_knowledge_recommendations,
    build_contextual_query,
)
from app.schemas.knowledge import KnowledgeRecommendationResult, KnowledgeRecommendation


# ──────────────────────────────────────────────────────────────────────
# TC1: Basic Retrieval — Refund Query
# ──────────────────────────────────────────────────────────────────────
class TestTC1_BasicRetrieval:
    """A clear refund-related customer query should retrieve 3-5 relevant
    recommendations from the knowledge base, each containing refund/policy
    content with a relevance score above the 0.38 threshold."""

    def test_refund_query_returns_recommendations(self):
        result = get_knowledge_recommendations(
            query="I want a refund for my order, it has been 5 days since purchase"
        )

        # Must return a KnowledgeRecommendationResult
        assert isinstance(result, KnowledgeRecommendationResult)

        # Must have between 3 and 5 recommendations
        assert 3 <= len(result.recommendations) <= 5, (
            f"Expected 3-5 recommendations, got {len(result.recommendations)}"
        )

        # Must NOT flag as no_relevant_information
        assert result.no_relevant_information is False

        # Each recommendation must be a valid KnowledgeRecommendation
        for rec in result.recommendations:
            assert isinstance(rec, KnowledgeRecommendation)
            assert rec.relevance_score >= 0.38, (
                f"Relevance score {rec.relevance_score} below threshold"
            )
            assert len(rec.title) > 0
            assert len(rec.content) > 0
            assert len(rec.source) > 0

        # At least one recommendation should contain refund-related content
        refund_found = any(
            "refund" in rec.content.lower() or "refund" in rec.title.lower()
            for rec in result.recommendations
        )
        assert refund_found, "No refund-related content found in recommendations"


# ──────────────────────────────────────────────────────────────────────
# TC2: Context-Aware Multi-Turn Retrieval
# ──────────────────────────────────────────────────────────────────────
class TestTC2_ContextAwareRetrieval:
    """A vague follow-up message like 'How long does that take?' should use
    conversation history to build a context-enriched query and still
    retrieve relevant recommendations."""

    def test_vague_followup_uses_conversation_context(self):
        # Simulate a 2-turn conversation
        history = [
            {"sender_type": "Customer", "message_text": "I want a refund for order #ORD-12345"},
            {"sender_type": "Support Agent", "message_text": "Sure, I can help with your refund request."},
        ]

        result = get_knowledge_recommendations(
            query="How long does that take?",
            conversation_history=history,
        )

        # Must return recommendations (the vague query alone would be poor,
        # but with context it should resolve to refund processing time)
        assert isinstance(result, KnowledgeRecommendationResult)
        assert len(result.recommendations) >= 1, (
            "Context-aware retrieval should return at least 1 recommendation"
        )
        assert result.no_relevant_information is False

        # The contextual query should contain tokens from the history
        assert result.contextual_query is not None
        contextual_lower = result.contextual_query.lower()
        assert any(
            token in contextual_lower
            for token in ["refund", "order", "12345"]
        ), (
            f"Contextual query '{result.contextual_query}' should include "
            "history tokens like 'refund' or 'order'"
        )

    def test_build_contextual_query_merges_history(self):
        """Unit test for the query builder: ensures referential pronouns
        trigger context merging."""
        history = [
            {"sender_type": "Customer", "message_text": "My payment failed at checkout"},
        ]

        query = build_contextual_query(
            current_query="Why did it fail?",
            dialogue_history=history,
            intent="payment_issue",
        )

        # Should contain tokens from the previous turn
        query_lower = query.lower()
        assert "payment" in query_lower or "checkout" in query_lower, (
            f"Contextual query '{query}' should include history context"
        )


# ──────────────────────────────────────────────────────────────────────
# TC3: Out-of-Domain Safe Rejection
# ──────────────────────────────────────────────────────────────────────
class TestTC3_OutOfDomainRejection:
    """Queries completely unrelated to customer support (e.g., astrophysics,
    cooking) should return zero recommendations with no_relevant_information=True."""

    def test_astrophysics_query_rejected(self):
        result = get_knowledge_recommendations(
            query="How do gravitational waves propagate through curved spacetime?"
        )

        assert isinstance(result, KnowledgeRecommendationResult)
        assert result.no_relevant_information is True, (
            "Astrophysics query should be flagged as no_relevant_information"
        )
        assert len(result.recommendations) == 0, (
            f"Expected 0 recommendations for OOD query, got {len(result.recommendations)}"
        )

    def test_cooking_query_rejected(self):
        result = get_knowledge_recommendations(
            query="What is the best temperature to bake sourdough bread?"
        )

        assert isinstance(result, KnowledgeRecommendationResult)
        assert result.no_relevant_information is True, (
            "Cooking query should be flagged as no_relevant_information"
        )
        assert len(result.recommendations) == 0, (
            f"Expected 0 recommendations for OOD query, got {len(result.recommendations)}"
        )


# ──────────────────────────────────────────────────────────────────────
# TC4: Intent-Guided Ranking
# ──────────────────────────────────────────────────────────────────────
class TestTC4_IntentGuidedRanking:
    """When Task 4 analysis provides an intent signal (e.g., 'account_issue'),
    the retrieval should boost documents matching that domain. We compare
    results with and without intent to verify the boost effect."""

    def test_intent_boosts_relevant_domain(self):
        query = "I cannot log in to my account"

        # Without intent
        result_no_intent = get_knowledge_recommendations(query=query)

        # With explicit account_issue intent
        result_with_intent = get_knowledge_recommendations(
            query=query,
            analysis={"intent": "account_issue"},
        )

        assert len(result_no_intent.recommendations) >= 1
        assert len(result_with_intent.recommendations) >= 1

        # Both should return login/account content
        top_with_intent = result_with_intent.recommendations[0]
        assert any(
            kw in top_with_intent.content.lower()
            for kw in ["login", "log in", "password", "account", "reset"]
        ), "Top recommendation with intent should contain login/account content"

        # The intent-boosted result should have equal or higher relevance
        # for the top result (due to the +0.02 bounded boost)
        score_no_intent = result_no_intent.recommendations[0].relevance_score
        score_with_intent = result_with_intent.recommendations[0].relevance_score
        assert score_with_intent >= score_no_intent, (
            f"Intent boost should not decrease top relevance: "
            f"without={score_no_intent}, with={score_with_intent}"
        )


# ──────────────────────────────────────────────────────────────────────
# TC5: Source Attribution & Deduplication
# ──────────────────────────────────────────────────────────────────────
class TestTC5_SourceAttributionAndDeduplication:
    """Every recommendation must have a valid, non-empty source string
    following the format 'chunk:... | document:...'. No two recommendations
    in the same result should share the same chunk ID."""

    def test_all_sources_valid_and_unique(self):
        result = get_knowledge_recommendations(
            query="How do I cancel my subscription?"
        )

        assert len(result.recommendations) >= 3, (
            f"Expected at least 3 recommendations, got {len(result.recommendations)}"
        )

        seen_chunk_ids = set()
        for rec in result.recommendations:
            # Source must be non-empty
            assert rec.source, f"Recommendation '{rec.title}' has empty source"

            # Source should contain 'chunk:' and 'document:'
            assert "chunk:" in rec.source, (
                f"Source '{rec.source}' missing chunk ID"
            )
            assert "document:" in rec.source, (
                f"Source '{rec.source}' missing document reference"
            )

            # Document type must be non-empty
            assert rec.document_type, (
                f"Recommendation '{rec.title}' has empty document_type"
            )

            # Extract chunk ID and check for duplicates
            chunk_id = rec.source.split(" | ")[0]  # e.g., "chunk:doc_27_v1_p2_c1"
            assert chunk_id not in seen_chunk_ids, (
                f"Duplicate chunk ID found: {chunk_id}"
            )
            seen_chunk_ids.add(chunk_id)

    def test_no_fabricated_sources(self):
        """Sources should reference real documents in the knowledge base,
        not contain URLs, placeholder text, or 'fabricated' markers."""
        result = get_knowledge_recommendations(
            query="I want to return a defective product"
        )

        for rec in result.recommendations:
            source_lower = rec.source.lower()
            assert "http" not in source_lower, (
                f"Source should not contain URLs: {rec.source}"
            )
            assert "fabricated" not in source_lower, (
                f"Source contains 'fabricated' marker: {rec.source}"
            )
            assert "placeholder" not in source_lower, (
                f"Source contains 'placeholder' marker: {rec.source}"
            )
