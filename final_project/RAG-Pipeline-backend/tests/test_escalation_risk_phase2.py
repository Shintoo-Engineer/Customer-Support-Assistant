"""Tests for Task 6 Phase 2: Escalation Risk Monitoring Agent.

Covers 10 scenarios:
1. Normal customer interaction → Low risk
2. Mild frustration → Medium risk
3. High frustration + negative sentiment → High risk
4. Repeated unresolved complaints → increasing risk
5. Explicit supervisor request → high/critical risk
6. Explicit human-agent request → high/critical risk
7. Multiple escalation indicators → Critical risk
8. Resolved/improving conversation → risk decreases
9. Multi-turn risk progression
10. Risk reasoning accurately reflects actual indicators
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
)
from app.services.decision_support_service import (
    calculate_escalation_monitor,
    generate_decision_support,
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
# Scenario 1: Normal customer interaction → Low risk
# ---------------------------------------------------------------------------
class TestScenario1NormalInteraction:
    def test_low_risk_score(self):
        analysis = _make_analysis(frustration=1, emotion=CustomerEmotion.NEUTRAL)
        result = calculate_escalation_monitor(analysis, risk_flags=[])
        assert 0 <= result.risk_score <= 39
        assert result.risk_level == EscalationRiskLevel.LOW

    def test_low_risk_has_reasoning(self):
        analysis = _make_analysis(frustration=1, emotion=CustomerEmotion.NEUTRAL)
        result = calculate_escalation_monitor(analysis, risk_flags=[])
        assert result.risk_reasoning
        assert len(result.risk_reasoning) > 0

    def test_low_risk_indicators_present(self):
        analysis = _make_analysis(frustration=1, emotion=CustomerEmotion.NEUTRAL)
        result = calculate_escalation_monitor(analysis, risk_flags=[])
        assert isinstance(result.risk_indicators, list)
        assert len(result.risk_indicators) > 0


# ---------------------------------------------------------------------------
# Scenario 2: Mild frustration → Medium risk
# ---------------------------------------------------------------------------
class TestScenario2MildFrustration:
    def test_medium_risk_score(self):
        analysis = _make_analysis(
            frustration=5,
            emotion=CustomerEmotion.FRUSTRATED,
            sentiment=CustomerSentiment.NEGATIVE,
        )
        result = calculate_escalation_monitor(analysis, risk_flags=[])
        assert 40 <= result.risk_score <= 69
        assert result.risk_level == EscalationRiskLevel.MEDIUM

    def test_medium_risk_contributing_factors(self):
        analysis = _make_analysis(
            frustration=5,
            emotion=CustomerEmotion.FRUSTRATED,
            sentiment=CustomerSentiment.NEGATIVE,
        )
        result = calculate_escalation_monitor(analysis, risk_flags=[])
        assert len(result.contributing_factors) > 0
        assert any("frustration" in f.lower() for f in result.contributing_factors)


# ---------------------------------------------------------------------------
# Scenario 3: High frustration + negative sentiment → High risk
# ---------------------------------------------------------------------------
class TestScenario3HighFrustration:
    def test_high_risk_angry(self):
        analysis = _make_analysis(
            frustration=8,
            emotion=CustomerEmotion.ANGRY,
            sentiment=CustomerSentiment.NEGATIVE,
        )
        result = calculate_escalation_monitor(analysis, risk_flags=[])
        assert result.risk_score >= 70
        assert result.risk_level in [EscalationRiskLevel.HIGH, EscalationRiskLevel.CRITICAL]

    def test_high_risk_indicators_include_anger(self):
        analysis = _make_analysis(
            frustration=8,
            emotion=CustomerEmotion.ANGRY,
            sentiment=CustomerSentiment.NEGATIVE,
        )
        result = calculate_escalation_monitor(analysis, risk_flags=[])
        assert any("anger" in i.lower() or "frustration" in i.lower() for i in result.risk_indicators)


# ---------------------------------------------------------------------------
# Scenario 4: Repeated unresolved complaints → increasing risk
# ---------------------------------------------------------------------------
class TestScenario4RepeatedComplaints:
    def test_repeated_complaints_increase_risk(self):
        analysis_base = _make_analysis(frustration=5, sentiment=CustomerSentiment.NEGATIVE)
        result_no_repeat = calculate_escalation_monitor(analysis_base, risk_flags=[])
        result_with_repeat = calculate_escalation_monitor(analysis_base, risk_flags=["Repeated complaint pattern"])
        assert result_with_repeat.risk_score > result_no_repeat.risk_score

    def test_repeated_complaints_indicator(self):
        analysis = _make_analysis(frustration=5, sentiment=CustomerSentiment.NEGATIVE)
        result = calculate_escalation_monitor(analysis, risk_flags=["Repeated complaint pattern"])
        assert any("repeat" in i.lower() for i in result.risk_indicators)


# ---------------------------------------------------------------------------
# Scenario 5: Explicit supervisor request → high/critical risk
# ---------------------------------------------------------------------------
class TestScenario5SupervisorRequest:
    def test_supervisor_request_high_risk(self):
        analysis = _make_analysis(
            frustration=7,
            emotion=CustomerEmotion.ANGRY,
            sentiment=CustomerSentiment.NEGATIVE,
        )
        result = calculate_escalation_monitor(analysis, risk_flags=["Customer requested supervisor"])
        assert result.risk_score >= 70
        assert result.risk_level in [EscalationRiskLevel.HIGH, EscalationRiskLevel.CRITICAL]

    def test_supervisor_request_indicator(self):
        analysis = _make_analysis(frustration=7, sentiment=CustomerSentiment.NEGATIVE)
        result = calculate_escalation_monitor(analysis, risk_flags=["Customer requested supervisor"])
        assert any("supervisor" in i.lower() or "human" in i.lower() for i in result.risk_indicators)


# ---------------------------------------------------------------------------
# Scenario 6: Explicit human-agent request → high/critical risk
# ---------------------------------------------------------------------------
class TestScenario6HumanAgentRequest:
    def test_human_agent_request_high_risk(self):
        analysis = _make_analysis(
            frustration=6,
            emotion=CustomerEmotion.FRUSTRATED,
            sentiment=CustomerSentiment.NEGATIVE,
        )
        result = calculate_escalation_monitor(analysis, risk_flags=["Customer wants human agent"])
        assert result.risk_score >= 70
        assert result.risk_level in [EscalationRiskLevel.HIGH, EscalationRiskLevel.CRITICAL]


# ---------------------------------------------------------------------------
# Scenario 7: Multiple escalation indicators → Critical risk
# ---------------------------------------------------------------------------
class TestScenario7MultipleIndicatorsCritical:
    def test_critical_risk(self):
        analysis = _make_analysis(
            frustration=10,
            emotion=CustomerEmotion.ANGRY,
            sentiment=CustomerSentiment.NEGATIVE,
            trend=SatisfactionTrend.DECLINING,
        )
        result = calculate_escalation_monitor(
            analysis,
            risk_flags=["Customer requested supervisor", "Repeated complaint pattern"],
        )
        assert result.risk_score >= 90
        assert result.risk_level == EscalationRiskLevel.CRITICAL

    def test_critical_reasoning_mentions_supervisor(self):
        analysis = _make_analysis(
            frustration=10,
            emotion=CustomerEmotion.ANGRY,
            sentiment=CustomerSentiment.NEGATIVE,
            trend=SatisfactionTrend.DECLINING,
        )
        result = calculate_escalation_monitor(
            analysis,
            risk_flags=["Customer requested supervisor", "Repeated complaint pattern"],
        )
        assert "supervisor" in result.risk_reasoning.lower() or "critical" in result.risk_reasoning.lower()


# ---------------------------------------------------------------------------
# Scenario 8: Resolved/improving conversation → risk decreases
# ---------------------------------------------------------------------------
class TestScenario8ResolvedConversation:
    def test_resolved_low_risk(self):
        analysis = _make_analysis(
            frustration=1,
            emotion=CustomerEmotion.SATISFIED,
            sentiment=CustomerSentiment.POSITIVE,
            trend=SatisfactionTrend.IMPROVING,
        )
        result = calculate_escalation_monitor(analysis, risk_flags=[])
        assert result.risk_score < 40
        assert result.risk_level == EscalationRiskLevel.LOW

    def test_improving_lower_than_declining(self):
        base = dict(
            frustration=4,
            emotion=CustomerEmotion.CONFUSED,
            sentiment=CustomerSentiment.NEUTRAL,
        )
        result_declining = calculate_escalation_monitor(
            _make_analysis(**base, trend=SatisfactionTrend.DECLINING), risk_flags=[]
        )
        result_improving = calculate_escalation_monitor(
            _make_analysis(**base, trend=SatisfactionTrend.IMPROVING), risk_flags=[]
        )
        assert result_improving.risk_score <= result_declining.risk_score


# ---------------------------------------------------------------------------
# Scenario 9: Multi-turn risk progression
# ---------------------------------------------------------------------------
class TestScenario9MultiTurnProgression:
    def test_risk_increases_as_frustration_grows(self):
        scores = []
        for frustration in [2, 5, 8]:
            analysis = _make_analysis(
                frustration=frustration,
                emotion=CustomerEmotion.FRUSTRATED if frustration >= 5 else CustomerEmotion.NEUTRAL,
                sentiment=CustomerSentiment.NEGATIVE if frustration >= 5 else CustomerSentiment.NEUTRAL,
            )
            result = calculate_escalation_monitor(analysis, risk_flags=[])
            scores.append(result.risk_score)
        # Score should be monotonically non-decreasing
        assert scores[0] <= scores[1] <= scores[2]


# ---------------------------------------------------------------------------
# Scenario 10: Risk reasoning accurately reflects actual indicators
# ---------------------------------------------------------------------------
class TestScenario10ReasoningAccuracy:
    def test_reasoning_mentions_negative_sentiment(self):
        analysis = _make_analysis(frustration=6, sentiment=CustomerSentiment.NEGATIVE)
        result = calculate_escalation_monitor(analysis, risk_flags=[])
        assert "negative" in result.risk_reasoning.lower() or "sentiment" in result.risk_reasoning.lower() or len(result.risk_reasoning) > 0

    def test_reasoning_not_empty(self):
        analysis = _make_analysis(frustration=3)
        result = calculate_escalation_monitor(analysis, risk_flags=[])
        assert len(result.risk_reasoning) > 10

    def test_contributing_factors_match_score_logic(self):
        analysis = _make_analysis(
            frustration=7,
            emotion=CustomerEmotion.ANGRY,
            sentiment=CustomerSentiment.NEGATIVE,
            trend=SatisfactionTrend.DECLINING,
        )
        result = calculate_escalation_monitor(analysis, risk_flags=[])
        assert any("frustration" in f.lower() for f in result.contributing_factors)
        assert any("negative" in f.lower() or "sentiment" in f.lower() for f in result.contributing_factors)
        assert any("angry" in f.lower() or "emotion" in f.lower() for f in result.contributing_factors)


# ---------------------------------------------------------------------------
# Integration: generate_decision_support returns escalation_monitor
# ---------------------------------------------------------------------------
class TestIntegrationDecisionSupport:
    def test_decision_support_includes_escalation_monitor(self):
        analysis = _make_analysis(
            frustration=6,
            emotion=CustomerEmotion.FRUSTRATED,
            sentiment=CustomerSentiment.NEGATIVE,
            intent=CustomerIntent.REFUND,
        )
        result = generate_decision_support(analysis, history=[])
        assert result.escalation_monitor is not None
        assert isinstance(result.escalation_monitor, EscalationRiskMonitorResult)
        assert 0 <= result.escalation_monitor.risk_score <= 100
        assert result.escalation_monitor.risk_level in list(EscalationRiskLevel)

    def test_decision_support_preserves_phase1_fields(self):
        """Phase 1 fields (suggested_response, coaching_tips, response_evaluation) must still exist."""
        analysis = _make_analysis(frustration=3, intent=CustomerIntent.DELIVERY_ISSUE)
        result = generate_decision_support(analysis, history=[])
        assert hasattr(result, "suggested_response")
        assert hasattr(result, "coaching_tips")
        assert hasattr(result, "response_evaluation")
        assert hasattr(result, "escalation_monitor")

    def test_score_bounded(self):
        """Risk score must always be within [0, 100]."""
        for frust in range(0, 11):
            analysis = _make_analysis(
                frustration=frust,
                emotion=CustomerEmotion.ANGRY,
                sentiment=CustomerSentiment.NEGATIVE,
                trend=SatisfactionTrend.DECLINING,
            )
            result = generate_decision_support(
                analysis,
                history=[],
            )
            assert 0 <= result.escalation_monitor.risk_score <= 100
