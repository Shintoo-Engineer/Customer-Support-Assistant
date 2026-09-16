"""Persona service providing customer personality profiles and tone configurations."""

PERSONAS = {
    "calm": {
        "tone": (
            "Speaks in measured, complete, and articulate sentences. "
            "Uses neutral, balanced vocabulary, polite punctuation, and avoids exclamation "
            "marks or emotional language. Remains objective and cooperative."
        ),
        "escalation_tendency": "low",
        "sample_phrases": [
            "I would appreciate some clarification on this recent charge.",
            "Let's see what steps we need to take to sort this out.",
            "I understand these things happen, please let me know the next step."
        ]
    },
    "confused": {
        "tone": (
            "Uses hesitant, questioning sentences with question marks and ellipses. "
            "May repeat misunderstandings or mix up terminology. Expresses uncertainty "
            "about instructions and frequently asks for reassurance."
        ),
        "escalation_tendency": "medium",
        "sample_phrases": [
            "Wait, I don't understand... was I supposed to get an email confirmation?",
            "I'm really not sure where to look for that code you mentioned.",
            "Sorry, does this mean my order didn't go through, or is it already shipped?"
        ]
    },
    "frustrated": {
        "tone": (
            "Speaks with an exasperated and tense tone. Uses pointed rhetorical questions, "
            "dashes, and sighs. Frequently mentions wasted time, previous failed attempts, "
            "or unmet expectations."
        ),
        "escalation_tendency": "medium",
        "sample_phrases": [
            "I've already explained this twice to previous agents.",
            "This is taking way longer than it should, and I really don't have time for this.",
            "Why is it so difficult to get a straight answer regarding my account?"
        ]
    },
    "angry": {
        "tone": (
            "Speaks in aggressive, short, clipped sentences with sharp language, exclamation "
            "marks, and occasional capitalized words. Demands immediate actions, expresses "
            "indignation, and threatens escalation or negative reviews."
        ),
        "escalation_tendency": "high",
        "sample_phrases": [
            "This is completely unacceptable! Fix this right NOW.",
            "I am NOT paying for a mistake YOUR system made.",
            "Get me your manager immediately if you can't resolve this."
        ]
    },
    "impatient": {
        "tone": (
            "Speaks in rushed, brief, and concise sentences. Uses prompt words like 'quickly', "
            "'ASAP', and 'hurry'. Cuts straight to the point, dislikes long explanations or small "
            "talk, and focuses strictly on resolution time."
        ),
        "escalation_tendency": "high",
        "sample_phrases": [
            "I need this resolved ASAP, I have a meeting in 5 minutes.",
            "Can we skip the pleasantries and just get to the point?",
            "Just tell me how long this is going to take."
        ]
    },
    "polite": {
        "tone": (
            "Speaks in warm, courteous, and respectful sentences. Uses pleasantries ('please', "
            "'thank you', 'I hope you are having a nice day'), soft modal verbs ('could you', "
            "'would it be possible'), and positive phrasing even when raising an issue."
        ),
        "escalation_tendency": "low",
        "sample_phrases": [
            "Hello, thank you for your time today. Could you please help me check on this?",
            "I would really appreciate any assistance you could provide with my account.",
            "Thank you so much for looking into this for me, I really appreciate your patience."
        ]
    }
}


def get_persona_brief(persona_name: str) -> str:
    """Returns a formatted plain-text paragraph describing the customer persona.

    Args:
        persona_name: The name of the persona (calm, confused, frustrated, angry,
          impatient, polite).

    Returns:
        Formatted string ready for inclusion in LLM prompts.

    Raises:
        ValueError: If persona_name is not one of the supported personas.
    """
    key = persona_name.strip().lower()
    if key not in PERSONAS:
        valid_personas = ", ".join(sorted(PERSONAS.keys()))
        raise ValueError(
            f"Invalid persona '{persona_name}'. Must be one of: {valid_personas}"
        )

    persona = PERSONAS[key]
    sample_phrases_text = " | ".join(f'"{phrase}"' for phrase in persona["sample_phrases"])

    return (
        f"Customer Persona: {key.capitalize()}\n"
        f"Tone: {persona['tone']}\n"
        f"Escalation Tendency: {persona['escalation_tendency'].capitalize()}\n"
        f"Sample Phrases: {sample_phrases_text}"
    )
