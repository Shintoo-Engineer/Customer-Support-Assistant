import re

with open('final_project/RAG-Pipeline-backend/app/services/decision_support_service.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Make sure to import EscalationRiskMonitorResult, EscalationRiskLevel
content = content.replace(
    "from app.schemas.analysis import (",
    "from app.schemas.analysis import (\n    EscalationRiskMonitorResult,\n    EscalationRiskLevel,\n"
)

monitor_func = """
def calculate_escalation_monitor(
    analysis_result: Any,
    risk_flags: List[str]
) -> EscalationRiskMonitorResult:
    \"\"\"Calculates deterministic risk score and level for Phase 2.\"\"\"
    frustration = getattr(analysis_result, "frustration_level", 0)
    sentiment = getattr(analysis_result, "sentiment", None)
    emotion = getattr(analysis_result, "emotion", None)
    trend = getattr(analysis_result, "satisfaction_trend", None)
    
    score = float(frustration * 5)
    factors = [f"Base score from frustration ({frustration}/10)"]
    indicators = []
    
    if hasattr(sentiment, "value"): sentiment = sentiment.value
    if hasattr(emotion, "value"): emotion = emotion.value
    if hasattr(trend, "value"): trend = trend.value
    
    if sentiment == "negative":
        score += 20
        factors.append("+20 for negative sentiment")
        indicators.append("negative sentiment")
    
    if emotion == "angry":
        score += 25
        factors.append("+25 for angry emotion")
        indicators.append("high frustration/anger")
        
    if trend == "declining":
        score += 15
        factors.append("+15 for declining satisfaction trend")
        
    has_supervisor_req = any("supervisor" in f.lower() or "human" in f.lower() for f in risk_flags)
    if has_supervisor_req:
        score += 30
        factors.append("+30 for explicit escalation request")
        indicators.append("requests for a supervisor/human agent")
        
    has_repeated = any("repeat" in f.lower() for f in risk_flags)
    if has_repeated:
        score += 15
        factors.append("+15 for repeated complaints")
        indicators.append("repeated complaints")
        
    if score >= 60 and not has_supervisor_req and (emotion == "angry" or frustration >= 8):
        indicators.append("unresolved issues")
        
    if trend in ["improving", "stable"] and frustration < 3:
        score -= 20
        factors.append("-20 for resolved/improving trend with low frustration")
        
    score = max(0.0, min(100.0, score))
    
    if score < 40:
        level = EscalationRiskLevel.LOW
    elif score < 70:
        level = EscalationRiskLevel.MEDIUM
    elif score < 90:
        level = EscalationRiskLevel.HIGH
    else:
        level = EscalationRiskLevel.CRITICAL
        
    if not indicators:
        indicators.append("Normal interaction")
        
    reasoning = f"The customer exhibits {', '.join(indicators)}. Assigned {level.value} risk due to {len(indicators)} active indicators."
    if score >= 90:
        reasoning = "Critical escalation indicators present: " + ", ".join(indicators) + ". Supervisor intervention recommended."
        
    return EscalationRiskMonitorResult(
        risk_score=score,
        risk_level=level,
        risk_reasoning=reasoning,
        risk_indicators=indicators,
        contributing_factors=factors
    )

"""

content = content.replace("def generate_decision_support(", monitor_func + "def generate_decision_support(")

return_statement_old = """    return DecisionSupportResult(
        priority=priority,
        recommended_tone=tone,
        recommended_action=action,
        escalation_recommended=escalation_recommended,
        risk_flags=risk_flags,
        customer_needs=needs,
        rationale=rationale,
        confidence=round(float(confidence), 2),
        session_id=session_id,
        turn_number=turn_number,
        suggested_response=suggested_response,
        coaching_tips=coaching_tips,
        response_evaluation=response_eval if response_eval is not None else {},
    )"""

return_statement_new = """    escalation_monitor = calculate_escalation_monitor(analysis_result, risk_flags)

    return DecisionSupportResult(
        priority=priority,
        recommended_tone=tone,
        recommended_action=action,
        escalation_recommended=escalation_recommended,
        risk_flags=risk_flags,
        customer_needs=needs,
        rationale=rationale,
        confidence=round(float(confidence), 2),
        session_id=session_id,
        turn_number=turn_number,
        suggested_response=suggested_response,
        coaching_tips=coaching_tips,
        response_evaluation=response_eval if response_eval is not None else {},
        escalation_monitor=escalation_monitor,
    )"""

content = content.replace(return_statement_old, return_statement_new)

with open('final_project/RAG-Pipeline-backend/app/services/decision_support_service.py', 'w', encoding='utf-8') as f:
    f.write(content)
