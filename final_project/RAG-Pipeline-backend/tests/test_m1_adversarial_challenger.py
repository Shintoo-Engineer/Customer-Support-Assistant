"""Adversarial stress testing and empirical challenge suite for Milestone 1.

Written by challenger_m1_1_orch3 to stress-test:
1. Boundary frustration levels (0, 1, 4, 5, 7, 8, 9, 10)
2. Critical vs Low priority transitions
3. Extreme customer emotions (angry, frustrated, satisfied, worried, confused)
4. Malformed, empty, and adversarial dialogue history inputs
5. Out-of-domain customer queries
6. Anti-hallucination guardrails under empty, whitespace, and irrelevant knowledge chunks
7. Gemini LLM mock failure resilience and fallback schema integrity
"""

import json
import pytest
from unittest.mock import patch, MagicMock

from app.schemas.analysis import (
    CustomerIntent,
    CustomerEmotion,
    CustomerSentiment,
    SatisfactionTrend,
    EscalationRisk,
    AnalysisResult,
    TurnAnalysis,
    DecisionPriority,
    RecommendedTone,
    RecommendedAction,
    CustomerNeed,
    DecisionSupportResult,
    ResponseEvaluation,
)
from app.schemas.knowledge import KnowledgeRecommendation, KnowledgeRecommendationResult
from app.services.decision_support_service import (
    _parse_knowledge_context,
    build_coaching_prompt,
    generate_coaching_with_gemini,
    generate_coaching_fallback,
    generate_decision_support,
    determine_priority,
    determine_recommended_tone,
    determine_recommended_action,
    collect_risk_flags,
)


# ===========================================================================
# 1. Boundary Frustration Stress Tests (0, 1, 4, 5, 7, 8, 9, 10)
# ===========================================================================

def test_boundary_frustration_zero_calm():
    """Boundary frustration = 0: Low priority, professional/calm tone, no risk flags."""
    analysis = AnalysisResult(
        intent=CustomerIntent.GENERAL_INQUIRY,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.POSITIVE,
        frustration_level=0,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.95,
    )
    res = generate_decision_support(analysis_result=analysis)

    assert res.priority == DecisionPriority.LOW
    assert res.recommended_tone == RecommendedTone.PROFESSIONAL
    assert res.recommended_action == RecommendedAction.PROVIDE_INSTRUCTIONS
    assert res.escalation_recommended is False
    assert "critical_frustration" not in res.risk_flags
    assert "high_frustration" not in res.risk_flags
    assert "Thank you for reaching out" in res.suggested_response


def test_boundary_frustration_ten_critical():
    """Boundary frustration = 10: Critical priority, escalation recommended, critical_frustration flag."""
    analysis = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.ANGRY,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=10,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.HIGH,
        confidence=0.95,
    )
    res = generate_decision_support(analysis_result=analysis)

    assert res.priority == DecisionPriority.CRITICAL
    assert res.recommended_action == RecommendedAction.ESCALATE
    assert res.escalation_recommended is True
    assert "critical_frustration" in res.risk_flags
    assert "angry_customer" in res.risk_flags
    assert "high_escalation_risk" in res.risk_flags
    assert "sincerely apologize" in res.suggested_response.lower()
    assert "escalat" in res.suggested_response.lower()


@pytest.mark.parametrize("frustration,expected_priority,expected_action_or_flag", [
    (0, DecisionPriority.LOW, "no_flag"),
    (1, DecisionPriority.LOW, "no_flag"),
    (4, DecisionPriority.LOW, "no_flag"),
    (5, DecisionPriority.MEDIUM, "no_flag"),
    (7, DecisionPriority.MEDIUM, "high_frustration"),
    (8, DecisionPriority.HIGH, "high_frustration"),
    (9, DecisionPriority.HIGH, "critical_frustration"),
    (10, DecisionPriority.HIGH, "critical_frustration"),
])
def test_frustration_boundary_spectrum(frustration, expected_priority, expected_action_or_flag):
    """Stress tests exact boundary transitions across 0, 1, 4, 5, 7, 8, 9, 10."""
    analysis = AnalysisResult(
        intent=CustomerIntent.ACCOUNT_ISSUE,
        emotion=CustomerEmotion.NEUTRAL if frustration <= 4 else CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEUTRAL if frustration <= 4 else CustomerSentiment.NEGATIVE,
        frustration_level=frustration,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.90,
    )
    res = generate_decision_support(analysis_result=analysis)

    assert res.priority == expected_priority
    if expected_action_or_flag == "critical_frustration":
        assert "critical_frustration" in res.risk_flags
        assert res.recommended_action == RecommendedAction.ESCALATE
        assert res.escalation_recommended is True
    elif expected_action_or_flag == "high_frustration":
        assert "high_frustration" in res.risk_flags


# ===========================================================================
# 2. Critical vs Low Priority Verification
# ===========================================================================

def test_critical_priority_requires_both_high_risk_and_severe_frustration():
    """Confirms CRITICAL priority triggers ONLY when both escalation_risk=HIGH and frustration>=8."""
    # Frustration 7 with HIGH risk -> should be HIGH, not CRITICAL
    analysis_7_high = AnalysisResult(
        intent=CustomerIntent.COMPLAINT,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=7,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.HIGH,
        confidence=0.90,
    )
    assert determine_priority(analysis_7_high) == DecisionPriority.HIGH

    # Frustration 8 with MEDIUM risk -> should be HIGH, not CRITICAL
    analysis_8_med = AnalysisResult(
        intent=CustomerIntent.COMPLAINT,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=8,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.MEDIUM,
        confidence=0.90,
    )
    assert determine_priority(analysis_8_med) == DecisionPriority.HIGH

    # Frustration 8 with HIGH risk -> CRITICAL
    analysis_8_high = AnalysisResult(
        intent=CustomerIntent.COMPLAINT,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=8,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.HIGH,
        confidence=0.90,
    )
    assert determine_priority(analysis_8_high) == DecisionPriority.CRITICAL


# ===========================================================================
# 3. Extreme Emotions Stress Testing
# ===========================================================================

def test_emotion_angry_triggers_empathy_and_risk_flag():
    """CustomerEmotion.ANGRY triggers EMPATHETIC tone, HIGH priority, and angry_customer flag."""
    analysis = AnalysisResult(
        intent=CustomerIntent.DELIVERY_ISSUE,
        emotion=CustomerEmotion.ANGRY,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=6,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.MEDIUM,
        confidence=0.92,
    )
    res = generate_decision_support(analysis_result=analysis)

    assert res.priority == DecisionPriority.HIGH
    assert res.recommended_tone == RecommendedTone.EMPATHETIC
    assert "angry_customer" in res.risk_flags
    assert res.response_evaluation.empathy >= 0.90
    assert any("validate" in tip.lower() for tip in res.coaching_tips)


def test_emotion_satisfied_triggers_professional_tone_and_appreciation():
    """CustomerEmotion.SATISFIED triggers PROFESSIONAL tone, LOW priority, and positive opening."""
    analysis = AnalysisResult(
        intent=CustomerIntent.GENERAL_INQUIRY,
        emotion=CustomerEmotion.SATISFIED,
        sentiment=CustomerSentiment.POSITIVE,
        frustration_level=1,
        satisfaction_trend=SatisfactionTrend.IMPROVING,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.96,
    )
    res = generate_decision_support(analysis_result=analysis)

    assert res.priority == DecisionPriority.LOW
    assert res.recommended_tone == RecommendedTone.PROFESSIONAL
    assert res.escalation_recommended is False
    assert len(res.risk_flags) == 0
    assert "glad to assist you" in res.suggested_response.lower()
    assert any("warm" in tip.lower() or "positive" in tip.lower() for tip in res.coaching_tips)


def test_emotion_worried_triggers_reassuring_tone():
    """CustomerEmotion.WORRIED triggers REASSURING tone."""
    analysis = AnalysisResult(
        intent=CustomerIntent.PAYMENT_ISSUE,
        emotion=CustomerEmotion.WORRIED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=4,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.88,
    )
    res = generate_decision_support(analysis_result=analysis)

    assert res.recommended_tone == RecommendedTone.REASSURING
    assert "reassure" in res.suggested_response.lower()
    assert any("reassurance" in tip.lower() or "anxiety" in tip.lower() for tip in res.coaching_tips)


def test_emotion_confused_triggers_clarifying_tone():
    """CustomerEmotion.CONFUSED triggers CLARIFYING tone."""
    analysis = AnalysisResult(
        intent=CustomerIntent.ACCOUNT_ISSUE,
        emotion=CustomerEmotion.CONFUSED,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=3,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.89,
    )
    res = generate_decision_support(analysis_result=analysis)

    assert res.recommended_tone == RecommendedTone.CLARIFYING
    assert "clarify" in res.suggested_response.lower()
    assert any("numbered steps" in tip.lower() or "concise" in tip.lower() for tip in res.coaching_tips)


# ===========================================================================
# 4. Malformed, Empty, and Adversarial Dialogue History Stress Tests
# ===========================================================================

def test_dialogue_history_none_and_empty():
    """Empty and None dialogue history should be safely handled without error."""
    analysis = AnalysisResult(
        intent=CustomerIntent.GENERAL_INQUIRY,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=2,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.85,
    )

    res_none = generate_decision_support(analysis_result=analysis, dialogue_history=None)
    assert isinstance(res_none, DecisionSupportResult)
    assert len(res_none.suggested_response) > 0

    res_empty = generate_decision_support(analysis_result=analysis, dialogue_history=[])
    assert isinstance(res_empty, DecisionSupportResult)
    assert len(res_empty.suggested_response) > 0


def test_dialogue_history_missing_keys_graceful_handling():
    """Malformed dialogue history items with missing keys should not crash."""
    analysis = AnalysisResult(
        intent=CustomerIntent.GENERAL_INQUIRY,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=2,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.85,
    )
    malformed_history = [
        {},
        {"random_key": "unrelated_value"},
        {"sender": None, "message_text": None},
        {"text": "Customer question here"},
    ]

    prompt = build_coaching_prompt(
        analysis=analysis,
        customer_message="Help please",
        dialogue_history=malformed_history,
    )
    assert "Help please" in prompt
    assert "Customer question here" in prompt


def test_dialogue_history_with_none_elements_resilience():
    """Adversarial dialogue history containing None elements falls back safely."""
    analysis = AnalysisResult(
        intent=CustomerIntent.GENERAL_INQUIRY,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=2,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.85,
    )
    # If history contains None or strings instead of dicts:
    adversarial_history = [None, "hello", 12345]

    # In generate_decision_support, failure in LLM generation or prompt building must fall back safely
    res = generate_decision_support(
        analysis_result=analysis,
        customer_message="I have a question",
        dialogue_history=adversarial_history,
        use_llm=True,
    )
    assert isinstance(res, DecisionSupportResult)
    assert len(res.suggested_response) > 0


# ===========================================================================
# 5. Out-of-Domain Queries & Anti-Hallucination Guardrails
# ===========================================================================

def test_out_of_domain_query_no_policy_fabrication():
    """Out-of-domain query with no relevant knowledge must NOT invent warranty or refund rules."""
    analysis = AnalysisResult(
        intent=CustomerIntent.GENERAL_INQUIRY,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=2,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.75,
    )

    res = generate_decision_support(
        analysis_result=analysis,
        knowledge_recommendations=None,
        customer_message="What is the capital of Australia and what is your 5-year warranty on laptops?"
    )

    # Must NOT fabricate a 5-year laptop warranty or refund guarantees
    response_lower = res.suggested_response.lower()
    assert "5-year" not in response_lower
    assert "warranty" not in response_lower or "unverified" in " ".join(res.coaching_tips).lower()
    assert "guarantee" not in response_lower

    # Must ask for clarifying details
    assert any(w in response_lower for w in ["order id", "account email", "reference number", "details"])

    # Evaluation reflects guardrail active
    assert res.response_evaluation.notes is not None
    assert "guardrail" in res.response_evaluation.notes.lower() or "anti-hallucination" in res.response_evaluation.notes.lower()


def test_anti_hallucination_empty_knowledge_formats():
    """Tests multiple empty knowledge input representations (None, [], empty model, empty dict)."""
    analysis = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=6,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.88,
    )

    empty_inputs = [
        None,
        [],
        KnowledgeRecommendationResult(query="refund", recommendations=[], no_relevant_information=True),
        KnowledgeRecommendationResult(query="refund", recommendations=[], no_relevant_information=False),
        {"recommendations": [], "no_relevant_information": True},
        {"recommendations": []},
    ]

    forbidden_phrases = ["3 days", "guaranteed refund", "instant credit", "replacement sent tomorrow"]

    for empty_input in empty_inputs:
        res = generate_decision_support(
            analysis_result=analysis,
            knowledge_recommendations=empty_input,
            customer_message="I demand a full refund immediately!"
        )
        assert isinstance(res, DecisionSupportResult)
        # Verify no specific refund policies or fabrication
        for forbidden in forbidden_phrases:
            assert forbidden not in res.suggested_response.lower()
        # Verify clarifying prompt is generated
        assert ("order id" in res.suggested_response.lower()
                or "account email" in res.suggested_response.lower()
                or "reference number" in res.suggested_response.lower())
        # Verify coaching tips caution agent
        joined_tips = " ".join(res.coaching_tips).lower()
        assert "unverified" in joined_tips or "clarifying" in joined_tips


# ===========================================================================
# 6. Adversarial Knowledge Context Parsing & Content Inspection
# ===========================================================================

def test_parse_knowledge_context_robustness():
    """Verifies that _parse_knowledge_context parses valid models and flags empty recommendations."""
    # Test valid model
    rec = KnowledgeRecommendation(
        title="Payment Guidelines",
        content="Credit cards are charged upon order confirmation.",
        source="Payment_policy_v1.pdf",
        document_type="policy",
        relevance_score=0.85
    )
    result_obj = KnowledgeRecommendationResult(
        query="payment charge",
        recommendations=[rec],
        no_relevant_information=False
    )
    chunks, no_info = _parse_knowledge_context(result_obj)
    assert len(chunks) == 1
    assert no_info is False
    assert chunks[0]["title"] == "Payment Guidelines"

    # Test explicit no_relevant_information flag
    result_empty = KnowledgeRecommendationResult(
        query="out of domain",
        recommendations=[],
        no_relevant_information=True
    )
    chunks_empty, no_info_empty = _parse_knowledge_context(result_empty)
    assert len(chunks_empty) == 0
    assert no_info_empty is True


# ===========================================================================
# 7. Gemini LLM Generation and Failure Resilience
# ===========================================================================

def test_gemini_timeout_network_exception_fallback():
    """Simulates Gemini network error or timeout; must fall back to deterministic response."""
    analysis = AnalysisResult(
        intent=CustomerIntent.PAYMENT_ISSUE,
        emotion=CustomerEmotion.ANGRY,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=8,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.HIGH,
        confidence=0.90,
    )

    with patch("app.services.decision_support_service.generate_with_gemini", side_effect=TimeoutError("Gemini timed out")):
        res = generate_decision_support(
            analysis_result=analysis,
            customer_message="My payment was deducted twice!",
            use_llm=True
        )

    assert isinstance(res, DecisionSupportResult)
    assert res.priority == DecisionPriority.CRITICAL
    assert len(res.suggested_response) > 30
    assert len(res.coaching_tips) >= 2
    assert isinstance(res.response_evaluation, ResponseEvaluation)


def test_gemini_missing_keys_json_fallback():
    """Simulates Gemini returning JSON missing suggested_response; falls back to deterministic."""
    analysis = AnalysisResult(
        intent=CustomerIntent.ACCOUNT_ISSUE,
        emotion=CustomerEmotion.CONFUSED,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=3,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.87,
    )

    broken_json = json.dumps({
        "coaching_tips": ["Help the user"],
        # Missing "suggested_response" and "response_evaluation"
    })

    with patch("app.services.decision_support_service.generate_with_gemini", return_value=broken_json):
        res = generate_decision_support(
            analysis_result=analysis,
            customer_message="I cannot log into my account",
            use_llm=True
        )

    assert isinstance(res, DecisionSupportResult)
    assert len(res.suggested_response) > 20
    assert len(res.coaching_tips) >= 2


def test_gemini_eval_scores_clamped():
    """Verifies that out-of-bounds evaluation scores from LLM are clamped between 0.0 and 1.0."""
    analysis = AnalysisResult(
        intent=CustomerIntent.GENERAL_INQUIRY,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=2,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.85,
    )

    raw_llm_json = json.dumps({
        "suggested_response": "We are happy to assist you today.",
        "coaching_tips": ["Be polite", "Answer questions accurately"],
        "response_evaluation": {
            "clarity": 1.5,  # Out of bounds > 1.0
            "empathy": -0.5, # Out of bounds < 0.0
            "relevance": 0.9,
            "professionalism": 1.0,
            "notes": "Clamped test"
        }
    })

    with patch("app.services.decision_support_service.generate_with_gemini", return_value=raw_llm_json):
        res = generate_decision_support(
            analysis_result=analysis,
            customer_message="What are your hours?",
            use_llm=True
        )

    assert res.response_evaluation.clarity == 1.0
    assert res.response_evaluation.empathy == 0.0
    assert res.response_evaluation.relevance == 0.9
    assert res.response_evaluation.professionalism == 1.0


# ===========================================================================
# 8. Deep Adversarial Anti-Hallucination Stress Tests (Challenger Probe)
# ===========================================================================

def test_adversarial_empty_string_content_chunk():
    """Adversarial test: A chunk exists with whitespace-only content.
    Tests whether the engine fabricates a 5-7 business days refund policy or activates anti-hallucination.
    """
    analysis = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=6,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.85,
    )
    # Model with whitespace content (passes min_length=1)
    rec_whitespace_content = KnowledgeRecommendationResult(
        query="refund time",
        recommendations=[
            KnowledgeRecommendation(
                title="Refund Policy Blank",
                content="   \t   ",
                source="Refund_policy_v2.pdf",
                document_type="policy",
                relevance_score=0.9
            )
        ],
        no_relevant_information=False
    )

    res = generate_decision_support(
        analysis_result=analysis,
        knowledge_recommendations=rec_whitespace_content,
        customer_message="When will I get my refund?"
    )

    print("Whitespace model chunk suggested response:", res.suggested_response)
    # Check if a specific timeline ("5-7 business days") was claimed
    claimed_timeline = "5-7 business days" in res.suggested_response
    assert not claimed_timeline, f"Anti-hallucination failure: claimed specific refund timeline '{res.suggested_response}' despite blank content"



def test_adversarial_whitespace_content_chunk():
    """Adversarial test: A chunk with only whitespace content."""
    analysis = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=6,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.85,
    )
    raw_dict_chunk = [
        {"title": "Refund", "content": "    \n\t  ", "relevance_score": 0.5}
    ]

    res = generate_decision_support(
        analysis_result=analysis,
        knowledge_recommendations=raw_dict_chunk,
        customer_message="Where is my refund?"
    )
    print("Whitespace chunk suggested response:", res.suggested_response)
    # Anti-hallucination check: must NOT fabricate specific refund timelines when chunk is whitespace
    assert "5-7 business days" not in res.suggested_response, (
        f"Anti-hallucination failure: Fabricated '5-7 business days' timeline when given whitespace chunk: {res.suggested_response}"
    )


def test_adversarial_irrelevant_cross_domain_chunk():
    """Adversarial test: Customer asks for refund, but chunk retrieved is warranty for hardware."""
    analysis = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=6,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.85,
    )
    mismatched_knowledge = KnowledgeRecommendationResult(
        query="refund",
        recommendations=[
            KnowledgeRecommendation(
                title="Hardware Warranty",
                content="Hardware components have a strict 1-year limited warranty from the date of purchase.",
                source="Hardware_warranty.pdf",
                document_type="policy",
                relevance_score=0.45
            )
        ],
        no_relevant_information=False
    )

    res = generate_decision_support(
        analysis_result=analysis,
        knowledge_recommendations=mismatched_knowledge,
        customer_message="Can I get my money back?"
    )
    print("Mismatched knowledge suggested response:", res.suggested_response)
    # Anti-hallucination check: A refund response must NOT claim that hardware warranty terms are the refund policy
    assert "hardware" not in res.suggested_response.lower(), (
        f"Semantic mismatch failure: Blended hardware warranty into refund policy: {res.suggested_response}"
    )


