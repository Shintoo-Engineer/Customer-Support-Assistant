"""Empirical Challenger Test Suite for Milestone 1.

Author: challenger_m1_2_orch3
Objective:
1. Verify 8 required test scenarios (Refund/frustrated, Payment/angry, Delivery/confused,
   Account/login, Positive/satisfied, with Task 5 knowledge, without Task 5 knowledge, multi-turn).
2. Verify that scores for clarity, empathy, relevance, professionalism are strictly bounded in [0.0, 1.0].
3. Verify backward compatibility: legacy code calling DecisionSupportResult and generate_decision_support without new fields.
4. Stress-test determinism, edge cases, malformed knowledge chunks, extreme frustration values, and API serialization.
"""

import json
import os
import pytest
from datetime import datetime, timezone
from unittest.mock import patch
from pydantic import ValidationError
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.models.database import Base
from app.models.simulator import Scenario, Session as SimSession, Conversation, Message
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
    generate_coaching_fallback,
    generate_coaching_with_gemini,
    generate_decision_support,
    get_session_decision_support,
)

CHALLENGER_DB_FILE = "./test_empirical_challenger_m1.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{CHALLENGER_DB_FILE}"

test_engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}
)
ChallengerSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine
)


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    """Initializes and tears down isolated SQLite database for challenger tests."""
    if os.path.exists(CHALLENGER_DB_FILE):
        try:
            os.remove(CHALLENGER_DB_FILE)
        except OSError:
            pass

    Base.metadata.create_all(bind=test_engine)
    yield
    test_engine.dispose()
    if os.path.exists(CHALLENGER_DB_FILE):
        try:
            os.remove(CHALLENGER_DB_FILE)
        except OSError:
            pass


# ===========================================================================
# 1. Verification of the 8 Required Test Scenarios
# ===========================================================================

def test_scenario_1_refund_frustrated():
    """Scenario 1: Refund / Frustrated."""
    analysis = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=7,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.MEDIUM,
        confidence=0.90,
    )
    knowledge = KnowledgeRecommendationResult(
        query="I need my refund",
        recommendations=[
            KnowledgeRecommendation(
                title="Refund Policy",
                content="Refunds are processed back to your original payment method within 5-7 business days.",
                source="Refund_policy_v2.pdf",
                document_type="policy",
                relevance_score=0.88,
            )
        ],
        no_relevant_information=False,
    )

    res = generate_decision_support(
        analysis_result=analysis,
        knowledge_recommendations=knowledge,
        customer_message="I've been waiting for my refund and nobody is helping me!",
    )

    assert res.recommended_tone == RecommendedTone.EMPATHETIC
    assert res.recommended_action == RecommendedAction.RESOLVE
    assert "refund" in res.suggested_response.lower()
    assert len(res.suggested_response) > 30
    assert 2 <= len(res.coaching_tips) <= 4
    assert isinstance(res.response_evaluation, ResponseEvaluation)
    assert 0.0 <= res.response_evaluation.clarity <= 1.0
    assert 0.0 <= res.response_evaluation.empathy <= 1.0
    assert 0.0 <= res.response_evaluation.relevance <= 1.0
    assert 0.0 <= res.response_evaluation.professionalism <= 1.0


def test_scenario_2_payment_angry():
    """Scenario 2: Payment / Angry."""
    analysis = AnalysisResult(
        intent=CustomerIntent.PAYMENT_ISSUE,
        emotion=CustomerEmotion.ANGRY,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=9,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.HIGH,
        confidence=0.95,
    )
    knowledge = KnowledgeRecommendationResult(
        query="Double charged on checkout",
        recommendations=[
            KnowledgeRecommendation(
                title="Payment Policy",
                content="Failed transactions with pending charges are temporary authorization holds that release within 24-48 hours.",
                source="Payment_policy_v1.pdf",
                document_type="policy",
                relevance_score=0.91,
            )
        ],
        no_relevant_information=False,
    )

    res = generate_decision_support(
        analysis_result=analysis,
        knowledge_recommendations=knowledge,
        customer_message="You stole my money! Fix this immediately or I am suing!",
    )

    assert res.priority == DecisionPriority.CRITICAL
    assert res.recommended_action == RecommendedAction.ESCALATE
    assert res.escalation_recommended is True
    assert "apologize" in res.suggested_response.lower()
    assert any("defensive" in tip.lower() or "calm" in tip.lower() or "supervisor" in tip.lower() for tip in res.coaching_tips)


def test_scenario_3_delivery_confused():
    """Scenario 3: Delivery / Confused."""
    analysis = AnalysisResult(
        intent=CustomerIntent.DELIVERY_ISSUE,
        emotion=CustomerEmotion.CONFUSED,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=4,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.88,
    )
    knowledge = KnowledgeRecommendationResult(
        query="Where is my order?",
        recommendations=[
            KnowledgeRecommendation(
                title="Delivery Policy",
                content="Tracking updates may take 24-48 hours to appear in the carrier system once dispatched.",
                source="Delivery_policy_v1.pdf",
                document_type="policy",
                relevance_score=0.85,
            )
        ],
        no_relevant_information=False,
    )

    res = generate_decision_support(
        analysis_result=analysis,
        knowledge_recommendations=knowledge,
        customer_message="I got a tracking number but the carrier says not found, what does that mean?",
    )

    assert res.recommended_tone == RecommendedTone.CLARIFYING
    assert res.recommended_action == RecommendedAction.PROVIDE_STATUS
    assert "delivery" in res.suggested_response.lower() or "tracking" in res.suggested_response.lower()
    assert any("numbered steps" in tip.lower() or "concise" in tip.lower() for tip in res.coaching_tips)


def test_scenario_4_account_login():
    """Scenario 4: Account / Login."""
    analysis = AnalysisResult(
        intent=CustomerIntent.ACCOUNT_ISSUE,
        emotion=CustomerEmotion.WORRIED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=3,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.85,
    )
    knowledge = KnowledgeRecommendationResult(
        query="Cannot login 2fa issue",
        recommendations=[
            KnowledgeRecommendation(
                title="Account Support FAQ",
                content="Reset your password using the Forgot Password link or verify your registered email address.",
                source="Customer_Support_FAQ_v1.pdf",
                document_type="faq",
                relevance_score=0.87,
            )
        ],
        no_relevant_information=False,
    )

    res = generate_decision_support(
        analysis_result=analysis,
        knowledge_recommendations=knowledge,
        customer_message="I'm locked out of my account and I'm worried someone hacked it.",
    )

    assert res.recommended_tone == RecommendedTone.REASSURING
    assert res.recommended_action == RecommendedAction.CLARIFY
    assert "password" in res.suggested_response.lower() or "account" in res.suggested_response.lower()


def test_scenario_5_positive_satisfied():
    """Scenario 5: Positive / Satisfied."""
    analysis = AnalysisResult(
        intent=CustomerIntent.GENERAL_INQUIRY,
        emotion=CustomerEmotion.SATISFIED,
        sentiment=CustomerSentiment.POSITIVE,
        frustration_level=1,
        satisfaction_trend=SatisfactionTrend.IMPROVING,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.92,
    )

    res = generate_decision_support(
        analysis_result=analysis,
        knowledge_recommendations=None,
        customer_message="That worked perfectly, thank you so much for your help!",
    )

    assert res.priority == DecisionPriority.LOW
    assert res.recommended_tone == RecommendedTone.PROFESSIONAL
    assert "thank you" in res.suggested_response.lower()


def test_scenario_6_with_task5_knowledge():
    """Scenario 6: With Task 5 Knowledge."""
    analysis = AnalysisResult(
        intent=CustomerIntent.RETURN_EXCHANGE,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=2,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.89,
    )
    knowledge = KnowledgeRecommendationResult(
        query="How to return shoes",
        recommendations=[
            KnowledgeRecommendation(
                title="Return Policy",
                content="Eligible items can be returned within 30 days in original packaging with tags.",
                source="Return_policy_v1.pdf",
                document_type="policy",
                relevance_score=0.94,
            )
        ],
        no_relevant_information=False,
    )

    res = generate_decision_support(
        analysis_result=analysis,
        knowledge_recommendations=knowledge,
        customer_message="I'd like to return a pair of shoes that didn't fit.",
    )

    assert "return" in res.suggested_response.lower()
    assert any("policy" in tip.lower() for tip in res.coaching_tips)


def test_scenario_7_without_task5_knowledge_out_of_domain():
    """Scenario 7: Without Task 5 Knowledge (Out-of-domain)."""
    analysis = AnalysisResult(
        intent=CustomerIntent.GENERAL_INQUIRY,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=2,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.75,
    )
    knowledge = KnowledgeRecommendationResult(
        query="What is the quantum state of water?",
        recommendations=[],
        no_relevant_information=True,
    )

    res = generate_decision_support(
        analysis_result=analysis,
        knowledge_recommendations=knowledge,
        customer_message="What is the quantum state of water?",
    )

    # Anti-hallucination guardrail: must NOT fabricate facts, asks for clarifying details
    assert "anti-hallucination" in str(res.response_evaluation.notes).lower()
    assert any("unverified" in tip.lower() or "clarifying" in tip.lower() for tip in res.coaching_tips)
    # Does not fabricate unverified refund or policy guarantees
    assert "guarantee" not in res.suggested_response.lower()


def test_scenario_8_multi_turn():
    """Scenario 8: Multi-turn progression."""
    turn_1 = TurnAnalysis(
        turn=1,
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=8,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.HIGH,
        confidence=0.90,
    )
    turn_2 = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.SATISFIED,
        sentiment=CustomerSentiment.POSITIVE,
        frustration_level=2,
        satisfaction_trend=SatisfactionTrend.IMPROVING,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.93,
        turn_number=2,
    )

    res = generate_decision_support(
        analysis_result=turn_2,
        history=[turn_1],
        knowledge_recommendations=None,
        customer_message="I see the credit on my account now, thanks for resolving it!",
    )

    assert res.turn_number == 2
    assert res.priority == DecisionPriority.LOW
    assert "thank" in res.suggested_response.lower()


# ===========================================================================
# 2. Strict Score Boundedness [0.0, 1.0] Invariant Tests
# ===========================================================================

@pytest.mark.parametrize("invalid_score", [-0.01, -1.0, 1.01, 2.0, 100.0])
def test_response_evaluation_rejects_out_of_bound_scores(invalid_score):
    """Verify that ResponseEvaluation strictly enforces 0.0 <= score <= 1.0 on all 4 metrics."""
    # Test clarity
    with pytest.raises(ValidationError):
        ResponseEvaluation(clarity=invalid_score, empathy=0.8, relevance=0.8, professionalism=0.8)

    # Test empathy
    with pytest.raises(ValidationError):
        ResponseEvaluation(clarity=0.8, empathy=invalid_score, relevance=0.8, professionalism=0.8)

    # Test relevance
    with pytest.raises(ValidationError):
        ResponseEvaluation(clarity=0.8, empathy=0.8, relevance=invalid_score, professionalism=0.8)

    # Test professionalism
    with pytest.raises(ValidationError):
        ResponseEvaluation(clarity=0.8, empathy=0.8, relevance=0.8, professionalism=invalid_score)


def test_response_evaluation_exact_boundaries():
    """Verify that exact boundary values 0.0 and 1.0 are valid."""
    min_eval = ResponseEvaluation(clarity=0.0, empathy=0.0, relevance=0.0, professionalism=0.0)
    assert min_eval.clarity == 0.0
    assert min_eval.empathy == 0.0
    assert min_eval.relevance == 0.0
    assert min_eval.professionalism == 0.0

    max_eval = ResponseEvaluation(clarity=1.0, empathy=1.0, relevance=1.0, professionalism=1.0)
    assert max_eval.clarity == 1.0
    assert max_eval.empathy == 1.0
    assert max_eval.relevance == 1.0
    assert max_eval.professionalism == 1.0


def test_all_intents_and_emotions_produce_bounded_scores():
    """Exhaustively verify that generate_coaching_fallback produces scores strictly in [0.0, 1.0] across all combinations."""
    for intent in CustomerIntent:
        for emotion in CustomerEmotion:
            for frustration in [0, 1, 4, 7, 10]:
                analysis = AnalysisResult(
                    intent=intent,
                    emotion=emotion,
                    sentiment=CustomerSentiment.NEUTRAL,
                    frustration_level=frustration,
                    satisfaction_trend=SatisfactionTrend.STABLE,
                    escalation_risk=EscalationRisk.LOW,
                    confidence=0.85,
                )
                res = generate_coaching_fallback(analysis_result=analysis)
                eval_obj = res["response_evaluation"]
                assert isinstance(eval_obj, ResponseEvaluation)
                assert 0.0 <= eval_obj.clarity <= 1.0
                assert 0.0 <= eval_obj.empathy <= 1.0
                assert 0.0 <= eval_obj.relevance <= 1.0
                assert 0.0 <= eval_obj.professionalism <= 1.0


def test_gemini_clamping_guarantees_bounded_scores():
    """Verify that generate_coaching_with_gemini clamps out-of-range LLM scores into [0.0, 1.0]."""
    mock_llm_json = json.dumps({
        "suggested_response": "We are looking into this.",
        "coaching_tips": ["Stay professional."],
        "response_evaluation": {
            "clarity": 95.0,     # Out-of-bounds (> 1.0)
            "empathy": -0.5,     # Out-of-bounds (< 0.0)
            "relevance": 1.2,    # Out-of-bounds (> 1.0)
            "professionalism": 0.85,
        }
    })

    analysis = AnalysisResult(
        intent=CustomerIntent.GENERAL_INQUIRY,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=0,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.85,
    )

    with patch("app.services.decision_support_service.generate_with_gemini", return_value=mock_llm_json):
        coaching = generate_coaching_with_gemini(analysis, customer_message="Hello")
        assert coaching is not None
        eval_obj = coaching["response_evaluation"]
        assert eval_obj.clarity == 1.0  # Clamped to 1.0
        assert eval_obj.empathy == 0.0  # Clamped to 0.0
        assert eval_obj.relevance == 1.0  # Clamped to 1.0
        assert eval_obj.professionalism == 0.85


# ===========================================================================
# 3. Backward Compatibility Invariant Tests
# ===========================================================================

def test_decision_support_result_legacy_instantiation():
    """Verify legacy construction of DecisionSupportResult without new fields succeeds."""
    legacy = DecisionSupportResult(
        priority=DecisionPriority.LOW,
        recommended_tone=RecommendedTone.PROFESSIONAL,
        recommended_action=RecommendedAction.PROVIDE_STATUS,
        escalation_recommended=False,
        rationale="Legacy caller test",
        confidence=0.88,
    )

    # Valid default values for new fields
    assert legacy.suggested_response == ""
    assert legacy.coaching_tips == []
    assert legacy.response_evaluation == {}

    # Check dict representation contains both old and new fields
    d = legacy.model_dump()
    assert d["priority"] == "low"
    assert d["recommended_tone"] == "professional"
    assert d["recommended_action"] == "provide_status"
    assert d["escalation_recommended"] is False
    assert d["suggested_response"] == ""
    assert d["coaching_tips"] == []
    assert d["response_evaluation"] == {}


def test_generate_decision_support_legacy_call_patterns():
    """Verify generate_decision_support works with legacy calling conventions."""
    analysis = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=5,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.85,
    )

    # 1. Positional-only legacy call: generate_decision_support(analysis)
    res1 = generate_decision_support(analysis)
    assert isinstance(res1, DecisionSupportResult)
    assert len(res1.suggested_response) > 0
    assert len(res1.coaching_tips) >= 2
    assert isinstance(res1.response_evaluation, ResponseEvaluation)

    # 2. Keyword-only legacy call with 'analysis=...'
    res2 = generate_decision_support(analysis=analysis)
    assert isinstance(res2, DecisionSupportResult)
    assert len(res2.suggested_response) > 0

    # 3. Legacy call with history only
    turn1 = TurnAnalysis(
        turn=1,
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=5,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.85,
    )
    res3 = generate_decision_support(analysis, history=[turn1])
    assert isinstance(res3, DecisionSupportResult)


# ===========================================================================
# 4. Stress, Edge Cases & Adversarial Robustness
# ===========================================================================

def test_boundary_frustration_levels():
    """Verify behavior under all contract boundary frustration values (0, 1, 4, 5, 7, 8, 9, 10)."""
    for frust in [0, 1, 4, 5, 7, 8, 9, 10]:
        analysis = AnalysisResult(
            intent=CustomerIntent.COMPLAINT,
            emotion=CustomerEmotion.ANGRY,
            sentiment=CustomerSentiment.NEGATIVE,
            frustration_level=frust,
            satisfaction_trend=SatisfactionTrend.DECLINING,
            escalation_risk=EscalationRisk.HIGH,
            confidence=0.90,
        )
        res = generate_decision_support(analysis)
        assert isinstance(res, DecisionSupportResult)
        assert len(res.suggested_response) > 0
        assert 2 <= len(res.coaching_tips) <= 4


def test_invalid_frustration_levels_rejected_by_schema():
    """Verify that frustration levels outside [0, 10] are rejected by AnalysisResult schema."""
    with pytest.raises(ValidationError):
        AnalysisResult(
            intent=CustomerIntent.COMPLAINT,
            emotion=CustomerEmotion.ANGRY,
            sentiment=CustomerSentiment.NEGATIVE,
            frustration_level=-1,
            satisfaction_trend=SatisfactionTrend.DECLINING,
            escalation_risk=EscalationRisk.HIGH,
            confidence=0.90,
        )

    with pytest.raises(ValidationError):
        AnalysisResult(
            intent=CustomerIntent.COMPLAINT,
            emotion=CustomerEmotion.ANGRY,
            sentiment=CustomerSentiment.NEGATIVE,
            frustration_level=11,
            satisfaction_trend=SatisfactionTrend.DECLINING,
            escalation_risk=EscalationRisk.HIGH,
            confidence=0.90,
        )


def test_malformed_knowledge_recommendations_resilience():
    """Verify resilience when knowledge_recommendations has various shapes and edge cases."""
    analysis = AnalysisResult(
        intent=CustomerIntent.PAYMENT_ISSUE,
        emotion=CustomerEmotion.WORRIED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=3,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.85,
    )

    malformed_inputs = [
        {},
        {"recommendations": []},
        {"recommendations": ["invalid string", 42]},
        {"recommendations": [{"content": ""}]},  # empty content
        {"recommendations": [{"missing_content": "xyz"}]},  # missing 'content' key
        {"recommendations": [{"content": "Short."}]},  # content <= 15 chars
        {"recommendations": [{"content": "A" * 5000}]},  # very large content
    ]

    for malformed in malformed_inputs:
        res = generate_decision_support(analysis, knowledge_recommendations=malformed)
        assert isinstance(res, DecisionSupportResult)
        assert len(res.suggested_response) > 0
        assert 2 <= len(res.coaching_tips) <= 4



def test_empty_and_special_customer_messages():
    """Verify behavior when customer_message is empty, None, or contains unusual characters."""
    analysis = AnalysisResult(
        intent=CustomerIntent.GENERAL_INQUIRY,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=0,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.85,
    )

    test_messages = [
        None,
        "",
        "   ",
        "😀🎉🔥🚨",
        "Line 1\nLine 2\r\nLine 3\tTabbed",
        "A" * 2000,
    ]

    for msg in test_messages:
        res = generate_decision_support(analysis, customer_message=msg)
        assert isinstance(res, DecisionSupportResult)
        assert len(res.suggested_response) > 0


def test_determinism_across_100_runs():
    """Empirically prove determinism across 100 consecutive invocations."""
    analysis = AnalysisResult(
        intent=CustomerIntent.DELIVERY_ISSUE,
        emotion=CustomerEmotion.CONFUSED,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=4,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.85,
    )

    knowledge = KnowledgeRecommendationResult(
        query="Order transit status",
        recommendations=[
            KnowledgeRecommendation(
                title="Delivery Guideline",
                content="Tracking updates may take 24-48 hours to update in carrier systems.",
                source="Delivery_policy_v1.pdf",
                document_type="policy",
                relevance_score=0.90,
            )
        ],
        no_relevant_information=False,
    )

    baseline = generate_decision_support(
        analysis,
        knowledge_recommendations=knowledge,
        customer_message="Where is my parcel?"
    ).model_dump()

    for _ in range(100):
        current = generate_decision_support(
            analysis,
            knowledge_recommendations=knowledge,
            customer_message="Where is my parcel?"
        ).model_dump()
        assert baseline == current


# ===========================================================================
# 5. FastAPI Endpoints Serialization & Contract Invariants
# ===========================================================================

def test_api_endpoints_return_new_coaching_fields():
    """Verify FastAPI GET /analysis/{session_id}/decision-support returns new schema fields."""
    db = ChallengerSessionLocal()
    try:
        scen = Scenario(
            title="Challenger Refund Test",
            category="refund",
            difficulty="low",
            objective="Test API response",
            description="Empirical test"
        )
        db.add(scen)
        db.commit()

        session_obj = SimSession(
            scenario_id=scen.scenario_id,
            status="In Progress",
            start_time=datetime.now(timezone.utc)
        )
        db.add(session_obj)
        db.commit()

        conv = Conversation(
            session_id=session_obj.session_id,
            intent="refund",
            sentiment="neutral",
            escalation_risk="low",
            created_at=datetime.now(timezone.utc)
        )
        db.add(conv)
        db.commit()

        cust_msg = Message(
            conversation_id=conv.conversation_id,
            sender_type="Customer",
            message_text="Can I get a refund for this order?",
            timestamp=datetime.now(timezone.utc),
            message_type="Customer"
        )
        db.add(cust_msg)

        system_payload = {
            "persona": "neutral",
            "scenario": "refund",
            "analysis": {
                "intent": "refund",
                "emotion": "neutral",
                "sentiment": "neutral",
                "frustration_level": 2,
                "satisfaction_trend": "stable",
                "escalation_risk": "low",
                "confidence": 0.90,
                "analysis_source": "fallback"
            },
            "recommendations": {
                "query": "refund",
                "recommendations": [],
                "no_relevant_information": True
            }
        }
        sys_msg = Message(
            conversation_id=conv.conversation_id,
            sender_type="AI",
            message_text=json.dumps(system_payload),
            timestamp=datetime.now(timezone.utc),
            message_type="System"
        )
        db.add(sys_msg)
        db.commit()

        client = TestClient(app)
        response = client.get(f"/analysis/{session_obj.session_id}/decision-support")
        assert response.status_code == 200
        data = response.json()

        assert "suggested_response" in data
        assert len(data["suggested_response"]) > 0
        assert "coaching_tips" in data
        assert isinstance(data["coaching_tips"], list)
        assert len(data["coaching_tips"]) >= 2
        assert "response_evaluation" in data
        eval_data = data["response_evaluation"]
        assert "clarity" in eval_data
        assert 0.0 <= eval_data["clarity"] <= 1.0
        assert 0.0 <= eval_data["empathy"] <= 1.0
        assert 0.0 <= eval_data["relevance"] <= 1.0
        assert 0.0 <= eval_data["professionalism"] <= 1.0

        # Also test POST endpoint
        post_response = client.post(f"/analysis/{session_obj.session_id}/decision-support")
        assert post_response.status_code == 200
        post_data = post_response.json()
        assert post_data["suggested_response"] == data["suggested_response"]

    finally:
        db.close()
