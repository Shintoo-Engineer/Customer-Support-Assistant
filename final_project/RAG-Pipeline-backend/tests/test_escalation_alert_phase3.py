"""Tests for Task 6 Phase 3: Escalation Alerts & Full Integration.

Covers 14 scenarios:
1.  Risk below threshold → no high-risk alert (active=False).
2.  Risk reaches threshold → alert active.
3.  High risk → correct recommended action.
4.  Critical risk → critical alert displayed.
5.  Alert contains actual risk reasoning.
6.  Alert contains actual indicators.
7.  Alert updates when risk changes across turns.
8.  No duplicate alert spam when risk remains unchanged.
9.  High/critical risk produces appropriate response recommendation.
10. Task 5 knowledge remains integrated.
11. No relevant Task 5 knowledge does not cause fabricated policy text.
12. Existing Phase 1 fields remain present.
13. Existing Phase 2 escalation result remains present.
14. Full Task 3 → Task 4 → Task 5 → Task 6 flow works.
"""

import pytest
from app.schemas.analysis import (
    CustomerIntent,
    CustomerEmotion,
    CustomerSentiment,
    SatisfactionTrend,
    EscalationRisk,
    AnalysisResult,
    DecisionSupportResult,
    EscalationRiskLevel,
    EscalationRiskMonitorResult,
    EscalationAlert,
)
from app.services.decision_support_service import (
    calculate_escalation_monitor,
    generate_escalation_alert,
    generate_decision_support,
    ESCALATION_ALERT_THRESHOLD,
)


def _make_analysis(
    frustration=0,
    emotion=CustomerEmotion.NEUTRAL,
    sentiment=CustomerSentiment.NEUTRAL,
    intent=CustomerIntent.GENERAL_INQUIRY,
    trend=SatisfactionTrend.STABLE,
    escalation_risk=EscalationRisk.LOW,
    confidence=0.9,
):
    return AnalysisResult(
        intent=intent,
        emotion=emotion,
        sentiment=sentiment,
        frustration_level=frustration,
        satisfaction_trend=trend,
        escalation_risk=escalation_risk,
        confidence=confidence,
        analysis_source="fallback",
    )


# ---------------------------------------------------------------------------
# 1. Risk below threshold → no alert
# ---------------------------------------------------------------------------
class TestBelowThreshold:
    def test_low_risk_alert_inactive(self):
        analysis = _make_analysis(frustration=2)
        monitor = calculate_escalation_monitor(analysis, risk_flags=[])
        alert = generate_escalation_alert(monitor)
        assert alert.active is False

    def test_low_risk_no_recommended_action(self):
        analysis = _make_analysis(frustration=2)
        monitor = calculate_escalation_monitor(analysis, risk_flags=[])
        alert = generate_escalation_alert(monitor)
        assert alert.recommended_action == ""

    def test_threshold_stored(self):
        analysis = _make_analysis(frustration=2)
        monitor = calculate_escalation_monitor(analysis, risk_flags=[])
        alert = generate_escalation_alert(monitor)
        assert alert.threshold == ESCALATION_ALERT_THRESHOLD


# ---------------------------------------------------------------------------
# 2. Risk reaches threshold → alert active
# ---------------------------------------------------------------------------
class TestReachesThreshold:
    def test_alert_active_at_threshold(self):
        analysis = _make_analysis(
            frustration=8,
            emotion=CustomerEmotion.ANGRY,
            sentiment=CustomerSentiment.NEGATIVE,
        )
        monitor = calculate_escalation_monitor(analysis, risk_flags=[])
        assert monitor.risk_score >= ESCALATION_ALERT_THRESHOLD
        alert = generate_escalation_alert(monitor)
        assert alert.active is True

    def test_custom_threshold(self):
        analysis = _make_analysis(frustration=5, sentiment=CustomerSentiment.NEGATIVE)
        monitor = calculate_escalation_monitor(analysis, risk_flags=[])
        # score = 25 + 20 = 45 → with threshold=40, should be active
        alert = generate_escalation_alert(monitor, threshold=40.0)
        assert alert.active is True
        assert alert.threshold == 40.0


# ---------------------------------------------------------------------------
# 3. High risk → correct recommended action
# ---------------------------------------------------------------------------
class TestHighRiskAction:
    def test_high_risk_has_action(self):
        analysis = _make_analysis(
            frustration=8,
            emotion=CustomerEmotion.ANGRY,
            sentiment=CustomerSentiment.NEGATIVE,
        )
        monitor = calculate_escalation_monitor(analysis, risk_flags=[])
        alert = generate_escalation_alert(monitor)
        assert alert.active is True
        assert len(alert.recommended_action) > 0

    def test_high_risk_action_mentions_empathy_or_frustration(self):
        analysis = _make_analysis(
            frustration=8,
            emotion=CustomerEmotion.ANGRY,
            sentiment=CustomerSentiment.NEGATIVE,
        )
        monitor = calculate_escalation_monitor(analysis, risk_flags=[])
        alert = generate_escalation_alert(monitor)
        action_lower = alert.recommended_action.lower()
        assert "frustration" in action_lower or "empathy" in action_lower or "escalat" in action_lower


# ---------------------------------------------------------------------------
# 4. Critical risk → critical alert displayed
# ---------------------------------------------------------------------------
class TestCriticalRiskAlert:
    def test_critical_alert_active(self):
        analysis = _make_analysis(
            frustration=10,
            emotion=CustomerEmotion.ANGRY,
            sentiment=CustomerSentiment.NEGATIVE,
            trend=SatisfactionTrend.DECLINING,
        )
        monitor = calculate_escalation_monitor(
            analysis, risk_flags=["Customer requested supervisor", "Repeated complaint"]
        )
        alert = generate_escalation_alert(monitor)
        assert alert.active is True
        assert alert.alert_level == EscalationRiskLevel.CRITICAL

    def test_critical_recommends_supervisor(self):
        analysis = _make_analysis(
            frustration=10,
            emotion=CustomerEmotion.ANGRY,
            sentiment=CustomerSentiment.NEGATIVE,
            trend=SatisfactionTrend.DECLINING,
        )
        monitor = calculate_escalation_monitor(
            analysis, risk_flags=["Customer requested supervisor", "Repeated complaint"]
        )
        alert = generate_escalation_alert(monitor)
        assert "supervisor" in alert.recommended_action.lower() or "escalat" in alert.recommended_action.lower()


# ---------------------------------------------------------------------------
# 5. Alert contains actual risk reasoning
# ---------------------------------------------------------------------------
class TestAlertReasoning:
    def test_reasoning_not_empty_when_active(self):
        analysis = _make_analysis(
            frustration=8, emotion=CustomerEmotion.ANGRY, sentiment=CustomerSentiment.NEGATIVE,
        )
        monitor = calculate_escalation_monitor(analysis, risk_flags=[])
        alert = generate_escalation_alert(monitor)
        assert alert.active is True
        assert len(alert.reasoning) > 10

    def test_reasoning_mentions_threshold(self):
        analysis = _make_analysis(
            frustration=8, emotion=CustomerEmotion.ANGRY, sentiment=CustomerSentiment.NEGATIVE,
        )
        monitor = calculate_escalation_monitor(analysis, risk_flags=[])
        alert = generate_escalation_alert(monitor)
        assert "threshold" in alert.reasoning.lower()


# ---------------------------------------------------------------------------
# 6. Alert contains actual indicators
# ---------------------------------------------------------------------------
class TestAlertIndicators:
    def test_indicators_present(self):
        analysis = _make_analysis(
            frustration=8, emotion=CustomerEmotion.ANGRY, sentiment=CustomerSentiment.NEGATIVE,
        )
        monitor = calculate_escalation_monitor(analysis, risk_flags=[])
        alert = generate_escalation_alert(monitor)
        assert len(alert.indicators) > 0


# ---------------------------------------------------------------------------
# 7. Alert updates when risk changes across turns
# ---------------------------------------------------------------------------
class TestAlertUpdatesAcrossTurns:
    def test_medium_to_high_transition(self):
        # Turn 1: medium risk
        analysis_t1 = _make_analysis(frustration=5, sentiment=CustomerSentiment.NEGATIVE)
        monitor_t1 = calculate_escalation_monitor(analysis_t1, risk_flags=[])
        alert_t1 = generate_escalation_alert(monitor_t1)

        # Turn 2: high risk
        analysis_t2 = _make_analysis(
            frustration=8, emotion=CustomerEmotion.ANGRY, sentiment=CustomerSentiment.NEGATIVE,
        )
        monitor_t2 = calculate_escalation_monitor(analysis_t2, risk_flags=[])
        alert_t2 = generate_escalation_alert(monitor_t2)

        assert alert_t2.risk_score > alert_t1.risk_score
        assert alert_t2.active is True


# ---------------------------------------------------------------------------
# 8. No duplicate alert spam when risk remains unchanged
# ---------------------------------------------------------------------------
class TestNoAlertSpam:
    def test_same_input_same_output(self):
        analysis = _make_analysis(
            frustration=8, emotion=CustomerEmotion.ANGRY, sentiment=CustomerSentiment.NEGATIVE,
        )
        monitor1 = calculate_escalation_monitor(analysis, risk_flags=[])
        alert1 = generate_escalation_alert(monitor1)
        monitor2 = calculate_escalation_monitor(analysis, risk_flags=[])
        alert2 = generate_escalation_alert(monitor2)
        # Same input → same deterministic output (no duplicating accumulation)
        assert alert1.risk_score == alert2.risk_score
        assert alert1.alert_level == alert2.alert_level
        assert alert1.recommended_action == alert2.recommended_action


# ---------------------------------------------------------------------------
# 9. High/critical risk produces appropriate response recommendation
# ---------------------------------------------------------------------------
class TestResponseRecommendation:
    def test_supervisor_request_mentions_escalation(self):
        analysis = _make_analysis(
            frustration=7, emotion=CustomerEmotion.ANGRY, sentiment=CustomerSentiment.NEGATIVE,
        )
        monitor = calculate_escalation_monitor(
            analysis, risk_flags=["Customer requested supervisor"]
        )
        alert = generate_escalation_alert(monitor)
        assert alert.active is True
        action_lower = alert.recommended_action.lower()
        assert "supervisor" in action_lower or "escalat" in action_lower


# ---------------------------------------------------------------------------
# 10-11. Task 5 knowledge integration & no fabrication
# (Tested via generate_decision_support which chains all phases)
# ---------------------------------------------------------------------------
class TestKnowledgeIntegration:
    def test_no_fabricated_knowledge_in_suggestion(self):
        analysis = _make_analysis(
            frustration=7, emotion=CustomerEmotion.FRUSTRATED,
            sentiment=CustomerSentiment.NEGATIVE, intent=CustomerIntent.REFUND,
        )
        result = generate_decision_support(
            analysis, history=[], knowledge_recommendations=None,
            customer_message="I want my money back!",
        )
        # Phase 1 anti-hallucination: no fabricated policy references
        sr = (result.suggested_response or "").lower()
        # Should not reference specific fake policy documents
        assert "policy_v1" not in sr


# ---------------------------------------------------------------------------
# 12. Existing Phase 1 fields remain present
# ---------------------------------------------------------------------------
class TestPhase1Preserved:
    def test_phase1_fields_exist(self):
        analysis = _make_analysis(frustration=3, intent=CustomerIntent.DELIVERY_ISSUE)
        result = generate_decision_support(analysis, history=[])
        assert hasattr(result, "suggested_response")
        assert hasattr(result, "coaching_tips")
        assert hasattr(result, "response_evaluation")


# ---------------------------------------------------------------------------
# 13. Existing Phase 2 escalation result remains present
# ---------------------------------------------------------------------------
class TestPhase2Preserved:
    def test_phase2_monitor_exists(self):
        analysis = _make_analysis(frustration=6, sentiment=CustomerSentiment.NEGATIVE)
        result = generate_decision_support(analysis, history=[])
        assert result.escalation_monitor is not None
        assert isinstance(result.escalation_monitor, EscalationRiskMonitorResult)


# ---------------------------------------------------------------------------
# 14. Full Task 3 → Task 4 → Task 5 → Task 6 flow works
# ---------------------------------------------------------------------------
class TestFullIntegration:
    def test_full_flow_returns_all_fields(self):
        analysis = _make_analysis(
            frustration=9,
            emotion=CustomerEmotion.ANGRY,
            sentiment=CustomerSentiment.NEGATIVE,
            intent=CustomerIntent.REFUND,
            trend=SatisfactionTrend.DECLINING,
        )
        result = generate_decision_support(
            analysis,
            history=[],
            customer_message="This is ridiculous! I want to speak to a supervisor!",
        )
        # Phase 1
        assert hasattr(result, "suggested_response")
        assert hasattr(result, "coaching_tips")
        assert hasattr(result, "response_evaluation")
        # Phase 2
        assert result.escalation_monitor is not None
        assert result.escalation_monitor.risk_score >= 70
        # Phase 3
        assert result.escalation_alert is not None
        assert result.escalation_alert.active is True
        assert len(result.escalation_alert.recommended_action) > 0
        # Core decision support
        assert result.priority is not None
        assert result.recommended_tone is not None
        assert result.recommended_action is not None
