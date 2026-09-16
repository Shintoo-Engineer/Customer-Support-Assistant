"""Simulator service orchestrating customer simulation turns, prompt assembly, and state updates."""

import re

from app.services.rag_service import generate_with_gemini
from app.services.persona_service import get_persona_brief, PERSONAS
from app.services.scenario_service import get_scenario_brief
from app.services.simulator_state import (
    initial_state,
    update_state,
    is_resolved,
    is_escalated,
)


def _format_conversation_history(conversation_history) -> str:
    """Formats conversation history into human-readable customer/agent turns."""
    if not conversation_history:
        return "No previous messages."

    if isinstance(conversation_history, str):
        return conversation_history.strip()

    formatted_turns = []
    for item in conversation_history:
        if isinstance(item, dict):
            sender = (
                item.get("sender_type")
                or item.get("sender")
                or item.get("role")
                or "Unknown"
            )
            text = (
                item.get("message_text")
                or item.get("text")
                or item.get("content")
                or item.get("message")
                or ""
            )

            sender_lower = str(sender).lower()
            if any(k in sender_lower for k in ["customer", "user"]):
                role_label = "Customer"
            elif any(k in sender_lower for k in ["agent", "support", "assistant"]):
                role_label = "Support Agent"
            elif "ai" in sender_lower or "system" in sender_lower:
                role_label = "AI Suggestion"
            else:
                role_label = str(sender).title()

            formatted_turns.append(f"{role_label}: {text}")
        elif isinstance(item, (list, tuple)) and len(item) >= 2:
            formatted_turns.append(f"{item[0]}: {item[1]}")
        else:
            formatted_turns.append(str(item))

    return "\n".join(formatted_turns)


def _format_state(state: dict) -> str:
    """Formats customer emotional state into a clean text block."""
    if not state:
        return "Unknown"
    return (
        f"- Frustration: {state.get('frustration', 50)}/100\n"
        f"- Trust: {state.get('trust', 50)}/100\n"
        f"- Patience: {state.get('patience', 50)}/100\n"
        f"- Satisfaction: {state.get('satisfaction', 50)}/100\n"
        f"- Escalation Intent: {state.get('escalation_intent', 20)}/100"
    )


def _clean_customer_message(raw_text: str) -> str:
    """Cleans up raw LLM output to extract just the customer message text."""
    if not raw_text:
        return ""

    text = raw_text.strip()

    if text.startswith("```") and text.endswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1]).strip()

    text = re.sub(r"^(?:\[?\s*Customer\s*\]?\s*:\s*)", "", text, flags=re.IGNORECASE).strip()

    if (text.startswith('"') and text.endswith('"')) or (text.startswith("'") and text.endswith("'")):
        text = text[1:-1].strip()

    return text


def build_customer_prompt(
    persona: str,
    scenario: str,
    state: dict,
    conversation_history,
    agent_response: str
) -> str:
    """Assembles a single prompt string for generating the customer's next turn.

    Args:
        persona: Persona name (calm, confused, frustrated, angry, impatient, polite).
        scenario: Scenario type (refund, delayed_order, payment_failure, account_issue, cancellation).
        state: Current emotional state dictionary.
        conversation_history: List or string representation of previous turns.
        agent_response: The latest response provided by the support agent.

    Returns:
        Structured prompt string ready for LLM consumption.
    """
    persona_brief = get_persona_brief(persona)
    scenario_brief = get_scenario_brief(scenario)
    state_text = _format_state(state)
    history_text = _format_conversation_history(conversation_history)
    latest_agent_message = (agent_response or "").strip() or "(No response provided yet)"

    prompt = f"""You are simulating a customer in a customer support training exercise.

=== CUSTOMER PROFILE ===
{persona_brief}

=== SCENARIO DETAILS ===
{scenario_brief}

=== CURRENT EMOTIONAL STATE ===
{state_text}

=== CONVERSATION HISTORY ===
{history_text}

=== LATEST SUPPORT AGENT MESSAGE ===
Support Agent: {latest_agent_message}

=== INSTRUCTIONS ===
- Reply ONLY with the customer's next message in this conversation.
- Stay strictly in-character, adhering to the tone, sample phrases style, and escalation tendency of your persona.
- Reflect your current emotional state (frustration, trust, patience, satisfaction, escalation intent) naturally in how you speak.
- Maintain consistency with the scenario facts and prior conversation turns.
- DO NOT include prefixes like "Customer:", quotation marks, greetings if already deep in conversation, meta-commentary, explanations, or JSON formatting.
- Output ONLY the raw customer message text.
"""
    return prompt.strip()


def generate_customer_turn(
    persona: str,
    scenario: str,
    state: dict,
    conversation_history,
    agent_response: str
) -> dict:
    """Generates the next customer turn in the simulation.

    Args:
        persona: Persona name (calm, confused, frustrated, angry, impatient, polite).
        scenario: Scenario type (refund, delayed_order, payment_failure, account_issue, cancellation).
        state: Current customer state dict.
        conversation_history: History of past conversation turns.
        agent_response: Latest message from the support agent.

    Returns:
        Dict with keys:
            - customer_message: str
            - updated_state: dict
            - is_resolved: bool
            - is_escalated: bool
    """
    prompt = build_customer_prompt(
        persona=persona,
        scenario=scenario,
        state=state,
        conversation_history=conversation_history,
        agent_response=agent_response,
    )

    try:
        raw_response = generate_with_gemini(prompt)
        customer_message = _clean_customer_message(raw_response)
        if not customer_message:
            raise ValueError("Empty response received from Gemini.")
    except Exception as e:
        print(f"Error generating customer response via Gemini: {e}")
        persona_key = persona.strip().lower()
        sample_phrases = PERSONAS.get(persona_key, {}).get(
            "sample_phrases",
            ["I see. Please let me know what we can do next."]
        )
        customer_message = sample_phrases[0] if sample_phrases else "I see. Please help me resolve this."

    updated_state = update_state(state, agent_response, persona)

    return {
        "customer_message": customer_message,
        "updated_state": updated_state,
        "is_resolved": is_resolved(updated_state),
        "is_escalated": is_escalated(updated_state),
    }
