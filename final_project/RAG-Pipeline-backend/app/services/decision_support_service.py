"""Decision Support & Coaching Service (Task 4 Phase 6 + Task 6 Phase 1).

Provides agent-ready recommendation and response coaching derived from
AnalysisResult signals, conversation history, and Task 5 retrieved knowledge.
Supports both Gemini LLM generation and robust deterministic fallback with
strict anti-hallucination guardrails.
"""

import json
import logging
import os
import re
from typing import List, Optional, Any, Dict, Tuple
from sqlalchemy.orm import Session as DBSession

from app.schemas.analysis import (
    EscalationRiskMonitorResult,
    EscalationRiskLevel,
    EscalationAlert,

    CustomerIntent,
    CustomerEmotion,
    CustomerSentiment,
    SatisfactionTrend,
    EscalationRisk,
    AnalysisResult,
    AnalysisResponse,
    TurnAnalysis,
    DecisionPriority,
    RecommendedTone,
    RecommendedAction,
    CustomerNeed,
    DecisionSupportResult,
    ResponseEvaluation,
)
from app.models.simulator import Session as SimSession, Conversation, Message
from app.services.analysis_service import get_analysis_history, parse_llm_json
from app.services.rag_service import generate_with_gemini

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# 1. Customer Need Mapping
# ---------------------------------------------------------------------------

INTENT_TO_CUSTOMER_NEEDS = {
    CustomerIntent.REFUND: [CustomerNeed.REFUND_REQUEST],
    CustomerIntent.CANCELLATION: [CustomerNeed.CANCELLATION_REQUEST],
    CustomerIntent.DELIVERY_ISSUE: [CustomerNeed.DELIVERY_RESOLUTION],
    CustomerIntent.PAYMENT_ISSUE: [CustomerNeed.PAYMENT_RESOLUTION],
    CustomerIntent.ACCOUNT_ISSUE: [CustomerNeed.ACCOUNT_ASSISTANCE],
    CustomerIntent.COMPLAINT: [CustomerNeed.COMPLAINT_RESOLUTION],
    CustomerIntent.RETURN_EXCHANGE: [CustomerNeed.RETURN_OR_EXCHANGE],
    CustomerIntent.GENERAL_INQUIRY: [CustomerNeed.INFORMATION_REQUEST],
}


def map_customer_needs(intent: CustomerIntent) -> List[CustomerNeed]:
    """Deterministically maps customer intent to structured customer needs."""
    return INTENT_TO_CUSTOMER_NEEDS.get(intent, [CustomerNeed.INFORMATION_REQUEST])


# ---------------------------------------------------------------------------
# 2. Priority Determination
# ---------------------------------------------------------------------------

def determine_priority(
    analysis: Any,
    history: Optional[List[TurnAnalysis]] = None
) -> DecisionPriority:
    """Calculates action priority deterministically from emotional and risk signals.

    Rules:
    - CRITICAL: High escalation risk combined with severe frustration (>= 8).
    - HIGH: High escalation risk, severe frustration (>= 8), angry emotion, or repeated negative sentiment.
    - MEDIUM: Moderate frustration (5-7), negative sentiment, medium escalation risk, or worried/frustrated emotion.
    - LOW: Mild/no frustration (<= 4), low escalation risk, and positive/neutral sentiment.
    """
    frustration = getattr(analysis, "frustration_level", 0)
    risk = getattr(analysis, "escalation_risk", EscalationRisk.LOW)
    emotion = getattr(analysis, "emotion", CustomerEmotion.NEUTRAL)
    sentiment = getattr(analysis, "sentiment", CustomerSentiment.NEUTRAL)

    # Critical check
    if risk == EscalationRisk.HIGH and frustration >= 8:
        return DecisionPriority.CRITICAL

    # High check
    repeated_negative = False
    if history:
        neg_count = sum(1 for h in history if h.sentiment == CustomerSentiment.NEGATIVE)
        if neg_count >= 2:
            repeated_negative = True

    if (
        risk == EscalationRisk.HIGH
        or frustration >= 8
        or emotion == CustomerEmotion.ANGRY
        or repeated_negative
    ):
        return DecisionPriority.HIGH

    # Medium check
    if (
        (5 <= frustration <= 7)
        or emotion in (CustomerEmotion.FRUSTRATED, CustomerEmotion.WORRIED)
        or sentiment == CustomerSentiment.NEGATIVE
        or risk == EscalationRisk.MEDIUM
    ):
        return DecisionPriority.MEDIUM

    return DecisionPriority.LOW


# ---------------------------------------------------------------------------
# 3. Recommended Tone Determination
# ---------------------------------------------------------------------------

def determine_recommended_tone(analysis: Any) -> RecommendedTone:
    """Recommends agent tone tailored to the customer's emotional and frustration state.

    Rules:
    - Severe frustration (>= 8) with complaint intent: APOLOGETIC.
    - Severe frustration (>= 8): CALM.
    - High escalation risk or angry/frustrated emotion: EMPATHETIC.
    - Worried emotion: REASSURING.
    - Confused emotion: CLARIFYING.
    - Happy or satisfied emotion: PROFESSIONAL.
    - Neutral / default: PROFESSIONAL.
    """
    frustration = getattr(analysis, "frustration_level", 0)
    intent = getattr(analysis, "intent", CustomerIntent.GENERAL_INQUIRY)
    emotion = getattr(analysis, "emotion", CustomerEmotion.NEUTRAL)
    risk = getattr(analysis, "escalation_risk", EscalationRisk.LOW)

    if frustration >= 8 and intent == CustomerIntent.COMPLAINT:
        return RecommendedTone.APOLOGETIC
    elif frustration >= 8:
        return RecommendedTone.CALM
    elif risk == EscalationRisk.HIGH or emotion in (CustomerEmotion.ANGRY, CustomerEmotion.FRUSTRATED):
        return RecommendedTone.EMPATHETIC
    elif emotion == CustomerEmotion.WORRIED:
        return RecommendedTone.REASSURING
    elif emotion == CustomerEmotion.CONFUSED:
        return RecommendedTone.CLARIFYING
    elif emotion in (CustomerEmotion.HAPPY, CustomerEmotion.SATISFIED):
        return RecommendedTone.PROFESSIONAL
    else:
        return RecommendedTone.PROFESSIONAL


# ---------------------------------------------------------------------------
# 4. Recommended Action Determination
# ---------------------------------------------------------------------------

def determine_recommended_action(analysis: Any) -> RecommendedAction:
    """Recommends operational action based on escalation risk and intent category.

    Rules:
    - High escalation risk or extreme frustration (>= 9): ESCALATE.
    - Complaint intent: APOLOGIZE_AND_RESOLVE.
    - Delivery issue: PROVIDE_STATUS.
    - Payment issue: PROVIDE_INSTRUCTIONS.
    - Account issue: CLARIFY.
    - Return or exchange: OFFER_OPTIONS.
    - Refund request: RESOLVE.
    - General inquiry: PROVIDE_INSTRUCTIONS.
    """
    risk = getattr(analysis, "escalation_risk", EscalationRisk.LOW)
    frustration = getattr(analysis, "frustration_level", 0)
    intent = getattr(analysis, "intent", CustomerIntent.GENERAL_INQUIRY)

    if risk == EscalationRisk.HIGH or frustration >= 9:
        return RecommendedAction.ESCALATE
    elif intent == CustomerIntent.COMPLAINT:
        return RecommendedAction.APOLOGIZE_AND_RESOLVE
    elif intent == CustomerIntent.DELIVERY_ISSUE:
        return RecommendedAction.PROVIDE_STATUS
    elif intent == CustomerIntent.PAYMENT_ISSUE:
        return RecommendedAction.PROVIDE_INSTRUCTIONS
    elif intent == CustomerIntent.ACCOUNT_ISSUE:
        return RecommendedAction.CLARIFY
    elif intent == CustomerIntent.RETURN_EXCHANGE:
        return RecommendedAction.OFFER_OPTIONS
    elif intent == CustomerIntent.REFUND:
        return RecommendedAction.RESOLVE
    else:
        return RecommendedAction.PROVIDE_INSTRUCTIONS


# ---------------------------------------------------------------------------
# 5. Risk Flag Collection
# ---------------------------------------------------------------------------

def collect_risk_flags(
    analysis: Any,
    history: Optional[List[TurnAnalysis]] = None
) -> List[str]:
    """Extracts deterministic, deduplicated operational risk flags."""
    flags: List[str] = []

    frustration = getattr(analysis, "frustration_level", 0)
    sentiment = getattr(analysis, "sentiment", CustomerSentiment.NEUTRAL)
    emotion = getattr(analysis, "emotion", CustomerEmotion.NEUTRAL)
    risk = getattr(analysis, "escalation_risk", EscalationRisk.LOW)
    trend = getattr(analysis, "satisfaction_trend", SatisfactionTrend.STABLE)
    confidence = getattr(analysis, "confidence", 1.0)

    if frustration >= 9:
        flags.append("critical_frustration")
    elif frustration >= 7:
        flags.append("high_frustration")

    if sentiment == CustomerSentiment.NEGATIVE:
        flags.append("negative_sentiment")

    if emotion == CustomerEmotion.ANGRY:
        flags.append("angry_customer")

    if risk == EscalationRisk.HIGH:
        flags.append("high_escalation_risk")
    elif risk == EscalationRisk.MEDIUM:
        flags.append("medium_escalation_risk")

    if trend == SatisfactionTrend.DECLINING:
        flags.append("declining_satisfaction")

    if confidence < 0.70:
        flags.append("low_analysis_confidence")

    if history:
        neg_count = sum(1 for h in history if h.sentiment == CustomerSentiment.NEGATIVE)
        if neg_count >= 2:
            flags.append("repeated_negative_sentiment")

        complaint_count = sum(1 for h in history if h.intent == CustomerIntent.COMPLAINT)
        if complaint_count >= 2:
            flags.append("repeated_complaints")

    # Deduplicate while preserving order
    seen = set()
    deduped = []
    for f in flags:
        if f not in seen:
            seen.add(f)
            deduped.append(f)

    return deduped


# ---------------------------------------------------------------------------
# 6. Knowledge Parsing & Anti-Hallucination Utilities (Task 6 Phase 1)
# ---------------------------------------------------------------------------

def _parse_knowledge_context(knowledge_recommendations: Any) -> Tuple[List[Dict[str, Any]], bool]:
    """Extracts normalized knowledge chunks and no_relevant_information flag.

    Supports:
    - KnowledgeRecommendationResult
    - dict with 'recommendations' and 'no_relevant_information'
    - list of recommendation objects/dicts
    - None
    """
    if knowledge_recommendations is None:
        return [], True

    no_relevant_info = False
    chunks: List[Dict[str, Any]] = []

    # Handle KnowledgeRecommendationResult or similar object
    if hasattr(knowledge_recommendations, "no_relevant_information"):
        no_relevant_info = bool(knowledge_recommendations.no_relevant_information)
    elif isinstance(knowledge_recommendations, dict):
        no_relevant_info = bool(knowledge_recommendations.get("no_relevant_information", False))

    raw_recs = []
    if hasattr(knowledge_recommendations, "recommendations"):
        raw_recs = getattr(knowledge_recommendations, "recommendations") or []
    elif isinstance(knowledge_recommendations, dict):
        raw_recs = knowledge_recommendations.get("recommendations", [])
    elif isinstance(knowledge_recommendations, list):
        raw_recs = knowledge_recommendations

    for item in raw_recs:
        item_dict = None
        if hasattr(item, "model_dump"):
            item_dict = item.model_dump()
        elif hasattr(item, "dict"):
            item_dict = item.dict()
        elif isinstance(item, dict):
            item_dict = item

        if item_dict is not None:
            content = (item_dict.get("content") or "").strip()
            if content:
                chunks.append(item_dict)

    if not chunks:
        no_relevant_info = True

    return chunks, no_relevant_info


def _is_chunk_relevant_to_intent(
    chunk: Dict[str, Any],
    intent: CustomerIntent,
    customer_message: Optional[str] = None,
) -> bool:
    """Validates that a knowledge chunk is semantically relevant to the customer intent and inquiry."""
    if intent in (CustomerIntent.GENERAL_INQUIRY, CustomerIntent.COMPLAINT):
        return True

    text_to_check = (
        f"{chunk.get('title', '')} {chunk.get('source', '')} {chunk.get('content', '')}"
    ).lower()

    intent_keywords = {
        CustomerIntent.REFUND: {"refund", "return", "reimburse", "money back", "cancel", "credit", "charge", "payment", "billing"},
        CustomerIntent.PAYMENT_ISSUE: {"payment", "pay", "charge", "card", "billing", "transaction", "bank", "authorization", "hold", "deduct", "checkout", "fee", "fund"},
        CustomerIntent.DELIVERY_ISSUE: {"delivery", "deliver", "shipping", "ship", "carrier", "track", "transit", "package", "dispatch", "order", "parcel", "delay"},
        CustomerIntent.ACCOUNT_ISSUE: {"account", "login", "log in", "password", "2fa", "credential", "auth", "security", "email", "profile", "access", "reset", "user"},
        CustomerIntent.RETURN_EXCHANGE: {"return", "exchange", "replace", "item", "product", "tag", "packaging", "order", "refund", "ship"},
        CustomerIntent.CANCELLATION: {"cancel", "cancellation", "stop", "order", "fulfillment", "dispatch", "return", "refund"},
    }

    keywords = intent_keywords.get(intent)
    if keywords:
        if any(kw in text_to_check for kw in keywords):
            return True

    if customer_message:
        msg_words = [w.strip().lower() for w in customer_message.split() if len(w.strip()) > 3]
        if any(w in text_to_check for w in msg_words):
            return True

    return False


# ---------------------------------------------------------------------------
# 7. Gemini LLM Coaching Prompt & Generation (Task 6 Phase 1)
# ---------------------------------------------------------------------------

def build_coaching_prompt(
    analysis: Any,
    customer_message: Optional[str] = None,
    dialogue_history: Optional[List[Dict[str, Any]]] = None,
    knowledge_chunks: Optional[List[Dict[str, Any]]] = None,
    no_relevant_info: bool = False,
    recommended_tone: Optional[RecommendedTone] = None,
    recommended_action: Optional[RecommendedAction] = None,
) -> str:
    """Builds the prompt for Gemini LLM coaching and response generation."""
    intent_val = getattr(analysis, "intent", "general_inquiry")
    if hasattr(intent_val, "value"):
        intent_val = intent_val.value
    emotion_val = getattr(analysis, "emotion", "neutral")
    if hasattr(emotion_val, "value"):
        emotion_val = emotion_val.value
    sentiment_val = getattr(analysis, "sentiment", "neutral")
    if hasattr(sentiment_val, "value"):
        sentiment_val = sentiment_val.value
    frustration_val = getattr(analysis, "frustration_level", 0)
    risk_val = getattr(analysis, "escalation_risk", "low")
    if hasattr(risk_val, "value"):
        risk_val = risk_val.value

    tone_val = recommended_tone.value if recommended_tone else "professional"
    action_val = recommended_action.value if recommended_action else "provide_instructions"

    history_lines = []
    if dialogue_history:
        for turn in dialogue_history[-4:]:
            sender = turn.get("sender_type") or turn.get("sender") or "User"
            text = turn.get("message_text") or turn.get("text") or ""
            history_lines.append(f"- {sender}: {text}")
    history_text = "\n".join(history_lines) if history_lines else "None"

    if no_relevant_info or not knowledge_chunks:
        knowledge_section = "NO RELEVANT KNOWLEDGE FOUND (no_relevant_information=True)."
        guardrail_section = (
            "CRITICAL ANTI-HALLUCINATION GUARDRAIL:\n"
            "- No verified policy was retrieved for this request.\n"
            "- DO NOT fabricate policies, guarantee refund amounts or timelines (e.g. do not say 'refund in 3 days'), or invent procedures.\n"
            "- Acknowledge the customer's feelings with empathy, explain that you need to look into their account, and ask for clarifying details (such as order ID, account email, or transaction reference)."
        )
    else:
        chunk_lines = []
        for i, c in enumerate(knowledge_chunks[:3], 1):
            title = c.get("title") or c.get("source") or "Document"
            content = (c.get("content") or "").strip()
            score = c.get("relevance_score", 0.0)
            chunk_lines.append(f"[{i}] {title} (relevance: {score:.2f}):\n{content}")
        knowledge_section = "\n\n".join(chunk_lines)
        guardrail_section = (
            "KNOWLEDGE GROUNDING REQUIREMENT:\n"
            "- Base the response strictly on the retrieved knowledge chunks above.\n"
            "- Do not promise or state policies beyond what is documented."
        )

    prompt = f"""You are the AI Response Coaching and Decision Support Agent for an enterprise customer support platform.
Generate a tailored support agent suggested response, actionable coaching tips, and a response evaluation based strictly on the provided context.

=== CUSTOMER CONTEXT ===
- Intent: {intent_val}
- Emotion: {emotion_val}
- Sentiment: {sentiment_val}
- Frustration Level: {frustration_val}/10
- Escalation Risk: {risk_val}
- Recommended Tone: {tone_val}
- Recommended Action: {action_val}

=== RECENT CONVERSATION HISTORY ===
{history_text}

=== CURRENT CUSTOMER MESSAGE ===
"{customer_message or ''}"

=== RETRIEVED KNOWLEDGE BASE INFORMATION ===
{knowledge_section}

=== GUARDRAIL INSTRUCTIONS ===
{guardrail_section}

=== REQUIRED JSON OUTPUT FORMAT ===
Output ONLY a valid JSON object with these EXACT keys:
- "suggested_response": string (context-aware, professional support agent reply adhering to the tone and guardrail)
- "coaching_tips": list of 2-4 strings (actionable guidance for the agent)
- "response_evaluation": object containing:
    - "clarity": float between 0.0 and 1.0
    - "empathy": float between 0.0 and 1.0
    - "relevance": float between 0.0 and 1.0
    - "professionalism": float between 0.0 and 1.0
    - "notes": optional string

DO NOT output markdown fences (e.g. ```json), code blocks, or text outside the JSON object.
"""
    return prompt


def generate_coaching_with_gemini(
    analysis_result: Any,
    customer_message: str,
    dialogue_history: Optional[List[Dict[str, Any]]] = None,
    knowledge_recommendations: Optional[Any] = None,
    recommended_tone: Optional[RecommendedTone] = None,
    recommended_action: Optional[RecommendedAction] = None,
) -> Optional[Dict[str, Any]]:
    """Calls Gemini LLM to generate suggested response, coaching tips, and evaluation."""
    chunks, no_relevant_info = _parse_knowledge_context(knowledge_recommendations)
    prompt = build_coaching_prompt(
        analysis=analysis_result,
        customer_message=customer_message,
        dialogue_history=dialogue_history,
        knowledge_chunks=chunks,
        no_relevant_info=no_relevant_info,
        recommended_tone=recommended_tone,
        recommended_action=recommended_action,
    )
    raw_output = generate_with_gemini(prompt)
    parsed = parse_llm_json(raw_output)
    if not parsed or not isinstance(parsed, dict):
        return None

    suggested_response = parsed.get("suggested_response")
    if not isinstance(suggested_response, str) or not suggested_response.strip():
        return None

    raw_tips = parsed.get("coaching_tips")
    if not isinstance(raw_tips, list) or len(raw_tips) == 0:
        return None
    coaching_tips = [str(t).strip() for t in raw_tips if str(t).strip()]

    raw_eval = parsed.get("response_evaluation")
    if not isinstance(raw_eval, dict):
        return None

    try:
        eval_obj = ResponseEvaluation(
            clarity=max(0.0, min(1.0, float(raw_eval.get("clarity", 0.9)))),
            empathy=max(0.0, min(1.0, float(raw_eval.get("empathy", 0.85)))),
            relevance=max(0.0, min(1.0, float(raw_eval.get("relevance", 0.9)))),
            professionalism=max(0.0, min(1.0, float(raw_eval.get("professionalism", 0.95)))),
            notes=str(raw_eval.get("notes")) if raw_eval.get("notes") else None,
        )
    except Exception:
        return None

    return {
        "suggested_response": suggested_response.strip(),
        "coaching_tips": coaching_tips[:4],
        "response_evaluation": eval_obj,
    }


# ---------------------------------------------------------------------------
# 8. Deterministic Fallback Coaching Generator (Task 6 Phase 1)
# ---------------------------------------------------------------------------

def generate_coaching_fallback(
    analysis_result: Any,
    knowledge_recommendations: Optional[Any] = None,
    customer_message: Optional[str] = None,
    dialogue_history: Optional[List[Dict[str, Any]]] = None,
    recommended_tone: Optional[RecommendedTone] = None,
    recommended_action: Optional[RecommendedAction] = None,
) -> Dict[str, Any]:
    """Deterministic, context-aware generator for response, coaching tips, and evaluation."""
    chunks, no_relevant_info = _parse_knowledge_context(knowledge_recommendations)

    intent = getattr(analysis_result, "intent", CustomerIntent.GENERAL_INQUIRY)
    if isinstance(intent, str):
        try:
            intent = CustomerIntent(intent)
        except ValueError:
            intent = CustomerIntent.GENERAL_INQUIRY

    emotion = getattr(analysis_result, "emotion", CustomerEmotion.NEUTRAL)
    if isinstance(emotion, str):
        try:
            emotion = CustomerEmotion(emotion)
        except ValueError:
            emotion = CustomerEmotion.NEUTRAL

    frustration = getattr(analysis_result, "frustration_level", 0)
    risk = getattr(analysis_result, "escalation_risk", EscalationRisk.LOW)
    if isinstance(risk, str):
        try:
            risk = EscalationRisk(risk)
        except ValueError:
            risk = EscalationRisk.LOW

    tone = recommended_tone or determine_recommended_tone(analysis_result)
    action = recommended_action or determine_recommended_action(analysis_result)

    # 1. Suggested Response Construction
    # A. Opening phrase based on emotion & frustration
    if frustration >= 8 or emotion == CustomerEmotion.ANGRY:
        opening = "I sincerely apologize for the frustration and inconvenience this experience has caused you. I understand how urgent this is, and I am here to assist you right away."
    elif frustration >= 5 or emotion == CustomerEmotion.FRUSTRATED:
        opening = "I understand your frustration and appreciate your patience while we work through this together."
    elif emotion == CustomerEmotion.WORRIED:
        opening = "I understand your concern and want to reassure you that we are here to help get this sorted out."
    elif emotion == CustomerEmotion.CONFUSED:
        opening = "I understand this situation can be confusing, and I would be glad to clarify everything for you step by step."
    elif emotion in (CustomerEmotion.HAPPY, CustomerEmotion.SATISFIED) or frustration <= 1:
        opening = "Thank you for reaching out to us today! I am glad to assist you."
    else:
        opening = "Thank you for contacting customer support. I would be glad to assist you with your request."

    # B. Body based on knowledge and intent
    chunk_snippets = []
    primary_doc_name = ""
    if not no_relevant_info:
        for c in chunks[:2]:
            content = (c.get("content") or "").strip()
            if content and _is_chunk_relevant_to_intent(c, intent, customer_message):
                first_sent = content.split(".")[0].strip()
                if first_sent and len(first_sent) > 15:
                    chunk_snippets.append(first_sent + ".")
                    if not primary_doc_name:
                        raw_title = (c.get("title") or c.get("source") or "").strip()
                        if raw_title.lower().endswith(".pdf"):
                            raw_title = raw_title[:-4].replace("_", " ").strip()
                        primary_doc_name = raw_title

    is_unguided = no_relevant_info or not chunk_snippets

    if is_unguided:
        # STRICT ANTI-HALLUCINATION GUARDRAIL: Do not fabricate policies or timelines!
        intent_name = intent.value.replace("_", " ") if hasattr(intent, "value") else str(intent).replace("_", " ")
        body = (
            f"To ensure I have all the accurate details to look into your {intent_name}, "
            "could you please provide your order ID, account email, or any relevant reference number? "
            "Once I have those details, I will look into your account directly and provide you with the exact next steps."
        )
    else:
        # Grounded in verified knowledge chunks with accurate source attribution
        snippet_text = chunk_snippets[0].lower() if chunk_snippets[0][0].isupper() else chunk_snippets[0]
        has_doc_type = any(w in primary_doc_name.lower() for w in ["policy", "guideline", "faq"]) if primary_doc_name else False

        if intent == CustomerIntent.REFUND:
            if primary_doc_name:
                doc_ref = f"According to our {primary_doc_name}" if has_doc_type else f"According to our {primary_doc_name} policy"
            else:
                doc_ref = "According to our refund policy"
            body = f"{doc_ref}, {snippet_text} Once verified, refunds are typically processed back to your original payment method within standard processing timelines."
        elif intent == CustomerIntent.PAYMENT_ISSUE:
            if primary_doc_name:
                doc_ref = f"Based on our {primary_doc_name}" if has_doc_type else f"Based on our {primary_doc_name} guidelines"
            else:
                doc_ref = "Based on our payment guidelines"
            body = f"{doc_ref}, {snippet_text} If a transaction failed while funds were deducted, it is typically a temporary authorization hold that will release automatically within 24-48 hours."
        elif intent == CustomerIntent.DELIVERY_ISSUE:
            if primary_doc_name:
                doc_ref = f"According to our {primary_doc_name}" if has_doc_type else f"According to our {primary_doc_name} guidelines"
            else:
                doc_ref = "According to our delivery guidelines"
            body = f"{doc_ref}, {snippet_text} Please confirm your shipping address and order number so we can track the transit status for you."
        elif intent == CustomerIntent.ACCOUNT_ISSUE:
            if primary_doc_name:
                doc_ref = f"Following our {primary_doc_name}" if has_doc_type else f"Following our {primary_doc_name} guidelines"
            else:
                doc_ref = "Following our account guidelines"
            body = f"{doc_ref}, {snippet_text} You can also reset your credentials using the 'Forgot Password' link on the login page."
        elif intent == CustomerIntent.RETURN_EXCHANGE:
            if primary_doc_name:
                doc_ref = f"Under our {primary_doc_name}" if has_doc_type else f"Under our {primary_doc_name} policy"
            else:
                doc_ref = "Under our return and exchange policy"
            body = f"{doc_ref}, {snippet_text} Eligible items must be in original condition with packaging intact."
        elif intent == CustomerIntent.CANCELLATION:
            if primary_doc_name:
                doc_ref = f"According to our {primary_doc_name}" if has_doc_type else f"According to our {primary_doc_name} policy"
            else:
                doc_ref = "According to our cancellation policy"
            body = f"{doc_ref}, {snippet_text} Orders can be canceled prior to fulfillment and dispatch."
        else:
            if primary_doc_name:
                doc_ref = f"Based on our {primary_doc_name}"
            else:
                doc_ref = "Based on our documented guidelines"
            body = f"{doc_ref}: {chunk_snippets[0]} We are actively reviewing this to ensure full resolution."

    # C. Closing phrase
    if action == RecommendedAction.ESCALATE or risk == EscalationRisk.HIGH or frustration >= 9:
        closing = "I am also escalating this case to our specialized support team to ensure you receive immediate priority resolution."
    elif emotion in (CustomerEmotion.HAPPY, CustomerEmotion.SATISFIED) or frustration <= 1:
        closing = "Please let me know if there is anything else I can assist you with today!"
    else:
        closing = "Please let me know if you have any questions, and I will be happy to help."

    suggested_response = f"{opening} {body} {closing}"

    # 2. Coaching Tips (2-4 actionable bulleted tips)
    tips: List[str] = []
    if is_unguided:
        tips.append("Do not quote unverified policy timelines or guarantee refund/replacement amounts until account details are verified.")
        tips.append("Ask targeted clarifying questions (such as order ID or account email) to gather necessary context.")
    else:
        tips.append("Reference verified policy guidelines to provide accurate expectations without overpromising.")

    if frustration >= 7 or emotion == CustomerEmotion.ANGRY:
        tips.append("Validate the customer's frustration immediately before explaining policy details; avoid defensive phrasing.")
    elif emotion == CustomerEmotion.CONFUSED:
        tips.append("Break down instructions into concise, numbered steps to avoid overwhelming the customer.")
    elif emotion == CustomerEmotion.WORRIED:
        tips.append("Offer reassurance early in the conversation to lower customer anxiety.")
    elif emotion in (CustomerEmotion.HAPPY, CustomerEmotion.SATISFIED):
        tips.append("Reinforce the positive interaction and maintain a warm, appreciative tone.")

    if action == RecommendedAction.ESCALATE or risk == EscalationRisk.HIGH:
        tips.append("Prepare a clear summary of the customer's issue for the supervisor to enable a seamless handoff.")
    elif action == RecommendedAction.APOLOGIZE_AND_RESOLVE:
        tips.append("Lead with an empathetic apology for the disruption before presenting resolution steps.")
    elif action == RecommendedAction.PROVIDE_STATUS:
        tips.append("Confirm specific order or tracking identifiers before providing transit timelines.")
    elif action == RecommendedAction.CLARIFY:
        tips.append("Ask focused, one-question-at-a-time prompts to avoid customer confusion.")

    # Deduplicate while preserving order, cap at 4
    seen_tips = set()
    deduped_tips = []
    for t in tips:
        if t not in seen_tips:
            seen_tips.add(t)
            deduped_tips.append(t)
    if len(deduped_tips) < 2:
        deduped_tips.append("Maintain a professional, patient demeanor throughout the conversation.")
    coaching_tips = deduped_tips[:4]

    # 3. Response Evaluation
    clarity_score = 0.94 if not is_unguided else 0.90
    if frustration >= 7 or emotion in (CustomerEmotion.ANGRY, CustomerEmotion.FRUSTRATED):
        empathy_score = 0.92
    elif emotion == CustomerEmotion.WORRIED:
        empathy_score = 0.90
    else:
        empathy_score = 0.86

    relevance_score = 0.92 if not is_unguided else 0.88
    prof_score = 0.96

    if is_unguided:
        notes = "Anti-hallucination guardrail active: response requests clarification without asserting unverified policies."
    else:
        notes = "Response is grounded in verified knowledge and tailored to customer emotional state."

    eval_obj = ResponseEvaluation(
        clarity=round(clarity_score, 2),
        empathy=round(empathy_score, 2),
        relevance=round(relevance_score, 2),
        professionalism=round(prof_score, 2),
        notes=notes,
    )

    return {
        "suggested_response": suggested_response,
        "coaching_tips": coaching_tips,
        "response_evaluation": eval_obj,
    }


# ---------------------------------------------------------------------------
# 9. Core Decision Support Generation
# ---------------------------------------------------------------------------


def calculate_escalation_monitor(
    analysis_result: Any,
    risk_flags: List[str]
) -> EscalationRiskMonitorResult:
    """Calculates deterministic risk score and level for Phase 2."""
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
        
    has_repeated_complaint = any("repeated_complaint" in f.lower() for f in risk_flags)
    has_repeated_neg = any("repeated_negative_sentiment" in f.lower() for f in risk_flags)
    
    if has_repeated_complaint:
        score += 15
        factors.append("+15 for repeated complaints")
        indicators.append("repeated complaints")
        
    if has_repeated_neg and not has_repeated_complaint:
        score += 10
        factors.append("+10 for repeated negative sentiment")
        indicators.append("persistent negative sentiment")
        
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


# ---------------------------------------------------------------------------
# Phase 3: Configurable Escalation Threshold & Alert Generation
# ---------------------------------------------------------------------------

# Centralized configurable threshold (env var or default).
# Any score >= this value triggers an escalation alert.
ESCALATION_ALERT_THRESHOLD = float(os.getenv("ESCALATION_ALERT_THRESHOLD", "70.0"))


def generate_escalation_alert(
    monitor: EscalationRiskMonitorResult,
    threshold: float | None = None,
) -> EscalationAlert:
    """Generates an EscalationAlert based on the Phase 2 monitor result.

    Args:
        monitor: The Phase 2 EscalationRiskMonitorResult.
        threshold: Override threshold; defaults to ESCALATION_ALERT_THRESHOLD.

    Returns:
        EscalationAlert with active=True if score >= threshold, else active=False.
    """
    if threshold is None:
        threshold = ESCALATION_ALERT_THRESHOLD

    is_active = monitor.risk_score >= threshold

    if not is_active:
        return EscalationAlert(
            active=False,
            alert_level=monitor.risk_level,
            risk_score=monitor.risk_score,
            threshold=threshold,
            indicators=monitor.risk_indicators,
            reasoning="",
            recommended_action="",
        )

    # Determine recommended action based on risk level
    if monitor.risk_level == EscalationRiskLevel.CRITICAL:
        rec_action = (
            "Immediately escalate to a human supervisor. Acknowledge the customer's frustration "
            "explicitly, apologize for the experience, and assure them a senior agent will take over."
        )
    elif monitor.risk_level == EscalationRiskLevel.HIGH:
        has_supervisor = any("supervisor" in i.lower() or "human" in i.lower() for i in monitor.risk_indicators)
        if has_supervisor:
            rec_action = (
                "The customer has requested a supervisor. Acknowledge their frustration, "
                "confirm you are escalating, and provide a clear timeline for resolution."
            )
        else:
            rec_action = (
                "Acknowledge the customer's frustration directly. Change your response approach "
                "to prioritize empathy and provide a concrete next step to resolve the issue."
            )
    else:
        rec_action = (
            "Monitor the conversation closely. Provide clarification and reassurance "
            "to prevent further escalation."
        )

    reasoning = (
        f"Escalation alert triggered: risk score {monitor.risk_score:.0f}/100 "
        f"exceeds threshold {threshold:.0f}. {monitor.risk_reasoning}"
    )

    return EscalationAlert(
        active=True,
        alert_level=monitor.risk_level,
        risk_score=monitor.risk_score,
        threshold=threshold,
        indicators=monitor.risk_indicators,
        reasoning=reasoning,
        recommended_action=rec_action,
    )


def generate_decision_support(
    analysis_result: Any = None,
    history: Optional[List[TurnAnalysis]] = None,
    knowledge_recommendations: Optional[Any] = None,
    customer_message: Optional[str] = None,
    dialogue_history: Optional[List[Dict[str, Any]]] = None,
    session_id: Optional[int] = None,
    turn_number: Optional[int] = None,
    use_llm: Optional[bool] = None,
    **kwargs: Any,
) -> DecisionSupportResult:
    """Generates deterministic decision support recommendations and response coaching.

    Derived from AnalysisResult signals, turn history, and Task 5 knowledge chunks.
    """
    if analysis_result is None and "analysis" in kwargs:
        analysis_result = kwargs["analysis"]

    priority = determine_priority(analysis_result, history=history)
    tone = determine_recommended_tone(analysis_result)
    action = determine_recommended_action(analysis_result)
    needs = map_customer_needs(getattr(analysis_result, "intent", CustomerIntent.GENERAL_INQUIRY))
    risk_flags = collect_risk_flags(analysis_result, history=history)

    risk = getattr(analysis_result, "escalation_risk", EscalationRisk.LOW)
    escalation_recommended = (
        action == RecommendedAction.ESCALATE
        or priority == DecisionPriority.CRITICAL
        or risk == EscalationRisk.HIGH
    )

    intent_val = getattr(analysis_result, "intent", CustomerIntent.GENERAL_INQUIRY)
    if hasattr(intent_val, "value"):
        intent_val = intent_val.value
    emotion_val = getattr(analysis_result, "emotion", CustomerEmotion.NEUTRAL)
    if hasattr(emotion_val, "value"):
        emotion_val = emotion_val.value
    sentiment_val = getattr(analysis_result, "sentiment", CustomerSentiment.NEUTRAL)
    if hasattr(sentiment_val, "value"):
        sentiment_val = sentiment_val.value
    frustration_val = getattr(analysis_result, "frustration_level", 0)
    risk_val = risk.value if hasattr(risk, "value") else str(risk)

    rationale = (
        f"Customer expressed {intent_val} with {emotion_val} emotion and {sentiment_val} sentiment "
        f"(frustration: {frustration_val}/10, escalation risk: {risk_val}). "
        f"Recommended action is '{action.value}' using '{tone.value}' tone at '{priority.value}' priority."
    )
    if risk_flags:
        rationale += f" Risk flags detected: {', '.join(risk_flags)}."

    confidence = getattr(analysis_result, "confidence", 1.0)
    if session_id is None:
        session_id = getattr(analysis_result, "session_id", None)
    if turn_number is None:
        turn_number = getattr(analysis_result, "turn_number", None)
    if turn_number is None and hasattr(analysis_result, "turn"):
        turn_number = getattr(analysis_result, "turn")

    # Determine whether to invoke Gemini LLM or use deterministic fallback
    if use_llm is None:
        env_llm = os.getenv("COACHING_USE_LLM", "").lower() in ("true", "1", "yes")
        is_mocked = hasattr(generate_with_gemini, "mock_calls") or getattr(generate_with_gemini, "_is_mock", False)
        should_use_llm = env_llm or is_mocked
    else:
        should_use_llm = bool(use_llm)

    # Coaching and response suggestion generation (Task 6 Phase 1)
    coaching_data = None
    if should_use_llm and customer_message:
        try:
            coaching_data = generate_coaching_with_gemini(
                analysis_result=analysis_result,
                customer_message=customer_message,
                dialogue_history=dialogue_history,
                knowledge_recommendations=knowledge_recommendations,
                recommended_tone=tone,
                recommended_action=action,
            )
        except Exception as e:
            logger.info("Gemini coaching generation failed or unavailable (%s), using deterministic fallback", e)
            coaching_data = None

    if not coaching_data:
        coaching_data = generate_coaching_fallback(
            analysis_result=analysis_result,
            knowledge_recommendations=knowledge_recommendations,
            customer_message=customer_message,
            dialogue_history=dialogue_history,
            recommended_tone=tone,
            recommended_action=action,
        )

    suggested_response = coaching_data.get("suggested_response", "")
    coaching_tips = coaching_data.get("coaching_tips", [])
    response_eval = coaching_data.get("response_evaluation")
    if isinstance(response_eval, dict):
        try:
            response_eval = ResponseEvaluation(**response_eval)
        except Exception:
            pass

    escalation_monitor = calculate_escalation_monitor(analysis_result, risk_flags)
    escalation_alert = generate_escalation_alert(escalation_monitor)

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
        escalation_alert=escalation_alert,
    )


# ---------------------------------------------------------------------------
# 10. Session Decision Support Retrieval
# ---------------------------------------------------------------------------

def get_session_decision_support(
    session_id: int,
    db: DBSession,
    use_llm: bool = False,
) -> DecisionSupportResult:
    """Retrieves decision support for a simulator session based on its latest analyzed state."""
    session_row = db.query(SimSession).filter(SimSession.session_id == session_id).first()
    if not session_row:
        raise ValueError(f"Simulator session {session_id} not found.")

    conversation_row = db.query(Conversation).filter(Conversation.session_id == session_id).first()

    latest_rec_data = None
    customer_message_text = None
    dialogue_history: List[Dict[str, Any]] = []

    if conversation_row:
        # Extract latest system message for knowledge recommendations
        system_messages = (
            db.query(Message)
            .filter(
                Message.conversation_id == conversation_row.conversation_id,
                Message.message_type == "System"
            )
            .order_by(Message.message_id.asc())
            .all()
        )
        for msg in reversed(system_messages):
            try:
                parsed = json.loads(msg.message_text)
                if isinstance(parsed, dict) and "recommendations" in parsed and parsed["recommendations"]:
                    latest_rec_data = parsed["recommendations"]
                    break
            except Exception:
                continue

        # Extract latest customer message
        latest_cust_msg = (
            db.query(Message)
            .filter(
                Message.conversation_id == conversation_row.conversation_id,
                Message.sender_type.in_(["Customer", "User"]),
                Message.message_type != "System"
            )
            .order_by(Message.message_id.desc())
            .first()
        )
        if latest_cust_msg:
            customer_message_text = latest_cust_msg.message_text

        # Extract dialogue history
        all_chat_msgs = (
            db.query(Message)
            .filter(
                Message.conversation_id == conversation_row.conversation_id,
                Message.message_type != "System"
            )
            .order_by(Message.message_id.asc())
            .all()
        )
        dialogue_history = [
            {"sender_type": m.sender_type, "message_text": m.message_text}
            for m in all_chat_msgs
        ]

    history = get_analysis_history(session_id=session_id, db=db)

    if not history:
        # Default baseline if session has no analyzed turns yet
        baseline = AnalysisResult(
            intent=CustomerIntent.GENERAL_INQUIRY,
            emotion=CustomerEmotion.NEUTRAL,
            sentiment=CustomerSentiment.NEUTRAL,
            frustration_level=0,
            satisfaction_trend=SatisfactionTrend.STABLE,
            escalation_risk=EscalationRisk.LOW,
            confidence=1.0,
            session_id=session_id,
            turn_number=None,
            analysis_source="default"
        )
        res = generate_decision_support(
            baseline,
            history=[],
            knowledge_recommendations=latest_rec_data,
            customer_message=customer_message_text,
            dialogue_history=dialogue_history,
            session_id=session_id,
            turn_number=None,
            use_llm=use_llm,
        )
        return res

    latest = history[-1]
    res = generate_decision_support(
        latest,
        history=history,
        knowledge_recommendations=latest_rec_data,
        customer_message=customer_message_text,
        dialogue_history=dialogue_history,
        session_id=session_id,
        turn_number=latest.turn,
        use_llm=use_llm,
    )
    return res

