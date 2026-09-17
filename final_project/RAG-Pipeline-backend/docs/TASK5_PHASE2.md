# Task 5 — Phase 2: Context-Aware Knowledge Recommendation + Task 4 Integration

## 1. Phase 2 Objective

Phase 2 upgrades the Phase 1 Knowledge Recommendation Agent from standalone query retrieval into a **context-aware recommendation system** that:

1. Accepts the current customer message.
2. Accepts/uses previous conversation context (dialogue history).
3. Builds a contextually meaningful retrieval query (pronoun/reference resolution).
4. Reuses the EXISTING RAG pipeline and ChromaDB infrastructure (no new vector stores).
5. Optionally uses Task 4 Intent & Sentiment Analysis output as a retrieval signal.
6. Retrieves relevant support knowledge with intent-aware ranking.
7. Ranks, deduplicates, and returns the most relevant 3–5 recommendations.
8. Preserves complete backward compatibility with Phase 1, Task 3, and Task 4.

---

## 2. Context-Aware Query Construction

### 2.1 Problem Statement

In multi-turn customer support conversations, follow-up messages often contain referential pronouns or elliptical phrases that are insufficient for standalone vector retrieval:

| Customer Turn | Follow-Up | Issue |
|---|---|---|
| "I ordered a laptop last week" | "Where is it?" | "it" refers to the laptop order |
| "I submitted a refund request" | "How long does that take?" | "that" refers to the refund process |
| "My payment failed twice" | "Why did it fail?" | "it" refers to the payment |

### 2.2 Solution: `build_contextual_query()`

The `build_contextual_query()` function deterministically synthesizes a context-enriched retrieval query:

```
Current Query: "Where is it?"
     +
Dialogue History → Extract recent customer turn keywords
     +
Task 4 Intent → Add domain topic terms
     ↓
Contextual Query: "Where is it? laptop ordered arrive yesterday delivery shipping tracking"
```

**Algorithm:**

1. **Referential Token Detection**: Check if query words intersect with `REFERENTIAL_TOKENS` (pronouns like "it", "that", "this", "where", "status", etc.) or if the query is short (≤5 words) without domain keywords.

2. **Customer Turn Extraction**: If context expansion is needed:
   - Filter dialogue history for `Customer` sender turns only (exclude System, Support Agent).
   - Take the last 2 customer turns (recency priority).
   - Process turns in **reverse order** (most recent first) to prioritize immediately preceding context.
   - Extract topical keywords by filtering out conversational stop words.
   - Limit to 6 extracted terms to avoid query dilution.

3. **Intent Topic Enrichment**: If Task 4 intent is available:
   - Look up domain topic terms from `INTENT_TOPIC_TERMS` mapping.
   - Add up to 3 missing topic terms not already present in the query.

4. **Query Assembly**: Concatenate original query + context keywords + intent terms.

### 2.3 Referential Token Set

```python
REFERENTIAL_TOKENS = {
    "it", "its", "that", "this", "them", "these", "those",
    "there", "status", "update", "arrive", "arriving",
    "tracking", "where", "how long", "what about", "when will",
    "still waiting", "is it", "can i", "why", "any news"
}
```

### 2.4 Conversational Stop Words

A comprehensive set of 100+ English stop words, pronouns, conversational fillers, and generic support terms are filtered during keyword extraction to isolate topical nouns and entities.

---

## 3. Task 4 Integration

### 3.1 Intent Extraction (`_extract_intent()`)

Phase 2 safely consumes Task 4 analysis output in **any format**:

| Input Type | Example | Extraction |
|---|---|---|
| `AnalysisResult` (Pydantic model) | `AnalysisResult(intent=CustomerIntent.DELIVERY_ISSUE, ...)` | `"delivery_issue"` |
| `AnalysisResponse` (Pydantic model) | `AnalysisResponse(intent=CustomerIntent.PAYMENT_ISSUE, ...)` | `"payment_issue"` |
| `CustomerIntent` (enum) | `CustomerIntent.REFUND` | `"refund"` |
| `dict` | `{"intent": "cancellation", "emotion": "angry"}` | `"cancellation"` |
| `str` | `"refund"` | `"refund"` |
| `None` / `{}` / invalid | `None`, `{}`, `"xyz_unknown"` | `None` (safe) |

### 3.2 Intent-Aware Ranking Boost (`_calculate_intent_boost()`)

When Task 4 intent is available, documents whose name or content match intent-aligned keywords receive a **bounded +0.02 relevance boost**:

```python
INTENT_ALIGNMENT_KEYWORDS = {
    "refund": ["refund", "reimbursement", "return policy", "money back"],
    "delivery_issue": ["delivery", "shipping", "courier", "dispatch", "transit", "carrier"],
    "payment_issue": ["payment", "checkout", "billing", "card", "declined", "transaction"],
    ...
}
```

**Design Constraints:**
- Maximum boost is exactly `+0.02` — intentionally small.
- Semantic relevance (vector similarity) strictly dominates.
- Emotion/frustration alone **never** overrides semantic relevance.
- The boost is a deterministic tie-breaker, not a ranking override.
- Final score is capped at `min(1.0, base_relevance + 0.02)`.

### 3.3 Intent Topic Expansion

The `INTENT_TOPIC_TERMS` mapping enriches queries with domain-specific terms:

```python
INTENT_TOPIC_TERMS = {
    "refund": "refund policy reimbursement",
    "delivery_issue": "delivery shipping tracking order arrival",
    "payment_issue": "payment checkout billing card error",
    "cancellation": "cancel order cancellation",
    ...
}
```

---

## 4. Session Context Resolution

### 4.1 `get_session_context()`

For requests with a `session_id`, the service retrieves dialogue history from existing Task 3 database tables:

```
session_id → Session (SimSession) table
    → Conversation table (filtered by session_id)
        → Message table (filtered by conversation_id)
            → Exclude message_type == "System"
            → Order by message_id ASC
```

**Session isolation** is enforced: only messages belonging to the requested session's conversation are returned.

**Stored Intent Recovery**: The latest `System` message's JSON payload is inspected for a stored Task 4 analysis result:

```json
{"analysis": {"intent": "delivery_issue", ...}}
```

If found and no explicit analysis was provided, this stored intent is used for query expansion.

### 4.2 Missing Session Handling

If `session_id` references a nonexistent session, a `ValueError` is raised, which the API router translates to HTTP 404:

```json
{"detail": "Simulator session 999999 not found."}
```

---

## 5. Updated Domain Contracts

### 5.1 Extended Request Contract

```python
class KnowledgeRecommendationRequest(BaseModel):
    query: str = Field(..., min_length=1)
    session_id: Optional[int] = Field(default=None, gt=0)
    conversation_id: Optional[int] = Field(default=None, gt=0)
    conversation_history: Optional[List[Dict[str, Any]]] = Field(default=None)
    analysis: Optional[Any] = Field(default=None)
```

### 5.2 Extended Result Contract

```python
class KnowledgeRecommendationResult(BaseModel):
    query: str
    recommendations: List[KnowledgeRecommendation]
    no_relevant_information: bool = False
    contextual_query: Optional[str] = None   # Phase 2: observability
    session_id: Optional[int] = None         # Phase 2: session reference
```

### 5.3 Backward Compatibility

Phase 1 standalone payloads (`{"query": "..."}`) continue to work identically. All new fields are optional with `None` defaults.

---

## 6. Phase 2 Retrieval Pipeline

```
Customer Query + Optional Session ID + Optional History + Optional Analysis
       ↓
  1. Validate query (non-empty)
       ↓
  2. Resolve session context (if session_id provided)
     → get_session_context() → dialogue history + stored intent
       ↓
  3. Merge explicit conversation_history
       ↓
  4. Extract Task 4 intent (_extract_intent())
       ↓
  5. Build contextual query (build_contextual_query())
     → Pronoun/reference resolution + intent topic expansion
       ↓
  6. Normalize query (rag_service.normalize_question)
       ↓
  7. Generate embedding (embedding_service.generate_embedding)
       ↓
  8. Vector search (vector_service.search_documents)
       ↓
  9. Active document filtering + archived exclusion
       ↓
 10. Distance → base relevance + intent boost (+0.02 max)
       ↓
 11. Apply threshold (0.38)
       ↓
 12. Deduplicate content snippets
       ↓
 13. Sort by relevance (descending) → Top 3–5
       ↓
 14. Return KnowledgeRecommendationResult
```

---

## 7. REST API Specification

### Endpoint: `POST /knowledge/recommend`

**Phase 1 Standalone Request:**
```json
{"query": "My payment failed"}
```

**Phase 2 Context-Aware Request:**
```json
{
  "query": "Where is it now?",
  "conversation_history": [
    {"sender_type": "Customer", "message_text": "I ordered a laptop last week and it was supposed to arrive yesterday."},
    {"sender_type": "Support Agent", "message_text": "I can assist you with checking your order status."}
  ],
  "analysis": {
    "intent": "delivery_issue",
    "emotion": "frustrated"
  }
}
```

**Phase 2 Session-Based Request:**
```json
{
  "query": "How long does that take?",
  "session_id": 42
}
```

**Success Response (200 OK):**
```json
{
  "query": "Where is it now?",
  "recommendations": [
    {
      "title": "Customer Support FAQ",
      "content": "To check order status, navigate to your order history page...",
      "source": "chunk:doc_27_v1_p2_c1 | document:Customer Support FAQ | v1 | p2",
      "document_type": "faq",
      "relevance_score": 0.5707
    }
  ],
  "no_relevant_information": false,
  "contextual_query": "Where is it now? laptop ordered arrive yesterday delivery shipping tracking",
  "session_id": null
}
```

**Error Responses:**
| Status | Condition | Example |
|---|---|---|
| 200 | No relevant results | `{"recommendations": [], "no_relevant_information": true}` |
| 404 | Nonexistent session_id | `{"detail": "Simulator session 999999 not found."}` |
| 422 | Empty/whitespace query | Pydantic validation error |
| 500 | Internal failure | `{"detail": "Knowledge retrieval failed."}` |

---

## 8. Test Coverage

### 8.1 Phase 2 Test Summary

30 tests in `tests/test_knowledge_recommendation_phase2.py`:

| Category | Count | Mode | Scope |
|---|---|---|---|
| **1. Context Tests** | 7 | MOCK | Standalone compatibility, pronoun resolution, reference resolution, system message exclusion, empty history, bounded long history, contextual_query observability |
| **2. Task 4 Integration** | 9 | MOCK | Intent expansion, AnalysisResult/AnalysisResponse/dict/enum parsing, missing analysis safety, emotion does not override relevance, intent boost applied/not applied |
| **3. Ranking & Threshold** | 4 | MOCK | Intent boost reorders, deduplication, max 5, score bounds |
| **4. Source Attribution** | 2 | MOCK | Provenance preserved, no fabrication |
| **5. No-Result Handling** | 1 | MOCK | Irrelevant query with context returns empty |
| **6. API Tests** | 4 | MOCK | Phase 1 backward compat, context payload, nonexistent session 404, empty query 422 |
| **7. Real RAG** | 3 | **REAL** | Multi-turn order tracking, multi-turn refund timeline, irrelevant query with history |
| **Total** | **30** | | |

### 8.2 Real Multi-Turn Retrieval Evidence

#### Scenario 1: Multi-Turn Order Tracking
```
Customer: "I ordered a laptop last week and it was supposed to arrive yesterday."
Support Agent: "I can assist you with checking your order status."
Customer: "Where is it now?"
Task 4 Intent: delivery_issue

→ Contextual Query: "Where is it now? laptop ordered arrive yesterday delivery shipping tracking"
→ Retrieved: FAQ/Policy documents with delivery/order content
→ no_relevant_information: false
→ Relevance scores within [0.0, 1.0]
```

#### Scenario 2: Multi-Turn Refund Timeline
```
Customer: "I submitted a refund request for my damaged item yesterday."
Customer: "How long does that take?"
Task 4 Intent: refund

→ Contextual Query: "How long does that take? submitted refund request damaged item refund policy reimbursement"
→ Retrieved: Documents containing "refund" in title or content
→ no_relevant_information: false
```

#### Scenario 3: Irrelevant Query with History (Safety)
```
Customer: "I ordered a laptop yesterday."
Customer: "What is the mass of Jupiter in kilograms?"

→ Context expansion adds laptop keywords, but Jupiter query dominates embedding
→ All candidate scores below threshold (0.38)
→ no_relevant_information: true
→ recommendations: []
```

---

## 9. Backward Compatibility

### 9.1 Phase 1 Compatibility
- Standalone `{"query": "..."}` payloads produce identical results.
- All 47 Phase 1 tests pass without modification.
- No Phase 1 behavior is altered — all new fields default to `None`.

### 9.2 Task 3 Compatibility
- No Task 3 database tables are modified.
- Session/Conversation/Message models are read-only; no writes.
- All Task 3 (Simulator) tests pass.

### 9.3 Task 4 Compatibility
- No Task 4 analysis service code is modified.
- Analysis schemas are imported read-only for type parsing.
- All Task 4 tests pass.

---

## 10. Architecture & Design Decisions

| Decision | Rationale |
|---|---|
| **Referential token detection** | Set intersection with `REFERENTIAL_TOKENS` is O(1) and deterministic — no LLM call needed for pronoun resolution |
| **Reverse iteration of customer turns** | `reversed(recent_turns)` prioritizes the most recent customer turn, preventing old irrelevant context from dominating |
| **6-term extraction limit** | Prevents query dilution that would cause vector drift in the embedding space |
| **Intent boost capped at +0.02** | Ensures semantic relevance always dominates; intent is a tie-breaker only |
| **No emotion in query construction** | Emotion/frustration are support metadata, not retrieval signals — injecting "angry" into a vector query degrades results |
| **DB session injection via `Depends(get_db)`** | Follows FastAPI convention; service accepts optional `db` param for testability |
| **System message exclusion** | Internal state payloads (persona JSON, frustration scores) must never leak into retrieval queries |

---

## 11. Files Created/Modified

| File | Action | Purpose |
|---|---|---|
| `app/schemas/knowledge.py` | **Modified** | Extended request with `session_id`, `conversation_id`, `conversation_history`, `analysis`; result with `contextual_query`, `session_id` |
| `app/services/knowledge_recommendation_service.py` | **Modified** | Added `build_contextual_query()`, `get_session_context()`, `_extract_intent()`, `_calculate_intent_boost()`; extended `get_knowledge_recommendations()` |
| `app/api/knowledge.py` | **Modified** | Added DB session injection, pass context params, 404 for missing sessions |
| `tests/test_knowledge_recommendation_phase2.py` | **New** | 30 Phase 2 tests |
| `docs/TASK5_PHASE2.md` | **New** | This documentation |

---

## 12. Database Impact

**No database schema changes.** Phase 2 reads from existing Task 3 tables (Session, Conversation, Message) for session context resolution. No new tables, columns, or indexes are introduced.

---

## 13. Known Limitations & Phase 3/4 Boundary

The following capabilities are deliberately out of scope for Phase 2:

- **Live conversation-flow integration**: Orchestrating Task 3 → Task 4 → Task 5 into an end-to-end pipeline (Phase 3).
- **Cross-encoder reranking**: Advanced neural reranking beyond intent boost (Phase 3/4).
- **10–20 Scenario Evaluation Suite**: Comprehensive MRR, NDCG, precision metrics across standardized support scenarios (Phase 4).
- **Adaptive threshold tuning**: Dynamic threshold adjustment based on query type or conversation stage.
- **Multi-query fusion**: Generating multiple retrieval queries from a single conversation context.

---

## 14. Regression Testing

- **Phase 1 Tests**: 47/47 PASSED (no regressions)
- **Phase 2 Tests**: 30/30 PASSED
- **Task 3 Tests**: All PASSED
- **Task 4 Tests**: All PASSED
- **Full Repository**: All tests PASSED
