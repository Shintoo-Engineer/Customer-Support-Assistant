"""Tests for Task 6 Phase 1: Coaching & Response Suggestion Agent.

Covers:
1. ResponseEvaluation and DecisionSupportResult schema extensions and validation.
2. Anti-hallucination guardrail when Task 5 knowledge is empty or unavailable.
3. The 8 canonical support scenarios (Refund/frustrated, Payment/angry, Delivery/confused,
   Account/login, Positive/satisfied, With Knowledge, Out-of-domain, Multi-turn progression).
4. Dual generation architecture: Gemini LLM parsing and deterministic fallback resilience.
5. SQLite session retrieval of Task 5 knowledge and decision support generation.
"""

import json
import os
import pytest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

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
    generate_coaching_with_gemini,
    generate_coaching_fallback,
    generate_decision_support,
    get_session_decision_support,
)

TEST_DB_FILE = "./test_coaching_decision_support.db"
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
def setup_test_db():
    """Initializes and tears down isolated SQLite database for coaching tests."""
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass

    Base.metadata.create_all(bind=test_engine)
    yield
    test_engine.dispose()
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except OSError:
            pass


# ===========================================================================
# 1. Schema Tests (ResponseEvaluation & DecisionSupportResult)
# ===========================================================================

def test_response_evaluation_valid():
    """Validates proper instantiation and bounds of ResponseEvaluation."""
    eval_model = ResponseEvaluation(
        clarity=0.92,
        empathy=0.88,
        relevance=0.95,
        professionalism=0.98,
        notes="High quality response."
    )
    assert eval_model.clarity == 0.92
    assert eval_model.empathy == 0.88
    assert eval_model.relevance == 0.95
    assert eval_model.professionalism == 0.98
    assert eval_model.notes == "High quality response."


def test_response_evaluation_bounds_validation():
    """Validates that out-of-bound scores in ResponseEvaluation raise ValidationError."""
    with pytest.raises(Exception):
        ResponseEvaluation(
            clarity=1.5,  # > 1.0
            empathy=0.8,
            relevance=0.9,
            professionalism=0.9
        )

    with pytest.raises(Exception):
        ResponseEvaluation(
            clarity=0.8,
            empathy=-0.1,  # < 0.0
            relevance=0.9,
            professionalism=0.9
        )


def test_decision_support_result_backward_compatibility():
    """Confirms DecisionSupportResult instantiates with backward-compatible defaults."""
    res = DecisionSupportResult(
        priority=DecisionPriority.LOW,
        recommended_tone=RecommendedTone.PROFESSIONAL,
        recommended_action=RecommendedAction.PROVIDE_INSTRUCTIONS,
        escalation_recommended=False,
        rationale="General support baseline",
        confidence=0.85
    )
    assert res.suggested_response == ""
    assert res.coaching_tips == []
    assert res.response_evaluation == {}


def test_decision_support_result_with_coaching_fields():
    """Validates DecisionSupportResult with full Task 6 Phase 1 coaching fields."""
    eval_model = ResponseEvaluation(
        clarity=0.95,
        empathy=0.90,
        relevance=0.92,
        professionalism=0.98,
        notes="Grounded in policy."
    )
    res = DecisionSupportResult(
        priority=DecisionPriority.MEDIUM,
        recommended_tone=RecommendedTone.EMPATHETIC,
        recommended_action=RecommendedAction.RESOLVE,
        escalation_recommended=False,
        rationale="Customer needs refund",
        confidence=0.90,
        suggested_response="I understand your frustration. We can process your refund.",
        coaching_tips=["De-escalate first", "Reference 5-7 day timeline"],
        response_evaluation=eval_model
    )
    assert "process your refund" in res.suggested_response
    assert len(res.coaching_tips) == 2
    assert isinstance(res.response_evaluation, ResponseEvaluation)
    assert res.response_evaluation.clarity == 0.95

    # Test serialization to dict
    d = res.model_dump()
    assert d["suggested_response"] == res.suggested_response
    assert d["coaching_tips"] == res.coaching_tips
    assert d["response_evaluation"]["clarity"] == 0.95


# ===========================================================================
# 2. Knowledge Parsing & Anti-Hallucination Guardrail Tests
# ===========================================================================

def test_parse_knowledge_context_with_none():
    """Knowledge parsing with None returns empty list and no_relevant_info=True."""
    chunks, no_info = _parse_knowledge_context(None)
    assert chunks == []
    assert no_info is True


def test_parse_knowledge_context_with_model():
    """Knowledge parsing with KnowledgeRecommendationResult extracts clean chunks."""
    rec_result = KnowledgeRecommendationResult(
        query="refund time",
        recommendations=[
            KnowledgeRecommendation(
                title="Refund Policy",
                content="Standard refunds take 5-7 business days.",
                source="Refund_policy_v2.pdf",
                document_type="policy",
                relevance_score=0.89
            )
        ],
        no_relevant_information=False
    )
    chunks, no_info = _parse_knowledge_context(rec_result)
    assert len(chunks) == 1
    assert chunks[0]["title"] == "Refund Policy"
    assert no_info is False


def test_parse_knowledge_context_with_no_relevant_information():
    """Knowledge parsing with no_relevant_information=True signals no_info=True."""
    rec_result = KnowledgeRecommendationResult(
        query="unrelated query",
        recommendations=[],
        no_relevant_information=True
    )
    chunks, no_info = _parse_knowledge_context(rec_result)
    assert chunks == []
    assert no_info is True


def test_anti_hallucination_guardrail_zero_knowledge_fabrication():
    """CRITICAL: Verifies zero policy fabrication when Task 5 returns no relevant information."""
    analysis = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=6,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.85
    )

    # Call with empty knowledge
    res = generate_decision_support(
        analysis_result=analysis,
        knowledge_recommendations=None,
        customer_message="I want my money back right now!"
    )

    # Must NOT fabricate specific timelines (like "in 3 days" or guaranteed amounts)
    assert "3 days" not in res.suggested_response
    assert "guarantee" not in res.suggested_response.lower()

    # Must ask for clarifying details (order ID or account email)
    assert ("order" in res.suggested_response.lower() or "email" in res.suggested_response.lower() or "details" in res.suggested_response.lower())

    # Coaching tips must warn against quoting unverified policies
    joined_tips = " ".join(res.coaching_tips)
    assert "unverified" in joined_tips.lower() or "clarifying" in joined_tips.lower()

    # Response evaluation notes reflect guardrail
    assert "anti-hallucination" in str(res.response_evaluation.notes).lower()


# ===========================================================================
# 3. The 8 Required Validation Scenarios
# ===========================================================================

def test_scenario_1_refund_frustrated():
    """Scenario 1: Refund / Frustrated customer with knowledge."""
    analysis = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=7,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.MEDIUM,
        confidence=0.90
    )
    knowledge = KnowledgeRecommendationResult(
        query="I need my refund",
        recommendations=[
            KnowledgeRecommendation(
                title="Refund Policy",
                content="Refunds are processed back to your original payment method within 5-7 business days.",
                source="Refund_policy_v2.pdf",
                document_type="policy",
                relevance_score=0.88
            )
        ],
        no_relevant_information=False
    )

    res = generate_decision_support(
        analysis_result=analysis,
        knowledge_recommendations=knowledge,
        customer_message="I've been waiting for my refund and nobody is helping me!"
    )

    assert res.recommended_tone == RecommendedTone.EMPATHETIC
    assert res.recommended_action == RecommendedAction.RESOLVE
    assert "refund" in res.suggested_response.lower()
    assert "frustration" in res.suggested_response.lower()
    assert 2 <= len(res.coaching_tips) <= 4
    assert res.response_evaluation.empathy >= 0.85


def test_scenario_2_payment_angry():
    """Scenario 2: Payment issue / Angry customer with high frustration."""
    analysis = AnalysisResult(
        intent=CustomerIntent.PAYMENT_ISSUE,
        emotion=CustomerEmotion.ANGRY,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=9,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.HIGH,
        confidence=0.95
    )
    knowledge = KnowledgeRecommendationResult(
        query="Double charged on checkout",
        recommendations=[
            KnowledgeRecommendation(
                title="Payment Policy",
                content="Failed transactions with pending charges are temporary authorization holds that release within 24-48 hours.",
                source="Payment_policy_v1.pdf",
                document_type="policy",
                relevance_score=0.91
            )
        ],
        no_relevant_information=False
    )

    res = generate_decision_support(
        analysis_result=analysis,
        knowledge_recommendations=knowledge,
        customer_message="You stole my money! Fix this immediately or I am suing!"
    )

    assert res.priority == DecisionPriority.CRITICAL
    assert res.recommended_action == RecommendedAction.ESCALATE
    assert res.escalation_recommended is True
    assert "apologize" in res.suggested_response.lower()
    assert "escalat" in res.suggested_response.lower()
    assert any("defensive" in tip.lower() or "calm" in tip.lower() or "supervisor" in tip.lower() for tip in res.coaching_tips)
    assert res.response_evaluation.empathy >= 0.90


def test_scenario_3_delivery_confused():
    """Scenario 3: Delivery issue / Confused customer."""
    analysis = AnalysisResult(
        intent=CustomerIntent.DELIVERY_ISSUE,
        emotion=CustomerEmotion.CONFUSED,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=4,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.88
    )
    knowledge = KnowledgeRecommendationResult(
        query="Where is my order?",
        recommendations=[
            KnowledgeRecommendation(
                title="Delivery Policy",
                content="Tracking updates may take 24-48 hours to appear in the carrier system once dispatched.",
                source="Delivery_policy_v1.pdf",
                document_type="policy",
                relevance_score=0.85
            )
        ],
        no_relevant_information=False
    )

    res = generate_decision_support(
        analysis_result=analysis,
        knowledge_recommendations=knowledge,
        customer_message="I got a tracking number but the website says package not found, what does that mean?"
    )

    assert res.recommended_tone == RecommendedTone.CLARIFYING
    assert res.recommended_action == RecommendedAction.PROVIDE_STATUS
    assert "delivery" in res.suggested_response.lower() or "tracking" in res.suggested_response.lower()
    assert any("numbered steps" in tip.lower() or "concise" in tip.lower() for tip in res.coaching_tips)
    assert res.response_evaluation.clarity >= 0.90


def test_scenario_4_account_login():
    """Scenario 4: Account / Login assistance."""
    analysis = AnalysisResult(
        intent=CustomerIntent.ACCOUNT_ISSUE,
        emotion=CustomerEmotion.WORRIED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=3,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.85
    )
    knowledge = KnowledgeRecommendationResult(
        query="Cannot login 2fa issue",
        recommendations=[
            KnowledgeRecommendation(
                title="Account Support FAQ",
                content="Reset your password using the Forgot Password link or verify your registered email address.",
                source="Customer_Support_FAQ_v1.pdf",
                document_type="faq",
                relevance_score=0.87
            )
        ],
        no_relevant_information=False
    )

    res = generate_decision_support(
        analysis_result=analysis,
        knowledge_recommendations=knowledge,
        customer_message="I'm locked out of my account and I'm worried someone hacked it."
    )

    assert res.recommended_tone == RecommendedTone.REASSURING
    assert res.recommended_action == RecommendedAction.CLARIFY
    assert "password" in res.suggested_response.lower() or "account" in res.suggested_response.lower()
    assert any("reassurance" in tip.lower() or "anxiety" in tip.lower() or "clarify" in tip.lower() for tip in res.coaching_tips)


def test_scenario_5_positive_satisfied():
    """Scenario 5: Positive / Satisfied customer interaction."""
    analysis = AnalysisResult(
        intent=CustomerIntent.GENERAL_INQUIRY,
        emotion=CustomerEmotion.SATISFIED,
        sentiment=CustomerSentiment.POSITIVE,
        frustration_level=1,
        satisfaction_trend=SatisfactionTrend.IMPROVING,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.92
    )

    res = generate_decision_support(
        analysis_result=analysis,
        knowledge_recommendations=None,
        customer_message="That worked perfectly, thank you so much for your help!"
    )

    assert res.priority == DecisionPriority.LOW
    assert res.recommended_tone == RecommendedTone.PROFESSIONAL
    assert "thank you" in res.suggested_response.lower()
    assert any("positive" in tip.lower() or "patient" in tip.lower() for tip in res.coaching_tips)
    assert res.response_evaluation.professionalism >= 0.90


def test_scenario_6_with_task5_knowledge():
    """Scenario 6: Verified integration with Task 5 knowledge chunks."""
    analysis = AnalysisResult(
        intent=CustomerIntent.RETURN_EXCHANGE,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=2,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.89
    )
    knowledge = KnowledgeRecommendationResult(
        query="How to return shoes",
        recommendations=[
            KnowledgeRecommendation(
                title="Return Policy",
                content="Eligible items can be returned within 30 days in original packaging with tags.",
                source="Return_policy_v1.pdf",
                document_type="policy",
                relevance_score=0.94
            )
        ],
        no_relevant_information=False
    )

    res = generate_decision_support(
        analysis_result=analysis,
        knowledge_recommendations=knowledge,
        customer_message="I'd like to return a pair of shoes that didn't fit."
    )

    assert "return" in res.suggested_response.lower()
    assert any("policy" in tip.lower() for tip in res.coaching_tips)
    assert res.response_evaluation.relevance >= 0.90


def test_scenario_7_out_of_domain_no_knowledge():
    """Scenario 7: Out-of-domain query with no_relevant_information=True."""
    analysis = AnalysisResult(
        intent=CustomerIntent.GENERAL_INQUIRY,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=2,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.75
    )
    knowledge = KnowledgeRecommendationResult(
        query="What is the speed of light in miles per hour?",
        recommendations=[],
        no_relevant_information=True
    )

    res = generate_decision_support(
        analysis_result=analysis,
        knowledge_recommendations=knowledge,
        customer_message="What is the speed of light in miles per hour?"
    )

    # Anti-hallucination: asks for clarifying details rather than fabricating answers
    assert "anti-hallucination" in str(res.response_evaluation.notes).lower()
    assert any("unverified" in tip.lower() or "clarifying" in tip.lower() for tip in res.coaching_tips)


def test_scenario_8_multi_turn_progression():
    """Scenario 8: Multi-turn progression from frustrated to satisfied."""
    turn_1 = TurnAnalysis(
        turn=1,
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=7,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.MEDIUM,
        confidence=0.88
    )
    turn_2_analysis = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.SATISFIED,
        sentiment=CustomerSentiment.POSITIVE,
        frustration_level=2,
        satisfaction_trend=SatisfactionTrend.IMPROVING,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.92,
        turn_number=2
    )

    res = generate_decision_support(
        analysis_result=turn_2_analysis,
        history=[turn_1],
        knowledge_recommendations=None,
        customer_message="Thanks, I see the refund pending on my banking app now."
    )

    assert res.turn_number == 2
    assert res.priority == DecisionPriority.LOW
    assert res.recommended_tone == RecommendedTone.PROFESSIONAL
    assert "thank" in res.suggested_response.lower()


# ===========================================================================
# 4. Gemini LLM Mocking & Dual Architecture Resilience
# ===========================================================================

def test_gemini_llm_generation_when_mocked():
    """Verifies that generate_decision_support incorporates parsed LLM JSON output."""
    mock_llm_json = json.dumps({
        "suggested_response": "Hello! I am happy to help you with your order status inquiry.",
        "coaching_tips": [
            "Confirm tracking number before quoting delivery dates.",
            "Use a friendly closing statement."
        ],
        "response_evaluation": {
            "clarity": 0.95,
            "empathy": 0.88,
            "relevance": 0.92,
            "professionalism": 0.97,
            "notes": "Generated by Gemini LLM mock."
        }
    })

    analysis = AnalysisResult(
        intent=CustomerIntent.DELIVERY_ISSUE,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=2,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.85
    )

    with patch("app.services.decision_support_service.generate_with_gemini", return_value=mock_llm_json):
        res = generate_decision_support(
            analysis_result=analysis,
            customer_message="Can you check on order #12345?",
            use_llm=True
        )

    assert res.suggested_response == "Hello! I am happy to help you with your order status inquiry."
    assert len(res.coaching_tips) == 2
    assert res.coaching_tips[0] == "Confirm tracking number before quoting delivery dates."
    assert res.response_evaluation.clarity == 0.95
    assert res.response_evaluation.notes == "Generated by Gemini LLM mock."


def test_gemini_llm_malformed_json_fallback():
    """Verifies seamless fallback when Gemini returns invalid/malformed JSON."""
    analysis = AnalysisResult(
        intent=CustomerIntent.DELIVERY_ISSUE,
        emotion=CustomerEmotion.CONFUSED,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=4,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.85
    )

    with patch("app.services.decision_support_service.generate_with_gemini", return_value="Not valid JSON at all!"):
        res = generate_decision_support(
            analysis_result=analysis,
            customer_message="Where is my package?",
            use_llm=True
        )

    # Must fall back to high-quality deterministic response and coaching
    assert len(res.suggested_response) > 20
    assert len(res.coaching_tips) >= 2
    assert isinstance(res.response_evaluation, ResponseEvaluation)


# ===========================================================================
# 5. Full Determinism Verification
# ===========================================================================

def test_generate_decision_support_50_run_determinism():
    """Verifies that 50 successive runs produce identical outputs."""
    analysis = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=6,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.MEDIUM,
        confidence=0.89,
        session_id=42,
        turn_number=1
    )

    first_dump = generate_decision_support(analysis).model_dump()
    for _ in range(50):
        next_dump = generate_decision_support(analysis).model_dump()
        assert first_dump == next_dump


# ===========================================================================
# 6. Database Integration & Task 5 Extraction from SQLite
# ===========================================================================

def test_get_session_decision_support_extracts_task5_knowledge():
    """Verifies that get_session_decision_support extracts Task 5 recommendations from SQLite."""
    db = TestingSessionLocal()
    try:
        # 1. Create session and conversation
        scen = Scenario(
            title="Test Refund Scenario",
            category="refund",
            difficulty="medium",
            objective="Resolve refund",
            description="Customer refund request"
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
            sentiment="negative",
            escalation_risk="medium",
            created_at=datetime.now(timezone.utc)
        )
        db.add(conv)
        db.commit()

        # 2. Add customer message
        cust_msg = Message(
            conversation_id=conv.conversation_id,
            sender_type="Customer",
            message_text="My order arrived broken and I want a refund now.",
            timestamp=datetime.now(timezone.utc),
            message_type="Customer"
        )
        db.add(cust_msg)

        # 3. Add system message containing Task 5 recommendations
        system_payload = {
            "persona": "frustrated",
            "scenario": "refund",
            "analysis": {
                "intent": "refund",
                "emotion": "frustrated",
                "sentiment": "negative",
                "frustration_level": 7,
                "satisfaction_trend": "stable",
                "escalation_risk": "medium",
                "confidence": 0.91,
                "analysis_source": "fallback"
            },
            "recommendations": {
                "query": "refund broken item",
                "recommendations": [
                    {
                        "title": "Refund Policy",
                        "content": "Refunds for damaged or broken items are processed within 3-5 business days upon verification.",
                        "source": "Refund_policy_v2.pdf",
                        "document_type": "policy",
                        "relevance_score": 0.92
                    }
                ],
                "no_relevant_information": False
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

        # 4. Retrieve decision support
        decision = get_session_decision_support(session_id=session_obj.session_id, db=db)

        assert decision.session_id == session_obj.session_id
        assert decision.turn_number == 1
        assert decision.priority == DecisionPriority.HIGH or decision.priority == DecisionPriority.MEDIUM
        assert "refund" in decision.suggested_response.lower()
        assert len(decision.coaching_tips) >= 2
        assert isinstance(decision.response_evaluation, ResponseEvaluation)
        assert decision.response_evaluation.clarity >= 0.85

    finally:
        db.close()
