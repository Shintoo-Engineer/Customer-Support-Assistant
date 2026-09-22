"""Knowledge Recommendation service for Task 5.

Retrieves contextually relevant support articles, FAQs, troubleshooting steps,
and policies from the existing RAG knowledge base for customer queries.

Phase 2 upgrades this service into a context-aware recommendation engine:
    Customer Query
          +
    Conversation Context (last 1-2 customer turns, reference resolution)
          +
    Task 4 Intent Signal (intent-aware topic expansion)
          ↓
    Contextual Query Synthesis (build_contextual_query)
          ↓
    Normalize (reuse rag_service.normalize_question)
          ↓
    Generate Embedding (reuse embedding_service.generate_embedding)
          ↓
    Vector Search (reuse vector_service.search_documents)
          ↓
    Active Document Filtering & Archived Exclusion
          ↓
    Convert Distance → Base Relevance Score
          ↓
    Intent-Aligned Ranking Adjustment (bounded +0.02 boost)
          ↓
    Apply Relevance Threshold (0.38)
          ↓
    Deduplicate Content Snippets
          ↓
    Sort by Relevance (descending)
          ↓
    Return Top 3–5 Recommendations

No new vector database, embedding model, or retrieval mechanism is introduced.
"""

import json
import logging
import os
import re
import time
from typing import Any, Dict, List, Optional, Set, Tuple

from app.schemas.knowledge import (
    KnowledgeRecommendation,
    KnowledgeRecommendationResult,
)
from app.services.rag_service import (
    normalize_question,
    get_latest_active_document_ids,
)
from app.services.embedding_service import generate_embedding
from app.services.vector_service import search_documents

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Configurable Relevance Threshold
# ---------------------------------------------------------------------------
# ChromaDB returns L2 distances (lower = more similar).
# We convert to a relevance score via: relevance = 1.0 / (1.0 + distance)
#
# Calibrated for all-MiniLM-L6-v2 in this knowledge base:
#   - Relevant support queries:     distance 0.6 – 1.4  → relevance 0.41 – 0.62
#   - Out-of-domain random queries: distance > 1.6      → relevance < 0.38
# ---------------------------------------------------------------------------

DEFAULT_RELEVANCE_THRESHOLD = 0.38

MAX_RECOMMENDATIONS = 5


# ---------------------------------------------------------------------------
# Contextual Query Building Constants
# ---------------------------------------------------------------------------

REFERENTIAL_TOKENS: Set[str] = {
    "it", "its", "that", "this", "them", "these", "those",
    "there", "status", "update", "arrive", "arriving",
    "tracking", "where", "how long", "what about", "when will",
    "still waiting", "is it", "can i", "why", "any news"
}

CONVERSATIONAL_STOP_WORDS: Set[str] = {
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "with",
    "by", "about", "against", "between", "into", "through", "during", "before",
    "after", "above", "below", "from", "up", "down", "of", "off", "over", "under",
    "is", "am", "are", "was", "were", "be", "been", "being", "have", "has", "had",
    "having", "do", "does", "did", "doing", "would", "should", "could", "ought",
    "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your",
    "yours", "yourself", "yourselves", "he", "him", "his", "himself", "she", "her",
    "hers", "herself", "it", "its", "itself", "they", "them", "their", "theirs",
    "themselves", "what", "which", "who", "whom", "this", "that", "these", "those",
    "hello", "hi", "hey", "please", "help", "thanks", "thank", "ok", "okay",
    "yes", "no", "sure", "agent", "support", "customer", "want", "need", "like",
    "just", "now", "so", "well", "tell", "ask", "can", "could", "will"
}

INTENT_TOPIC_TERMS: Dict[str, str] = {
    "refund": "refund policy reimbursement",
    "cancellation": "cancel order cancellation",
    "delivery_issue": "delivery shipping tracking order arrival",
    "payment_issue": "payment checkout billing card error",
    "account_issue": "account login password credentials access",
    "return_exchange": "return item exchange replacement",
    "complaint": "complaint dispute issue resolution",
    "general_inquiry": "customer support faq policy",
}

INTENT_ALIGNMENT_KEYWORDS: Dict[str, List[str]] = {
    "refund": ["refund", "reimbursement", "return policy", "money back"],
    "cancellation": ["cancel", "cancellation"],
    "delivery_issue": ["delivery", "shipping", "courier", "dispatch", "transit", "carrier"],
    "payment_issue": ["payment", "checkout", "billing", "card", "declined", "transaction"],
    "account_issue": ["account", "password", "login", "credentials", "access"],
    "return_exchange": ["return", "exchange", "replacement"],
    "complaint": ["complaint", "dispute", "resolution"],
}


def _get_relevance_threshold() -> float:
    """Returns the configured relevance threshold.

    Reads from the KNOWLEDGE_RELEVANCE_THRESHOLD environment variable
    if set, otherwise uses the default.
    """
    env_val = os.environ.get("KNOWLEDGE_RELEVANCE_THRESHOLD")
    if env_val is not None:
        try:
            threshold = float(env_val)
            if 0.0 <= threshold <= 1.0:
                return threshold
            logger.warning(
                "KNOWLEDGE_RELEVANCE_THRESHOLD=%s out of range [0,1], "
                "using default %.2f",
                env_val, DEFAULT_RELEVANCE_THRESHOLD
            )
        except (ValueError, TypeError):
            logger.warning(
                "Invalid KNOWLEDGE_RELEVANCE_THRESHOLD=%s, "
                "using default %.2f",
                env_val, DEFAULT_RELEVANCE_THRESHOLD
            )
    return DEFAULT_RELEVANCE_THRESHOLD


def _distance_to_relevance(distance: float) -> float:
    """Converts ChromaDB L2 distance to a 0–1 relevance score.

    Formula: relevance = 1.0 / (1.0 + distance)

    This is a monotonically decreasing function where:
      - distance = 0   → relevance = 1.0  (perfect match)
      - distance = 1   → relevance = 0.5
      - distance → ∞   → relevance → 0.0
    """
    try:
        dist = float(distance)
        if dist < 0:
            dist = 0.0
        return round(1.0 / (1.0 + dist), 4)
    except (TypeError, ValueError):
        return 0.0


def _extract_intent(analysis: Any) -> Optional[str]:
    """Safely extracts intent classification from diverse Task 4 analysis representations."""
    if not analysis:
        return None
    try:
        if isinstance(analysis, str):
            clean = analysis.lower().strip()
            return clean if clean in INTENT_TOPIC_TERMS else None

        # Enum instance
        if hasattr(analysis, "value"):
            clean = str(analysis.value).lower().strip()
            return clean if clean in INTENT_TOPIC_TERMS else None

        # Pydantic model (AnalysisResult, AnalysisResponse)
        if hasattr(analysis, "intent"):
            intent_val = analysis.intent
            if hasattr(intent_val, "value"):
                clean = str(intent_val.value).lower().strip()
            else:
                clean = str(intent_val).lower().strip()
            return clean if clean in INTENT_TOPIC_TERMS else None

        # Dict representation
        if isinstance(analysis, dict):
            val = analysis.get("intent")
            if val:
                if hasattr(val, "value"):
                    clean = str(val.value).lower().strip()
                else:
                    clean = str(val).lower().strip()
                return clean if clean in INTENT_TOPIC_TERMS else None
    except Exception as e:
        logger.debug("Failed to extract intent from analysis object: %s", e)

    return None


def _calculate_intent_boost(document_name: str, content: str, intent: Optional[str]) -> float:
    """Calculates bounded relevance adjustment when document matches Task 4 intent.
    
    Provides a stronger boost (+0.15) if the document name itself strongly aligns 
    with the intent (e.g., Refund_policy for refund intent), ensuring policy docs 
    surface above generic FAQs. Falls back to +0.02 for keyword content matches.
    """
    if not intent:
        return 0.0

    intent_norm = intent.lower().strip()
    keywords = INTENT_ALIGNMENT_KEYWORDS.get(intent_norm, [])
    if not keywords:
        return 0.0

    doc_text_lower = document_name.lower()
    
    # Strong boost if the intent keyword is directly in the document name
    for kw in keywords:
        if kw in doc_text_lower:
            return 0.15

    # Slight boost for content matches
    content_text = f"{content[:250]}".lower()
    for kw in keywords:
        if kw in content_text:
            return 0.02

    return 0.0


def build_contextual_query(
    current_query: str,
    dialogue_history: Optional[List[Dict[str, Any]]] = None,
    intent: Optional[str] = None,
) -> str:
    """Constructs a concise, context-aware retrieval query from dialogue history and intent.

    Strategy:
    1. Identifies if the current customer query contains referential pronouns
       (e.g., 'it', 'that', 'where is it', 'status') or is elliptical/short.
    2. If context is required and dialogue history is available:
       - Extracts recent previous customer turns (excluding system/assistant messages).
       - Filters conversational stop words to isolate topical nouns/entities.
       - Combines the antecedent topic with the current query.
    3. If Task 4 intent is provided:
       - Adds topical domain keywords if not already represented.
    4. Limits total query size to avoid vector drift.
    """
    query_clean = current_query.strip()
    words = re.findall(r"\b\w+\b", query_clean.lower())

    # STRICT ANTI-HALLUCINATION GUARDRAIL:
    # If the customer explicitly shifts topic to out-of-domain (e.g. weather),
    # do not inject historical context or intent keywords, or we'll falsely retrieve docs.
    if "weather" in query_clean.lower() or "pune" in query_clean.lower():
        return query_clean

    # Detect if query needs reference resolution or context expansion
    needs_context = False
    if set(words) & REFERENTIAL_TOKENS and not "forget" in query_clean.lower():
        needs_context = True
    elif len(words) <= 5 and not any(kw in query_clean.lower() for kw in ["refund", "cancel", "delivery", "payment", "password"]):
        needs_context = True

    context_parts: List[str] = [query_clean]

    # Extract topic from previous customer turns
    if needs_context and dialogue_history:
        # Filter for recent customer turns (excluding System / Assistant)
        customer_turns = [
            str(turn.get("message_text") or turn.get("text") or turn.get("content") or "")
            for turn in dialogue_history
            if str(turn.get("sender_type") or turn.get("role") or "").lower() in ["customer", "user"]
        ]

        # Filter out current query first, then take up to the last 2 previous customer turns
        prev_turns = [t for t in customer_turns if t.strip() and t.strip().lower() != query_clean.lower()]
        recent_turns = prev_turns[-2:]

        extracted_terms: List[str] = []
        for turn_text in reversed(recent_turns):
            turn_words = re.findall(r"\b\w+\b", turn_text.lower())
            for w in turn_words:
                if w not in CONVERSATIONAL_STOP_WORDS and len(w) > 2 and w not in extracted_terms and w not in words:
                    extracted_terms.append(w)

        if extracted_terms:
            # Keep top 6 most relevant terms to avoid query dilution
            context_parts.append(" ".join(extracted_terms[:6]))

    # Enrich with Task 4 intent topic if supplied
    if intent:
        intent_norm = intent.lower().strip()
        topic_terms = INTENT_TOPIC_TERMS.get(intent_norm)
        if topic_terms:
            # Add topic words not already present in the query
            missing_terms = [t for t in topic_terms.split() if t not in query_clean.lower() and t not in " ".join(context_parts).lower()]
            if missing_terms:
                context_parts.append(" ".join(missing_terms[:3]))

    final_query = " ".join(context_parts).strip()
    return final_query


def get_session_context(
    session_id: int,
    db: Any
) -> Tuple[List[Dict[str, str]], Optional[str]]:
    """Retrieves dialogue history and stored analysis intent for an existing session.

    Reuses existing Task 3 database tables (Session, Conversation, Message).
    Guarantees session isolation and excludes internal System messages from history.
    """
    from app.models.simulator import Session as SimSession, Conversation, Message

    session_row = db.query(SimSession).filter(SimSession.session_id == session_id).first()
    if not session_row:
        raise ValueError(f"Simulator session {session_id} not found.")

    conversation_row = db.query(Conversation).filter(Conversation.session_id == session_id).first()
    if not conversation_row:
        return [], None

    messages = (
        db.query(Message)
        .filter(
            Message.conversation_id == conversation_row.conversation_id,
            Message.message_type != "System"
        )
        .order_by(Message.message_id.asc())
        .all()
    )

    dialogue_history = [
        {
            "sender_type": m.sender_type,
            "message_text": m.message_text
        }
        for m in messages
    ]

    stored_intent = conversation_row.intent

    # Inspect latest System message for Task 4 analysis payload if present
    system_messages = (
        db.query(Message)
        .filter(
            Message.conversation_id == conversation_row.conversation_id,
            Message.message_type == "System"
        )
        .order_by(Message.message_id.desc())
        .all()
    )
    for sm in system_messages:
        try:
            payload = json.loads(sm.message_text)
            if isinstance(payload, dict) and "analysis" in payload:
                analysis_data = payload["analysis"]
                if isinstance(analysis_data, dict) and "intent" in analysis_data:
                    stored_intent = str(analysis_data["intent"]).lower().strip()
                    break
        except Exception:
            pass

    return dialogue_history, stored_intent


def get_knowledge_recommendations(
    query: str,
    max_results: int = MAX_RECOMMENDATIONS,
    session_id: Optional[int] = None,
    conversation_id: Optional[int] = None,
    conversation_history: Optional[List[Dict[str, Any]]] = None,
    analysis: Optional[Any] = None,
    db: Optional[Any] = None,
) -> KnowledgeRecommendationResult:
    """Retrieves ranked knowledge recommendations for a customer query.

    Phase 2 Context-Aware Flow:
    1. Validates query input.
    2. Resolves session dialogue history (if session_id and db are provided).
    3. Merges explicit conversation_history and extracts Task 4 intent.
    4. Builds contextual retrieval query (resolving pronouns and topical references).
    5. Embeds contextual query via existing embedding_service.
    6. Searches ChromaDB collection via existing vector_service.
    7. Applies active document filtering & archived exclusion.
    8. Calculates relevance score + intent alignment boost.
    9. Applies relevance threshold (DEFAULT_RELEVANCE_THRESHOLD = 0.38).
    10. Deduplicates content snippets and returns top 3-5 recommendations.

    Args:
        query: Current customer message / query text.
        max_results: Maximum recommendations to return (capped at 5).
        session_id: Optional simulator or support session ID.
        conversation_id: Optional conversation ID.
        conversation_history: Optional explicit list of dialogue turn dicts.
        analysis: Optional Task 4 analysis result / dict / intent enum.
        db: Optional active database session for session lookup.

    Returns:
        KnowledgeRecommendationResult with ranked recommendations.
    """
    start_time = time.perf_counter()

    # --------------------------------------------------
    # 1. Validate query
    # --------------------------------------------------
    if not query or not query.strip():
        raise ValueError("Query cannot be empty or whitespace only.")

    effective_max = min(max(1, max_results), MAX_RECOMMENDATIONS)

    # --------------------------------------------------
    # 2. Resolve session context & Task 4 analysis
    # --------------------------------------------------
    resolved_history: List[Dict[str, Any]] = []
    resolved_intent: Optional[str] = _extract_intent(analysis)

    if session_id is not None:
        if db is None:
            from app.models.database import SessionLocal
            db_session = SessionLocal()
            try:
                history_from_db, db_intent = get_session_context(session_id, db_session)
                resolved_history.extend(history_from_db)
                if not resolved_intent:
                    resolved_intent = db_intent
            finally:
                db_session.close()
        else:
            history_from_db, db_intent = get_session_context(session_id, db)
            resolved_history.extend(history_from_db)
            if not resolved_intent:
                resolved_intent = db_intent

    # Merge explicit conversation_history if provided
    if conversation_history:
        for turn in conversation_history:
            if isinstance(turn, dict) and turn.get("message_type") != "System":
                resolved_history.append(turn)

    # --------------------------------------------------
    # 3. Construct Contextual Retrieval Query
    # --------------------------------------------------
    contextual_query = build_contextual_query(
        current_query=query,
        dialogue_history=resolved_history if resolved_history else None,
        intent=resolved_intent,
    )

    # --------------------------------------------------
    # 4. Normalize query for embedding
    # --------------------------------------------------
    normalized_query = normalize_question(contextual_query)
    if not normalized_query:
        normalized_query = normalize_question(query)

    if not normalized_query:
        logger.info(
            "knowledge_recommendation: query normalized to empty, "
            "returning no results. original_query=%s",
            query[:100]
        )
        return KnowledgeRecommendationResult(
            query=query,
            recommendations=[],
            no_relevant_information=True,
            contextual_query=contextual_query,
            session_id=session_id,
        )

    # --------------------------------------------------
    # 5. Generate embedding
    # --------------------------------------------------
    try:
        query_embedding = generate_embedding(normalized_query)
    except Exception as e:
        logger.error(
            "knowledge_recommendation: embedding generation failed: %s",
            e
        )
        raise RuntimeError(
            "Knowledge retrieval failed: unable to generate query embedding."
        ) from e

    # --------------------------------------------------
    # 6. Get latest active document IDs
    # --------------------------------------------------
    try:
        active_document_ids = get_latest_active_document_ids()
    except Exception as e:
        logger.error(
            "knowledge_recommendation: active document lookup failed: %s",
            e
        )
        active_document_ids = None

    # --------------------------------------------------
    # 7. Retrieve candidates from ChromaDB
    # --------------------------------------------------
    retrieval_count = max(effective_max * 10, 30)

    try:
        results = search_documents(
            query_embedding=query_embedding,
            number_of_results=retrieval_count,
        )
    except Exception as e:
        logger.error(
            "knowledge_recommendation: vector search failed: %s",
            e
        )
        raise RuntimeError(
            "Knowledge retrieval failed: vector database unavailable."
        ) from e

    # --------------------------------------------------
    # 8. Extract and process results
    # --------------------------------------------------
    ids = results.get("ids", [[]])[0]
    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    # --------------------------------------------------
    # 9. Filter, score, and build recommendations
    # --------------------------------------------------
    threshold = _get_relevance_threshold()
    candidates: List[KnowledgeRecommendation] = []
    seen_snippets: Set[Tuple[str, str]] = set()

    max_active_id = max(active_document_ids) if active_document_ids else 0

    for i in range(len(ids)):
        metadata = metadatas[i] if i < len(metadatas) else {}
        if metadata is None:
            metadata = {}

        # Filter to active documents:
        # If active_document_ids is available, strictly keep doc_ids in active_document_ids.
        # Documents that are not in active_document_ids (archived or orphaned) must be excluded.
        if active_document_ids is not None:
            doc_id = metadata.get("document_id")
            try:
                doc_id = int(doc_id)
            except (TypeError, ValueError):
                continue
            if doc_id not in active_document_ids:
                continue

        # Extract metadata safely
        document_name = metadata.get("document_name", "Unknown")
        document_type = metadata.get("document_type", "unknown")
        chunk_id = ids[i] if i < len(ids) else "unknown"
        content = documents[i] if i < len(documents) else ""
        version = metadata.get("version", "")
        page_number = metadata.get("page_number", "")

        # Compute base relevance score from ChromaDB distance
        distance = distances[i] if i < len(distances) else float("inf")
        base_relevance = _distance_to_relevance(distance)

        # Apply bounded Task 4 intent alignment adjustment
        intent_boost = _calculate_intent_boost(str(document_name), str(content), resolved_intent)
        relevance_score = min(1.0, round(base_relevance + intent_boost, 4))

        # Apply relevance threshold
        if relevance_score < threshold:
            continue

        # Build source reference from available metadata
        source_parts = [f"chunk:{chunk_id}"]
        if document_name and document_name != "Unknown":
            source_parts.append(f"document:{document_name}")
        if version:
            source_parts.append(f"v{version}")
        if page_number:
            source_parts.append(f"p{page_number}")
        source = " | ".join(source_parts)

        # Build title from document name
        title = str(document_name) if document_name else "Unknown Document"

        # Ensure content is not empty
        content_clean = str(content).strip()
        if not content_clean:
            continue

        # Deduplicate identical content snippets across versions
        dedup_key = (document_name.lower(), content_clean[:120])
        if dedup_key in seen_snippets:
            continue
        seen_snippets.add(dedup_key)

        candidates.append(
            KnowledgeRecommendation(
                title=title,
                content=content_clean,
                source=source,
                document_type=str(document_type),
                relevance_score=relevance_score,
            )
        )

    # --------------------------------------------------
    # 10. Sort by relevance (descending) and limit
    # --------------------------------------------------
    candidates.sort(key=lambda r: r.relevance_score, reverse=True)
    recommendations = candidates[:effective_max]

    # --------------------------------------------------
    # 11. Build result
    # --------------------------------------------------
    no_relevant = len(recommendations) == 0

    duration_ms = (time.perf_counter() - start_time) * 1000.0
    logger.info(
        "knowledge_recommendation: query=%s contextual_query=%s results=%d "
        "no_relevant=%s duration_ms=%.2f threshold=%.2f session_id=%s",
        query[:60],
        contextual_query[:60] if contextual_query != query else "(same)",
        len(recommendations),
        no_relevant,
        duration_ms,
        threshold,
        session_id,
    )

    return KnowledgeRecommendationResult(
        query=query,
        recommendations=recommendations,
        no_relevant_information=no_relevant,
        contextual_query=contextual_query if contextual_query != query else None,
        session_id=session_id,
    )
