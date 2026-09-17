"""TASK 4 — PHASE 6 TEST SUITE: Downstream Decision Support & Agent-Ready Recommendation Layer.

Verifies:
1. Enums: DecisionPriority, RecommendedTone, RecommendedAction, CustomerNeed.
2. DecisionSupportResult schema validation, field types, and serialization.
3. Deterministic customer need mapping from CustomerIntent (all 8 intents + fallback).
4. Deterministic priority determination (critical, high, medium, low).
5. Deterministic recommended tone selection (empathetic, reassuring, clarifying, apologetic, professional, calm).
6. Deterministic recommended action selection (escalate, apologize_and_resolve, provide_status, clarify, etc.).
7. Deterministic risk flag extraction (frustration, anger, negative sentiment, declining trend, history).
8. End-to-end generate_decision_support function determinism and input polymorphism.
9. Database integration & HTTP API endpoints (POST / GET /analysis/{session_id}/decision-support).
10. Downstream agent simulation (Response Suggestion Agent, Escalation Agent).
"""

import os
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.models.database import Base
from app.api.simulator import get_db as sim_get_db
from app.api.analysis import get_db as analysis_get_db
from app.models.simulator import Scenario, Session as SimSession, Conversation, Message
from app.schemas.analysis import (
    CustomerIntent,
    CustomerEmotion,
    CustomerSentiment,
    SatisfactionTrend,
    EscalationRisk,
    AnalysisResponse,
    AnalysisResult,
    TurnAnalysis,
    DecisionPriority,
    RecommendedTone,
    RecommendedAction,
    CustomerNeed,
    DecisionSupportResult,
)
from app.services.decision_support_service import (
    map_customer_needs,
    determine_priority,
    determine_recommended_tone,
    determine_recommended_action,
    collect_risk_flags,
    generate_decision_support,
    get_session_decision_support,
)

TEST_DB_FILE = "./test_analysis_phase6.db"
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
    """Initializes and tears down an isolated SQLite database for Phase 6 tests."""
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


# ===========================================================================
# Section 1: Enums & DecisionSupportResult Schema
# ===========================================================================

def test_decision_priority_enum_values():
    """Verifies all required DecisionPriority values exist and match specifications."""
    assert DecisionPriority.LOW.value == "low"
    assert DecisionPriority.MEDIUM.value == "medium"
    assert DecisionPriority.HIGH.value == "high"
    assert DecisionPriority.CRITICAL.value == "critical"
    assert str(DecisionPriority.HIGH) == "DecisionPriority.HIGH" or DecisionPriority.HIGH == "high"


def test_recommended_tone_enum_values():
    """Verifies all required RecommendedTone values exist."""
    assert RecommendedTone.EMPATHETIC.value == "empathetic"
    assert RecommendedTone.REASSURING.value == "reassuring"
    assert RecommendedTone.CLARIFYING.value == "clarifying"
    assert RecommendedTone.APOLOGETIC.value == "apologetic"
    assert RecommendedTone.PROFESSIONAL.value == "professional"
    assert RecommendedTone.CALM.value == "calm"
    assert RecommendedTone.FIRM.value == "firm"


def test_recommended_action_enum_values():
    """Verifies all required RecommendedAction values exist."""
    assert RecommendedAction.RESOLVE.value == "resolve"
    assert RecommendedAction.CLARIFY.value == "clarify"
    assert RecommendedAction.APOLOGIZE_AND_RESOLVE.value == "apologize_and_resolve"
    assert RecommendedAction.PROVIDE_STATUS.value == "provide_status"
    assert RecommendedAction.PROVIDE_INSTRUCTIONS.value == "provide_instructions"
    assert RecommendedAction.OFFER_OPTIONS.value == "offer_options"
    assert RecommendedAction.ESCALATE.value == "escalate"


def test_customer_need_enum_values():
    """Verifies all required CustomerNeed values exist."""
    assert CustomerNeed.REFUND_REQUEST.value == "refund_request"
    assert CustomerNeed.CANCELLATION_REQUEST.value == "cancellation_request"
    assert CustomerNeed.DELIVERY_RESOLUTION.value == "delivery_resolution"
    assert CustomerNeed.PAYMENT_RESOLUTION.value == "payment_resolution"
    assert CustomerNeed.ACCOUNT_ASSISTANCE.value == "account_assistance"
    assert CustomerNeed.COMPLAINT_RESOLUTION.value == "complaint_resolution"
    assert CustomerNeed.RETURN_OR_EXCHANGE.value == "return_or_exchange"
    assert CustomerNeed.INFORMATION_REQUEST.value == "information_request"


def test_decision_support_result_validation():
    """Verifies DecisionSupportResult instantiation and field validation."""
    result = DecisionSupportResult(
        priority=DecisionPriority.HIGH,
        recommended_tone=RecommendedTone.EMPATHETIC,
        recommended_action=RecommendedAction.RESOLVE,
        escalation_recommended=False,
        risk_flags=["high_frustration", "negative_sentiment"],
        customer_needs=[CustomerNeed.REFUND_REQUEST],
        rationale="Customer requested refund with high frustration.",
        confidence=0.88,
        session_id=10,
        turn_number=2
    )
    assert result.priority == DecisionPriority.HIGH
    assert result.confidence == 0.88
    assert result.session_id == 10
    assert result.turn_number == 2
    assert "high_frustration" in result.risk_flags
    assert result.customer_needs == [CustomerNeed.REFUND_REQUEST]

    dumped = result.model_dump()
    assert dumped["priority"] == "high"
    assert dumped["recommended_tone"] == "empathetic"
    assert dumped["recommended_action"] == "resolve"


def test_decision_support_result_defaults():
    """Verifies default list factories for risk_flags and customer_needs."""
    result = DecisionSupportResult(
        priority=DecisionPriority.LOW,
        recommended_tone=RecommendedTone.PROFESSIONAL,
        recommended_action=RecommendedAction.PROVIDE_INSTRUCTIONS,
        escalation_recommended=False,
        rationale="General inquiry handled normally.",
        confidence=0.95
    )
    assert result.risk_flags == []
    assert result.customer_needs == []
    assert result.session_id is None
    assert result.turn_number is None


def test_decision_support_result_confidence_bounds():
    """Verifies confidence must be between 0.0 and 1.0."""
    with pytest.raises(Exception):
        DecisionSupportResult(
            priority=DecisionPriority.LOW,
            recommended_tone=RecommendedTone.PROFESSIONAL,
            recommended_action=RecommendedAction.RESOLVE,
            escalation_recommended=False,
            rationale="Test out of bounds",
            confidence=1.5
        )


# ===========================================================================
# Section 2: Customer Need Mapping
# ===========================================================================

def test_map_customer_needs_refund():
    needs = map_customer_needs(CustomerIntent.REFUND)
    assert needs == [CustomerNeed.REFUND_REQUEST]


def test_map_customer_needs_cancellation():
    needs = map_customer_needs(CustomerIntent.CANCELLATION)
    assert needs == [CustomerNeed.CANCELLATION_REQUEST]


def test_map_customer_needs_delivery():
    needs = map_customer_needs(CustomerIntent.DELIVERY_ISSUE)
    assert needs == [CustomerNeed.DELIVERY_RESOLUTION]


def test_map_customer_needs_payment():
    needs = map_customer_needs(CustomerIntent.PAYMENT_ISSUE)
    assert needs == [CustomerNeed.PAYMENT_RESOLUTION]


def test_map_customer_needs_account():
    needs = map_customer_needs(CustomerIntent.ACCOUNT_ISSUE)
    assert needs == [CustomerNeed.ACCOUNT_ASSISTANCE]


def test_map_customer_needs_complaint():
    needs = map_customer_needs(CustomerIntent.COMPLAINT)
    assert needs == [CustomerNeed.COMPLAINT_RESOLUTION]


def test_map_customer_needs_return():
    needs = map_customer_needs(CustomerIntent.RETURN_EXCHANGE)
    assert needs == [CustomerNeed.RETURN_OR_EXCHANGE]


def test_map_customer_needs_general_inquiry():
    needs = map_customer_needs(CustomerIntent.GENERAL_INQUIRY)
    assert needs == [CustomerNeed.INFORMATION_REQUEST]


def test_map_customer_needs_unmapped_fallback():
    needs = map_customer_needs("unknown_intent")
    assert needs == [CustomerNeed.INFORMATION_REQUEST]


# ===========================================================================
# Section 3: Priority Determination
# ===========================================================================

def test_determine_priority_critical():
    """High escalation risk + high frustration (>=8) produces CRITICAL priority."""
    analysis = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.ANGRY,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=9,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.HIGH,
        confidence=0.9
    )
    assert determine_priority(analysis) == DecisionPriority.CRITICAL


def test_determine_priority_high_from_escalation_risk():
    """High escalation risk alone produces HIGH priority."""
    analysis = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=6,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.HIGH,
        confidence=0.85
    )
    assert determine_priority(analysis) == DecisionPriority.HIGH


def test_determine_priority_high_from_frustration():
    """Severe frustration (>=8) produces HIGH priority."""
    analysis = AnalysisResult(
        intent=CustomerIntent.COMPLAINT,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=8,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.MEDIUM,
        confidence=0.85
    )
    assert determine_priority(analysis) == DecisionPriority.HIGH


def test_determine_priority_high_from_angry_emotion():
    """Angry emotion produces HIGH priority."""
    analysis = AnalysisResult(
        intent=CustomerIntent.DELIVERY_ISSUE,
        emotion=CustomerEmotion.ANGRY,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=6,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.MEDIUM,
        confidence=0.85
    )
    assert determine_priority(analysis) == DecisionPriority.HIGH


def test_determine_priority_high_from_history():
    """History with >= 2 negative sentiment turns elevates priority to HIGH."""
    analysis = AnalysisResult(
        intent=CustomerIntent.GENERAL_INQUIRY,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=4,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.85
    )
    history = [
        TurnAnalysis(
            turn=1,
            intent=CustomerIntent.COMPLAINT,
            emotion=CustomerEmotion.FRUSTRATED,
            sentiment=CustomerSentiment.NEGATIVE,
            frustration_level=6,
            satisfaction_trend=SatisfactionTrend.DECLINING,
            escalation_risk=EscalationRisk.MEDIUM,
            confidence=0.8
        ),
        TurnAnalysis(
            turn=2,
            intent=CustomerIntent.COMPLAINT,
            emotion=CustomerEmotion.WORRIED,
            sentiment=CustomerSentiment.NEGATIVE,
            frustration_level=5,
            satisfaction_trend=SatisfactionTrend.DECLINING,
            escalation_risk=EscalationRisk.LOW,
            confidence=0.8
        ),
    ]
    assert determine_priority(analysis, history=history) == DecisionPriority.HIGH


def test_determine_priority_medium():
    """Moderate frustration (5-7) or worried emotion produces MEDIUM priority."""
    analysis = AnalysisResult(
        intent=CustomerIntent.DELIVERY_ISSUE,
        emotion=CustomerEmotion.WORRIED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=5,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.88
    )
    assert determine_priority(analysis) == DecisionPriority.MEDIUM


def test_determine_priority_low():
    """Low frustration, low escalation risk, and positive/neutral sentiment produces LOW."""
    analysis = AnalysisResult(
        intent=CustomerIntent.GENERAL_INQUIRY,
        emotion=CustomerEmotion.HAPPY,
        sentiment=CustomerSentiment.POSITIVE,
        frustration_level=1,
        satisfaction_trend=SatisfactionTrend.IMPROVING,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.95
    )
    assert determine_priority(analysis) == DecisionPriority.LOW


# ===========================================================================
# Section 4: Recommended Tone Determination
# ===========================================================================

def test_recommended_tone_apologetic_for_complaint_with_high_frustration():
    analysis = AnalysisResult(
        intent=CustomerIntent.COMPLAINT,
        emotion=CustomerEmotion.ANGRY,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=8,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.HIGH,
        confidence=0.9
    )
    assert determine_recommended_tone(analysis) == RecommendedTone.APOLOGETIC


def test_recommended_tone_calm_for_severe_frustration():
    analysis = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.ANGRY,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=8,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.MEDIUM,
        confidence=0.9
    )
    assert determine_recommended_tone(analysis) == RecommendedTone.CALM


def test_recommended_tone_empathetic_for_frustrated_customer():
    analysis = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=6,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.MEDIUM,
        confidence=0.85
    )
    assert determine_recommended_tone(analysis) == RecommendedTone.EMPATHETIC


def test_recommended_tone_reassuring_for_worried():
    analysis = AnalysisResult(
        intent=CustomerIntent.DELIVERY_ISSUE,
        emotion=CustomerEmotion.WORRIED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=4,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.88
    )
    assert determine_recommended_tone(analysis) == RecommendedTone.REASSURING


def test_recommended_tone_clarifying_for_confused():
    analysis = AnalysisResult(
        intent=CustomerIntent.ACCOUNT_ISSUE,
        emotion=CustomerEmotion.CONFUSED,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=3,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.85
    )
    assert determine_recommended_tone(analysis) == RecommendedTone.CLARIFYING


def test_recommended_tone_professional_for_satisfied():
    analysis = AnalysisResult(
        intent=CustomerIntent.GENERAL_INQUIRY,
        emotion=CustomerEmotion.SATISFIED,
        sentiment=CustomerSentiment.POSITIVE,
        frustration_level=1,
        satisfaction_trend=SatisfactionTrend.IMPROVING,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.92
    )
    assert determine_recommended_tone(analysis) == RecommendedTone.PROFESSIONAL


def test_recommended_tone_professional_for_neutral():
    analysis = AnalysisResult(
        intent=CustomerIntent.GENERAL_INQUIRY,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=2,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.9
    )
    assert determine_recommended_tone(analysis) == RecommendedTone.PROFESSIONAL


# ===========================================================================
# Section 5: Recommended Action Determination
# ===========================================================================

def test_recommended_action_escalate_on_high_risk():
    analysis = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.ANGRY,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=7,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.HIGH,
        confidence=0.9
    )
    assert determine_recommended_action(analysis) == RecommendedAction.ESCALATE


def test_recommended_action_escalate_on_extreme_frustration():
    analysis = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=9,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.MEDIUM,
        confidence=0.9
    )
    assert determine_recommended_action(analysis) == RecommendedAction.ESCALATE


def test_recommended_action_apologize_and_resolve_for_complaint():
    analysis = AnalysisResult(
        intent=CustomerIntent.COMPLAINT,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=6,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.MEDIUM,
        confidence=0.85
    )
    assert determine_recommended_action(analysis) == RecommendedAction.APOLOGIZE_AND_RESOLVE


def test_recommended_action_provide_status_for_delivery():
    analysis = AnalysisResult(
        intent=CustomerIntent.DELIVERY_ISSUE,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=3,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.88
    )
    assert determine_recommended_action(analysis) == RecommendedAction.PROVIDE_STATUS


def test_recommended_action_provide_instructions_for_payment():
    analysis = AnalysisResult(
        intent=CustomerIntent.PAYMENT_ISSUE,
        emotion=CustomerEmotion.CONFUSED,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=4,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.88
    )
    assert determine_recommended_action(analysis) == RecommendedAction.PROVIDE_INSTRUCTIONS


def test_recommended_action_clarify_for_account():
    analysis = AnalysisResult(
        intent=CustomerIntent.ACCOUNT_ISSUE,
        emotion=CustomerEmotion.CONFUSED,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=3,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.85
    )
    assert determine_recommended_action(analysis) == RecommendedAction.CLARIFY


def test_recommended_action_offer_options_for_return():
    analysis = AnalysisResult(
        intent=CustomerIntent.RETURN_EXCHANGE,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=2,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.9
    )
    assert determine_recommended_action(analysis) == RecommendedAction.OFFER_OPTIONS


def test_recommended_action_resolve_for_refund():
    analysis = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=3,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.9
    )
    assert determine_recommended_action(analysis) == RecommendedAction.RESOLVE


# ===========================================================================
# Section 6: Risk Flags Extraction
# ===========================================================================

def test_risk_flags_frustration_levels():
    analysis_critical = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.ANGRY,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=9,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.HIGH,
        confidence=0.9
    )
    flags = collect_risk_flags(analysis_critical)
    assert "critical_frustration" in flags
    assert "high_frustration" not in flags  # exclusive branch

    analysis_high = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.FRUSTRATED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=7,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.9
    )
    flags2 = collect_risk_flags(analysis_high)
    assert "high_frustration" in flags2
    assert "critical_frustration" not in flags2


def test_risk_flags_emotion_and_sentiment():
    analysis = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.ANGRY,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=5,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.9
    )
    flags = collect_risk_flags(analysis)
    assert "angry_customer" in flags
    assert "negative_sentiment" in flags


def test_risk_flags_escalation_risk():
    analysis_high = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=2,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.HIGH,
        confidence=0.9
    )
    assert "high_escalation_risk" in collect_risk_flags(analysis_high)

    analysis_med = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=2,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.MEDIUM,
        confidence=0.9
    )
    assert "medium_escalation_risk" in collect_risk_flags(analysis_med)


def test_risk_flags_declining_and_low_confidence():
    analysis = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.NEUTRAL,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=2,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.62
    )
    flags = collect_risk_flags(analysis)
    assert "declining_satisfaction" in flags
    assert "low_analysis_confidence" in flags


def test_risk_flags_history_and_deduplication():
    analysis = AnalysisResult(
        intent=CustomerIntent.COMPLAINT,
        emotion=CustomerEmotion.ANGRY,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=8,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.HIGH,
        confidence=0.8
    )
    history = [
        TurnAnalysis(
            turn=1,
            intent=CustomerIntent.COMPLAINT,
            emotion=CustomerEmotion.FRUSTRATED,
            sentiment=CustomerSentiment.NEGATIVE,
            frustration_level=6,
            satisfaction_trend=SatisfactionTrend.DECLINING,
            escalation_risk=EscalationRisk.MEDIUM,
            confidence=0.8
        ),
        TurnAnalysis(
            turn=2,
            intent=CustomerIntent.COMPLAINT,
            emotion=CustomerEmotion.FRUSTRATED,
            sentiment=CustomerSentiment.NEGATIVE,
            frustration_level=7,
            satisfaction_trend=SatisfactionTrend.DECLINING,
            escalation_risk=EscalationRisk.HIGH,
            confidence=0.8
        ),
    ]
    flags = collect_risk_flags(analysis, history=history)
    assert "repeated_negative_sentiment" in flags
    assert "repeated_complaints" in flags
    assert len(flags) == len(set(flags))  # No duplicates


# ===========================================================================
# Section 7: Full Generation & Determinism
# ===========================================================================

def test_generate_decision_support_complete():
    """Verifies complete generation of DecisionSupportResult with explainable rationale."""
    analysis = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.ANGRY,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=8,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.HIGH,
        confidence=0.91,
        session_id=12,
        turn_number=3
    )
    result = generate_decision_support(analysis)
    assert isinstance(result, DecisionSupportResult)
    assert result.priority == DecisionPriority.CRITICAL
    assert result.recommended_tone in [RecommendedTone.CALM, RecommendedTone.APOLOGETIC]
    assert result.recommended_action == RecommendedAction.ESCALATE
    assert result.escalation_recommended is True
    assert result.customer_needs == [CustomerNeed.REFUND_REQUEST]
    assert result.session_id == 12
    assert result.turn_number == 3
    assert result.confidence == 0.91
    assert "Customer expressed refund" in result.rationale
    assert "escalation risk: high" in result.rationale


def test_generate_decision_support_determinism():
    """Verifies 50 successive runs with identical inputs produce identical outputs."""
    analysis = AnalysisResult(
        intent=CustomerIntent.DELIVERY_ISSUE,
        emotion=CustomerEmotion.WORRIED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=5,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.85,
        session_id=99,
        turn_number=1
    )
    first_res = generate_decision_support(analysis).model_dump()
    for _ in range(50):
        next_res = generate_decision_support(analysis).model_dump()
        assert first_res == next_res


def test_generate_decision_support_polymorphism():
    """Verifies acceptance of TurnAnalysis as well as AnalysisResult."""
    turn_analysis = TurnAnalysis(
        turn=4,
        intent=CustomerIntent.ACCOUNT_ISSUE,
        emotion=CustomerEmotion.CONFUSED,
        sentiment=CustomerSentiment.NEUTRAL,
        frustration_level=3,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.82
    )
    res = generate_decision_support(turn_analysis)
    assert res.turn_number == 4
    assert res.customer_needs == [CustomerNeed.ACCOUNT_ASSISTANCE]
    assert res.recommended_action == RecommendedAction.CLARIFY


# ===========================================================================
# Section 8: API Endpoints & Database Integration
# ===========================================================================

def test_api_decision_support_post(client: TestClient):
    """Verifies POST /analysis/{session_id}/decision-support returns valid response."""
    # 1. Start a session
    start_resp = client.post(
        "/simulator/start",
        json={
            "session_label": "Decision Support Post Test",
            "persona": "frustrated",
            "scenario": "delayed_order",
            "initial_emotion": "frustrated",
            "issue_severity": 3,
            "patience_level": 3,
            "expected_resolution": "Order status provided"
        }
    )
    assert start_resp.status_code == 200
    session_id = start_resp.json()["session_id"]

    # 2. Query decision support
    ds_resp = client.post(f"/analysis/{session_id}/decision-support")
    assert ds_resp.status_code == 200
    data = ds_resp.json()
    assert "priority" in data
    assert "recommended_tone" in data
    assert "recommended_action" in data
    assert "escalation_recommended" in data
    assert "risk_flags" in data
    assert "customer_needs" in data
    assert "rationale" in data
    assert "confidence" in data
    assert data["session_id"] == session_id


def test_api_decision_support_get(client: TestClient):
    """Verifies GET /analysis/{session_id}/decision-support returns valid response."""
    start_resp = client.post(
        "/simulator/start",
        json={
            "session_label": "Decision Support Get Test",
            "persona": "calm",
            "scenario": "account_issue",
            "initial_emotion": "neutral",
            "issue_severity": 2,
            "patience_level": 4,
            "expected_resolution": "Account unlocked"
        }
    )
    assert start_resp.status_code == 200
    session_id = start_resp.json()["session_id"]

    ds_resp = client.get(f"/analysis/{session_id}/decision-support")
    assert ds_resp.status_code == 200
    data = ds_resp.json()
    assert data["session_id"] == session_id
    assert data["customer_needs"] == [CustomerNeed.ACCOUNT_ASSISTANCE.value]


def test_api_decision_support_not_found(client: TestClient):
    """Verifies 404 response on non-existent session ID."""
    resp = client.post("/analysis/999999/decision-support")
    assert resp.status_code == 404
    assert "Simulator session 999999 not found." in resp.json()["detail"]


def test_api_decision_support_fresh_session_baseline(client: TestClient):
    """Verifies decision support on a fresh session with 0 analyzed customer turns."""
    db = TestingSessionLocal()
    try:
        scen = db.query(Scenario).first()
        scen_id = scen.scenario_id if scen else 1
        sess = SimSession(
            scenario_id=scen_id,
            status="In Progress"
        )
        db.add(sess)
        db.commit()
        db.refresh(sess)
        fresh_id = sess.session_id
    finally:
        db.close()

    resp = client.get(f"/analysis/{fresh_id}/decision-support")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert data["session_id"] == fresh_id
    assert data["priority"] == DecisionPriority.LOW.value
    assert data["recommended_tone"] == RecommendedTone.PROFESSIONAL.value
    assert data["escalation_recommended"] is False


def test_api_decision_support_reflects_escalation_turn(client: TestClient):
    """Verifies decision support reflects escalation and urgent actions when customer escalates."""
    start_resp = client.post(
        "/simulator/start",
        json={
            "session_label": "Escalation Turn Test",
            "persona": "angry",
            "scenario": "refund",
            "initial_emotion": "angry",
            "issue_severity": 4,
            "patience_level": 1,
            "expected_resolution": "Immediate refund"
        }
    )
    assert start_resp.status_code == 200
    session_id = start_resp.json()["session_id"]

    # Send a hostile agent message using agent_response
    msg_resp = client.post(
        "/simulator/message",
        json={
            "session_id": session_id,
            "agent_response": "Company policy is strictly non-negotiable and no refund will ever be issued."
        }
    )
    assert msg_resp.status_code == 200

    ds_resp = client.get(f"/analysis/{session_id}/decision-support")
    assert ds_resp.status_code == 200
    data = ds_resp.json()
    assert data["session_id"] == session_id
    assert data["priority"] in [DecisionPriority.HIGH.value, DecisionPriority.CRITICAL.value]
    assert data["escalation_recommended"] is True



# ===========================================================================
# Section 9: Downstream Consumer Simulations
# ===========================================================================

def test_downstream_response_suggestion_agent_simulation():
    """Simulates Response Suggestion Agent consuming DecisionSupportResult."""
    analysis = AnalysisResult(
        intent=CustomerIntent.DELIVERY_ISSUE,
        emotion=CustomerEmotion.WORRIED,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=4,
        satisfaction_trend=SatisfactionTrend.STABLE,
        escalation_risk=EscalationRisk.LOW,
        confidence=0.88,
        session_id=15,
        turn_number=1
    )
    decision = generate_decision_support(analysis)

    # Simulated downstream consumer logic:
    def simulate_response_generator(ds: DecisionSupportResult) -> str:
        if ds.recommended_tone == RecommendedTone.REASSURING:
            prefix = "I understand this is concerning, and I'm here to help."
        else:
            prefix = "Hello, thank you for reaching out."

        if ds.recommended_action == RecommendedAction.PROVIDE_STATUS:
            body = "Let me check the latest shipping updates on your package right away."
        else:
            body = "How can I assist you today?"
        return f"{prefix} {body}"

    suggestion = simulate_response_generator(decision)
    assert "I understand this is concerning" in suggestion
    assert "check the latest shipping updates" in suggestion


def test_downstream_escalation_agent_simulation():
    """Simulates Escalation Agent consuming DecisionSupportResult."""
    analysis = AnalysisResult(
        intent=CustomerIntent.REFUND,
        emotion=CustomerEmotion.ANGRY,
        sentiment=CustomerSentiment.NEGATIVE,
        frustration_level=9,
        satisfaction_trend=SatisfactionTrend.DECLINING,
        escalation_risk=EscalationRisk.HIGH,
        confidence=0.92,
        session_id=20,
        turn_number=3
    )
    decision = generate_decision_support(analysis)

    # Simulated downstream escalation monitor logic:
    def simulate_escalation_monitor(ds: DecisionSupportResult) -> bool:
        if ds.escalation_recommended or ds.priority == DecisionPriority.CRITICAL:
            return True
        return False

    should_page_supervisor = simulate_escalation_monitor(decision)
    assert should_page_supervisor is True
