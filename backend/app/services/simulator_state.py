"""Simulator state engine for tracking customer emotional and resolution states."""

from app.services.persona_service import PERSONAS

EMPATHY_SIGNALS = [
    "understand",
    "sorry",
    "apologize",
    "apologies",
    "let me help",
    "happy to help",
    "right away",
    "refund",
    "resolved",
    "i can fix",
    "i will fix",
    "certainly",
    "absolutely",
    "thank you for your patience",
    "i appreciate",
    "let me check",
    "let me look into",
    "i'm on it",
    "replacement",
    "credit",
]

DISMISSIVE_SIGNALS = [
    "can't help",
    "cannot help",
    "not possible",
    "policy doesn't allow",
    "against our policy",
    "nothing i can do",
    "not my problem",
    "not our fault",
    "contact someone else",
    "call your bank",
    "you should have",
    "your fault",
    "calm down",
    "read the terms",
    "deal with it",
]

PERSONA_MULTIPLIERS = {
    "low": 0.7,
    "medium": 1.0,
    "high": 1.5,
}


def _clamp(value: float) -> int:
    """Clamps a numerical value to an integer within [0, 100]."""
    return max(0, min(100, int(round(value))))


def initial_state(
    persona: str,
    initial_emotion: str,
    issue_severity: int,
    patience_level: int
) -> dict:
    """Builds an initial customer state dict from configuration parameters.

    Args:
        persona: Persona name (calm, confused, frustrated, angry, impatient, polite).
        initial_emotion: Starting emotional state label.
        issue_severity: Severity score from 1 (minor) to 5 (critical).
        patience_level: Patience score from 1 (very low) to 5 (very high).

    Returns:
        A dictionary with integer values [0, 100] for frustration, trust,
        patience, satisfaction, and escalation_intent.
    """
    severity = max(1, min(5, issue_severity))
    patience_input = max(1, min(5, patience_level))

    base_frustration = 20 + (severity - 1) * 15
    base_escalation = 10 + (severity - 1) * 12
    base_patience = patience_input * 20
    base_trust = 60 - (severity * 5)
    base_satisfaction = 40 - (severity * 5)

    emotion_key = initial_emotion.strip().lower()
    if "angry" in emotion_key:
        base_frustration += 25
        base_escalation += 25
        base_patience -= 20
        base_trust -= 15
        base_satisfaction -= 15
    elif "frustrated" in emotion_key:
        base_frustration += 15
        base_escalation += 15
        base_patience -= 10
        base_trust -= 10
        base_satisfaction -= 10
    elif "impatient" in emotion_key:
        base_frustration += 10
        base_escalation += 15
        base_patience -= 25
    elif "confused" in emotion_key:
        base_frustration += 5
        base_escalation += 5
        base_trust -= 5
    elif "calm" in emotion_key:
        base_frustration -= 10
        base_escalation -= 10
        base_patience += 15
        base_trust += 10
        base_satisfaction += 10
    elif "polite" in emotion_key:
        base_frustration -= 15
        base_escalation -= 15
        base_patience += 20
        base_trust += 15
        base_satisfaction += 15

    persona_key = persona.strip().lower()
    escalation_tendency = PERSONAS.get(persona_key, {}).get("escalation_tendency", "medium")
    if escalation_tendency == "high":
        base_frustration += 10
        base_escalation += 10
        base_patience -= 10
    elif escalation_tendency == "low":
        base_frustration -= 5
        base_escalation -= 5
        base_patience += 10

    return {
        "frustration": _clamp(base_frustration),
        "trust": _clamp(base_trust),
        "patience": _clamp(base_patience),
        "satisfaction": _clamp(base_satisfaction),
        "escalation_intent": _clamp(base_escalation),
    }


def update_state(current_state: dict, agent_response: str, persona: str) -> dict:
    """Updates customer emotional state based on agent response and persona.

    Args:
        current_state: Dict containing frustration, trust, patience, satisfaction,
          and escalation_intent.
        agent_response: Text message sent by the agent.
        persona: Persona name to determine escalation tendency multiplier.

    Returns:
        A new dict with updated integer values [0, 100].
    """
    persona_key = persona.strip().lower()
    escalation_tendency = PERSONAS.get(persona_key, {}).get("escalation_tendency", "medium")
    multiplier = PERSONA_MULTIPLIERS.get(escalation_tendency, 1.0)

    text = (agent_response or "").lower().strip()
    words = text.split()

    empathy_matches = sum(1 for signal in EMPATHY_SIGNALS if signal in text)
    dismissive_matches = sum(1 for signal in DISMISSIVE_SIGNALS if signal in text)
    is_too_short = len(words) > 0 and len(words) < 4

    delta_frustration = 0.0
    delta_trust = 0.0
    delta_patience = 0.0
    delta_satisfaction = 0.0
    delta_escalation = 0.0

    if empathy_matches > 0:
        factor = min(3, empathy_matches)
        delta_frustration -= (12.0 * factor)
        delta_trust += (10.0 * factor)
        delta_patience += (6.0 * factor)
        delta_satisfaction += (12.0 * factor)
        delta_escalation -= (10.0 * factor)

    if dismissive_matches > 0:
        factor = min(3, dismissive_matches)
        delta_frustration += (18.0 * factor * multiplier)
        delta_trust -= (14.0 * factor * multiplier)
        delta_patience -= (16.0 * factor * multiplier)
        delta_satisfaction -= (12.0 * factor * multiplier)
        delta_escalation += (20.0 * factor * multiplier)

    if is_too_short and dismissive_matches == 0:
        delta_frustration += (10.0 * multiplier)
        delta_trust -= (8.0 * multiplier)
        delta_patience -= (10.0 * multiplier)
        delta_escalation += (12.0 * multiplier)

    if empathy_matches == 0 and dismissive_matches == 0 and not is_too_short:
        if len(words) >= 4:
            delta_frustration -= 3.0
            delta_trust += 3.0
            delta_patience -= 2.0
            delta_satisfaction += 3.0
            delta_escalation -= 2.0

    return {
        "frustration": _clamp(current_state.get("frustration", 50) + delta_frustration),
        "trust": _clamp(current_state.get("trust", 50) + delta_trust),
        "patience": _clamp(current_state.get("patience", 50) + delta_patience),
        "satisfaction": _clamp(current_state.get("satisfaction", 50) + delta_satisfaction),
        "escalation_intent": _clamp(current_state.get("escalation_intent", 20) + delta_escalation),
    }


def is_resolved(state: dict) -> bool:
    """Returns True if the customer state satisfies the resolution condition."""
    return state.get("satisfaction", 0) >= 75 and state.get("frustration", 100) <= 25


def is_escalated(state: dict) -> bool:
    """Returns True if the customer state indicates escalation."""
    return state.get("escalation_intent", 0) >= 85
