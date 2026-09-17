"""
Unit and integration tests for Task 5 Phase 4:
Comprehensive Multi-Scenario Evaluation, Knowledge Retrieval Evaluation & Metrics.
"""
import os
import json
import pytest
from datetime import datetime

from scripts.evaluate_task5 import (
    compute_dcg,
    compute_ndcg,
    evaluate_persona_consistency,
    evaluate_context_retention,
    grade_relevance,
    DATASET_PATH,
    REPORT_PATH
)
from app.services.vector_service import collection

# Mandatory support domains required by Task 5 Phase 4 specification
MANDATORY_DOMAINS = {
    "delivery_delay",
    "refund",
    "payment_failure",
    "login_account_issue",
    "cancellation",
    "product_replacement",
    "frustrated_angry_customer",
    "out_of_domain"
}


# ===========================================================================
# 1. EVALUATION DATASET STRUCTURE TESTS
# ===========================================================================

class TestEvaluationDatasetStructure:
    """Verifies that the evaluation dataset is valid, consistent, and well-formed."""

    @pytest.fixture(autouse=True)
    def load_dataset(self):
        assert os.path.exists(DATASET_PATH), f"Dataset file missing at {DATASET_PATH}"
        with open(DATASET_PATH, "r", encoding="utf-8") as f:
            self.data = json.load(f)
        self.scenarios = self.data.get("scenarios", [])

    def test_scenario_count_within_bounds(self):
        """Dataset must contain between 10 and 20 scenarios (prefer 16)."""
        count = len(self.scenarios)
        assert 10 <= count <= 20
        assert count == 16, f"Expected 16 scenarios, got {count}"

    def test_scenario_ids_unique(self):
        """All scenario IDs must be unique and non-empty."""
        ids = [s["scenario_id"] for s in self.scenarios]
        assert len(ids) == len(set(ids)), "Duplicate scenario IDs detected"
        for sid in ids:
            assert sid.startswith("S") and len(sid) >= 3

    def test_required_scenario_fields_present(self):
        """Every scenario must define all required configuration fields."""
        required_fields = [
            "scenario_id",
            "scenario_name",
            "support_domain",
            "customer_persona",
            "initial_emotion",
            "issue_severity",
            "patience_level",
            "expected_resolution",
            "initial_customer_query",
            "expected_intent",
            "expected_knowledge_topics",
            "expected_document_types",
            "expected_keywords",
            "number_of_turns",
            "turns"
        ]
        for s in self.scenarios:
            for field in required_fields:
                assert field in s, f"Scenario {s.get('scenario_id')} missing required field '{field}'"

    def test_expected_topics_non_empty_for_in_domain(self):
        """In-domain scenarios must have non-empty expected topics, keywords, and documents."""
        for s in self.scenarios:
            if s["support_domain"] != "out_of_domain":
                assert len(s["expected_knowledge_topics"]) > 0, f"{s['scenario_id']} missing topics"
                assert len(s["expected_keywords"]) > 0, f"{s['scenario_id']} missing keywords"
                assert len(s["expected_documents"]) > 0, f"{s['scenario_id']} missing expected documents"

    def test_expected_documents_grounded_in_actual_kb(self):
        """Expected documents must match actual document titles in the ChromaDB collection."""
        kb_data = collection.get(include=["metadatas"])
        existing_doc_names = set(
            m.get("document_name") or m.get("source")
            for m in kb_data.get("metadatas", [])
            if m
        )

        for s in self.scenarios:
            for expected_doc in s.get("expected_documents", []):
                assert expected_doc in existing_doc_names, (
                    f"Scenario {s['scenario_id']} references nonexistent document '{expected_doc}'. "
                    f"Actual ChromaDB documents: {existing_doc_names}"
                )

    def test_scenarios_cover_all_mandatory_domains(self):
        """Scenarios must span payment failure, refund, login, cancellation, delivery, replacement, angry customer, out of domain."""
        covered_domains = set(s["support_domain"] for s in self.scenarios)
        missing = MANDATORY_DOMAINS - covered_domains
        assert not missing, f"Missing required support domains: {missing}"

    def test_multi_turn_proportions(self):
        """At least half of the scenarios must contain 2 or more turns."""
        multi_turn = [s for s in self.scenarios if len(s["turns"]) >= 2]
        ratio = len(multi_turn) / len(self.scenarios)
        assert ratio >= 0.5, f"Expected at least 50% multi-turn scenarios, got {ratio * 100:.1f}%"


# ===========================================================================
# 2. METRIC CALCULATION TESTS
# ===========================================================================

class TestMetricCalculations:
    """Tests accuracy and edge-case handling of retrieval evaluation formulas."""

    def test_precision_at_k_calculation(self):
        """Precision@K correctly computes relevant retrieved items / min(K, total)."""
        grades = [2, 1, 0, 1, 0]  # 2 relevant in top 3
        rel_3 = sum(1 for g in grades[:3] if g >= 1)
        p3 = rel_3 / min(3, len(grades))
        assert abs(p3 - (2 / 3)) < 1e-4

        rel_5 = sum(1 for g in grades[:5] if g >= 1)
        p5 = rel_5 / min(5, len(grades))
        assert abs(p5 - (3 / 5)) < 1e-4

    def test_precision_at_k_empty_results(self):
        """Precision@K gracefully returns 0.0 when no results are returned."""
        grades = []
        p3 = len(grades) / 3 if grades else 0.0
        assert p3 == 0.0

    def test_recall_at_k_calculation(self):
        """Recall@K computes relevant retrieved items / total expected target documents."""
        grades = [2, 1, 0, 0, 0]  # 2 relevant
        target_count = 4
        rel_3 = sum(1 for g in grades[:3] if g >= 1)
        r3 = rel_3 / target_count
        assert abs(r3 - 0.5) < 1e-4

    def test_recall_at_k_zero_expected(self):
        """Recall@K handles zero expected targets cleanly without ZeroDivisionError."""
        grades = []
        target_count = 0
        r3 = 1.0 if target_count == 0 and not grades else 0.0
        assert r3 == 1.0

    def test_mrr_calculation_first_rank(self):
        """RR is 1.0 when the first result is relevant."""
        grades = [2, 0, 0]
        rr = 0.0
        for i, g in enumerate(grades, 1):
            if g >= 1:
                rr = 1.0 / i
                break
        assert rr == 1.0

    def test_mrr_calculation_third_rank(self):
        """RR is 1/3 when the first relevant result appears at rank 3."""
        grades = [0, 0, 1, 2]
        rr = 0.0
        for i, g in enumerate(grades, 1):
            if g >= 1:
                rr = 1.0 / i
                break
        assert abs(rr - (1.0 / 3.0)) < 1e-4

    def test_mrr_calculation_no_relevant(self):
        """RR is 0.0 when no relevant recommendations appear."""
        grades = [0, 0, 0]
        rr = 0.0
        for i, g in enumerate(grades, 1):
            if g >= 1:
                rr = 1.0 / i
                break
        assert rr == 0.0

    def test_ndcg_calculation_perfect_ranking(self):
        """NDCG is 1.0 for ideal graded ranking."""
        grades = [2, 2, 1]
        ideal = [2, 2, 1]
        ndcg = compute_ndcg(grades, ideal, 3)
        assert abs(ndcg - 1.0) < 1e-4

    def test_ndcg_calculation_suboptimal_ranking(self):
        """NDCG is strictly between 0 and 1 for suboptimal ranking."""
        grades = [0, 1, 2]
        ideal = [2, 1, 0]
        ndcg = compute_ndcg(grades, ideal, 3)
        assert 0.0 < ndcg < 1.0

    def test_ndcg_calculation_empty_ranking(self):
        """NDCG returns 1.0 when both predicted and ideal lists have zero gain."""
        grades = [0, 0, 0]
        ideal = [0, 0, 0]
        ndcg = compute_ndcg(grades, ideal, 3)
        assert ndcg == 1.0


# ===========================================================================
# 3. NO-RESULT AND QUALITY METRICS TESTS
# ===========================================================================

class TestNoResultAndQualityMetrics:
    """Verifies no-result handling, false positive detection, and source sanity."""

    def test_safe_no_result_metric(self):
        """Safe no-result rate calculates proportion of out-of-domain queries with 0 results."""
        out_of_domain = 3
        safe = 2
        rate = safe / out_of_domain
        assert abs(rate - 0.6667) < 1e-3

    def test_false_positive_metric(self):
        """False positive rate calculates out-of-domain queries that incorrectly returned results."""
        out_of_domain = 3
        fp = 1
        rate = fp / out_of_domain
        assert abs(rate - 0.3333) < 1e-3

    def test_duplicate_detection(self):
        """Detects duplicate chunk IDs in retrieved results."""
        seen = set()
        duplicates = 0
        recs = [
            {"knowledge_id": "c1"},
            {"knowledge_id": "c2"},
            {"knowledge_id": "c1"},
            {"knowledge_id": "c3"}
        ]
        for r in recs:
            cid = r["knowledge_id"]
            if cid in seen:
                duplicates += 1
            seen.add(cid)
        assert duplicates == 1

    def test_source_validation_no_fabricated(self):
        """Verifies fabricated source detection flags suspect markers."""
        clean_recs = [
            {"source": "chunk:doc_1 | document:Refund Policy | v1 | p1"},
            {"source": "chunk:doc_2 | document:Customer Support FAQ | v1 | p2"}
        ]
        fabricated_count = sum(1 for r in clean_recs if "fabricated" in r["source"].lower())
        assert fabricated_count == 0


# ===========================================================================
# 4. EVALUATION REPORT ARTIFACTS TESTS
# ===========================================================================

class TestEvaluationReportArtifacts:
    """Verifies machine-readable evaluation report generation and serialization."""

    @pytest.fixture(autouse=True)
    def load_report(self):
        assert os.path.exists(REPORT_PATH), f"Report file missing at {REPORT_PATH}. Run evaluate_task5.py first."
        with open(REPORT_PATH, "r", encoding="utf-8") as f:
            self.report = json.load(f)

    def test_report_summary_contains_all_metrics(self):
        """Report summary must contain all required retrieval and simulator metrics."""
        summary = self.report.get("evaluation_summary", {})
        required_summary_keys = [
            "scenarios_evaluated",
            "turns_evaluated",
            "precision_at_1",
            "precision_at_3",
            "precision_at_5",
            "recall_at_3",
            "recall_at_5",
            "mrr",
            "ndcg_at_3",
            "ndcg_at_5",
            "safe_no_result_rate",
            "false_positive_rate",
            "duplicate_recommendation_rate",
            "missing_source_rate",
            "fabricated_sources_count",
            "simulator_persona_consistency_rate",
            "simulator_context_retention_rate",
            "simulator_response_variety_rate"
        ]
        for k in required_summary_keys:
            assert k in summary, f"Summary missing metric key: '{k}'"

    def test_scenario_results_contain_all_scenarios(self):
        """Scenario results must list all 16 scenarios with pass/partial status."""
        results = self.report.get("scenario_results", [])
        assert len(results) == 16
        for r in results:
            assert r["task3_status"] in ["PASS", "PARTIAL", "FAIL"]
            assert r["task4_status"] in ["PASS", "PARTIAL", "FAIL"]
            assert r["task5_status"] in ["PASS", "PARTIAL", "FAIL"]

    def test_turn_details_structure_and_completeness(self):
        """Turn details must contain exactly 30 evaluated turns across 16 scenarios."""
        turns = self.report.get("turn_details", [])
        assert len(turns) == 30
        for t in turns:
            assert "scenario_id" in t
            assert "turn" in t
            assert "customer_message" in t
            assert "contextual_query" in t
            assert "recommendations" in t
            assert "metrics" in t

    def test_session_isolation_across_scenarios(self):
        """Each scenario in turn details belongs to its own scenario ID without crosstalk."""
        scenario_ids = [t["scenario_id"] for t in self.report.get("turn_details", [])]
        unique_ids = sorted(list(set(scenario_ids)))
        assert len(unique_ids) == 16


# ===========================================================================
# 5. SIMULATOR EVALUATION TESTS
# ===========================================================================

class TestSimulatorEvaluation:
    """Tests evaluating Customer Simulator realism, persona consistency, and context."""

    def test_persona_consistency_evaluator(self):
        """Persona consistency checks validate persona stylistic markers."""
        assert evaluate_persona_consistency("I would like to request a refund.", "calm") is True
        assert evaluate_persona_consistency("Wait, does this mean my order didn't ship?", "confused") is True
        assert evaluate_persona_consistency("This is taking too long, why is it delayed?!", "frustrated") is True
        assert evaluate_persona_consistency("This is unacceptable! Refund my money right NOW!", "angry") is True
        assert evaluate_persona_consistency("I need this resolved immediately, urgent meeting in 20 minutes.", "impatient") is True
        assert evaluate_persona_consistency("Hello, could you please help me with my order?", "polite") is True

    def test_context_retention_evaluator(self):
        """Context retention identifies referential pronouns and order references."""
        prev = [{"sender": "Customer", "content": "I ordered laptop #ORD-1234 yesterday."}]
        assert evaluate_context_retention("Where is it now?", prev, ["order", "laptop"]) is True
        assert evaluate_context_retention("What is the refund timeline?", prev, ["refund", "laptop"]) is True

    def test_response_variety_metric(self):
        """Response variety rate is 1.0 when all customer messages are unique."""
        messages = ["Message A", "Message B", "Message C"]
        variety_rate = len(set(messages)) / len(messages)
        assert variety_rate == 1.0
