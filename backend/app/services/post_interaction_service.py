
from typing import Any


def _clean_text(value: Any) -> str:
    return str(value or "").strip()


def generate_post_interaction_summary(
    conversation_history: list[dict[str, Any]],
    intent: str = "Unknown",
    initial_sentiment: str = "Neutral",
    final_sentiment: str = "Neutral",
    resolution_status: str = "Unknown",
    coaching_result: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Generate a structured report for a completed support interaction."""

    messages = [
        item
        for item in conversation_history
        if _clean_text(item.get("message_text"))
    ]

    customer_messages = [
        _clean_text(item.get("message_text"))
        for item in messages
        if _clean_text(item.get("sender_type")).lower()
        in {"customer", "user"}
    ]

    agent_messages = [
        _clean_text(item.get("message_text"))
        for item in messages
        if _clean_text(item.get("sender_type")).lower()
        in {"agent", "support agent", "assistant"}
    ]

    primary_issue = (
        customer_messages[0]
        if customer_messages
        else "No customer message was recorded."
    )

    final_resolution = (
        agent_messages[-1]
        if agent_messages
        else "No support-agent response was recorded."
    )

    coaching_result = coaching_result or {}

    tips = coaching_result.get("coaching_tips", [])
    if not isinstance(tips, list):
        tips = []

    strengths = []

    if agent_messages:
        strengths.append("The agent provided a response.")

    if coaching_result.get("communication_rating") == "Good":
        strengths.append("Communication was rated Good.")

    weaknesses = []

    if not agent_messages:
        weaknesses.append("No agent response was recorded.")

    if resolution_status.lower() not in {"resolved", "success"}:
        weaknesses.append(
            "Resolution is not confirmed; verify the final outcome."
        )

    sentiment_journey = [
        {
            "stage": "Beginning",
            "sentiment": initial_sentiment,
        },
        {
            "stage": "End",
            "sentiment": final_sentiment,
        },
    ]

    # Basic heuristic score, not an AI-verified assessment.
    score = 50

    if agent_messages:
        score += 15

    if resolution_status.lower() in {"resolved", "success"}:
        score += 20

    if coaching_result.get("communication_rating") == "Good":
        score += 15

    quality_score = min(score, 100)

    summary = (
        f"Customer issue: {primary_issue} "
        f"Recorded outcome: {resolution_status}. "
        f"Support response: {final_resolution}"
    )

    return {
        "summary": summary,
        "primary_issue": primary_issue,
        "final_resolution": final_resolution,
        "resolution_status": resolution_status,
        "intent": intent,
        "sentiment_journey": sentiment_journey,
        "resolution_quality_score": quality_score,
        "score_note": (
            "Baseline heuristic score. A validated evaluation rubric "
            "and conversation-level evidence are needed for production."
        ),
        "agent_strengths": strengths,
        "agent_weaknesses": weaknesses,
        "coaching_recommendations": [
            _clean_text(tip)
            for tip in tips
            if _clean_text(tip)
        ],
        "message_count": len(messages),
    }
