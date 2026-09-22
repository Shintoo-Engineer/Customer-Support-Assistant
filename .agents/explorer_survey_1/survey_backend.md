# Backend AI Decision Support & Task 4/5 Architecture Survey

**Explorer Agent**: `explorer_survey_1`  
**Date**: 2026-09-21  
**Target Backend**: `final_project/RAG-Pipeline-backend`  
**Target Frontend**: `final_project/frontend`  
**Milestone**: Task 6 Phase 1 (Coaching & Response Suggestion Agent)

---

## Executive Summary

The Customer Support Assistant active production code is organized under `final_project/` (`final_project/RAG-Pipeline-backend` for FastAPI backend and `final_project/frontend` for React/Vite frontend).
The AI Decision Support foundation was initially laid in Task 4 Phase 6 as a deterministic downstream layer producing `DecisionSupportResult`. In Task 5 Phase 3, context-aware knowledge recommendation was integrated into the multi-turn simulator flow via `conversation_orchestration_service.py` and `POST /support/turn`.

Task 6 Phase 1 builds upon this by formalizing and extending the existing `DecisionSupportResult` schema and service with:
1. `suggested_response: str` (context-aware agent reply suggestion)
2. `coaching_tips: list[str]` (actionable guidance tailored to emotional state and customer intent)
3. `response_evaluation: dict[str, Any]` (structured metrics across clarity, empathy, relevance, professionalism)

Crucially:
- Existing fields on `DecisionSupportResult` remain 100% backward compatible with safe defaults.
- All existing tests (53 tests in `test_analysis_phase6.py`, 40+ in `test_task4_final.py`, 32 in `test_task3_task4_integration.py`, 8 in `test_task5_core.py`, and frontend build) are preserved without breaking changes.
- An anti-hallucination guardrail is strictly enforced: when Task 5 signals `no_relevant_information=True`, response suggestions and coaching tips never fabricate policy timelines or terms.
- Scope limits: Task 6 Phase 1 strictly focuses on response suggestions and coaching; no new escalation scoring algorithms, thresholds, or alert dispatchers are introduced.

---

## 1. Existing Definitions & References to `DecisionSupportResult`

### 1.1 Backend Schema (`app/schemas/analysis.py`, lines 300–347)
The current canonical definition of `DecisionSupportResult` is:

```python
class DecisionSupportResult(BaseModel):
    """Deterministic, agent-ready decision support recommendations.

    Derived exclusively from existing AnalysisResult signals and conversation history.
    """
    priority: DecisionPriority = Field(
        ...,
        description="Action priority: low, medium, high, or critical."
    )
    recommended_tone: RecommendedTone = Field(
        ...,
        description="Recommended tone for responding to the customer."
    )
    recommended_action: RecommendedAction = Field(
        ...,
        description="Recommended operational action to take."
    )
    escalation_recommended: bool = Field(
        ...,
        description="Flag indicating if immediate supervisor escalation is recommended."
    )
    risk_flags: list[str] = Field(
        default_factory=list,
        description="List of detected risk flags."
    )
    customer_needs: list[CustomerNeed] = Field(
        default_factory=list,
        description="Primary customer needs mapped from intent."
    )
    rationale: str = Field(
        ...,
        description="Deterministic, explainable rationale for recommendations."
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score inherited directly from the analysis result."
    )
    session_id: int | None = Field(
        default=None,
        description="Optional simulator or support session ID."
    )
    turn_number: int | None = Field(
        default=None,
        description="Optional dialogue turn number."
    )
```

Associated Enums in `app/schemas/analysis.py`:
- `DecisionPriority`: `low`, `medium`, `high`, `critical`
- `RecommendedTone`: `empathetic`, `reassuring`, `clarifying`, `apologetic`, `professional`, `calm`, `firm`
- `RecommendedAction`: `resolve`, `clarify`, `apologize_and_resolve`, `provide_status`, `provide_instructions`, `offer_options`, `escalate`
- `CustomerNeed`: `refund_request`, `cancellation_request`, `delivery_resolution`, `payment_resolution`, `account_assistance`, `complaint_resolution`, `return_or_exchange`, `information_request`

### 1.2 Frontend Contract (`src/types/index.ts`, lines 125–136)
Matches backend 1-to-1:
```typescript
export interface DecisionSupportResult {
  priority: 'low' | 'medium' | 'high' | 'critical';
  recommended_tone: 'empathetic' | 'reassuring' | 'clarifying' | 'apologetic' | 'professional' | 'calm' | 'firm';
  recommended_action: 'resolve' | 'clarify' | 'apologize_and_resolve' | 'provide_status' | 'provide_instructions' | 'offer_options' | 'escalate';
  escalation_recommended: boolean;
  risk_flags: string[];
  customer_needs: string[];
  rationale: string;
  confidence: number;
  session_id?: number | null;
  turn_number?: number | null;
}
```

### 1.3 Backend Service (`app/services/decision_support_service.py`)
- `map_customer_needs(intent: CustomerIntent) -> List[CustomerNeed]` (lines 48–51)
- `determine_priority(analysis: Any, history: Optional[List[TurnAnalysis]] = None) -> DecisionPriority` (lines 57–103)
- `determine_recommended_tone(analysis: Any) -> RecommendedTone` (lines 109–140)
- `determine_recommended_action(analysis: Any) -> RecommendedAction` (lines 146–179)
- `collect_risk_flags(analysis: Any, history: Optional[List[TurnAnalysis]] = None) -> List[str]` (lines 185–239)
- `generate_decision_support(analysis_result: Any, history: Optional[List[TurnAnalysis]] = None) -> DecisionSupportResult` (lines 245–301)
- `get_session_decision_support(session_id: int, db: DBSession) -> DecisionSupportResult` (lines 307–338)

### 1.4 REST API Endpoints (`app/api/analysis.py`, lines 163–206)
- `POST /analysis/{session_id}/decision-support` (HTTP 200, returns `DecisionSupportResult`)
- `GET /analysis/{session_id}/decision-support` (HTTP 200, idempotent retrieval, returns `DecisionSupportResult`)
- Under the hood, both routes execute `get_session_decision_support(session_id=session_id, db=db)`. If the session does not exist, an HTTP 404 is returned.

### 1.5 Frontend Consumption
- `frontend/src/api/analysisApi.ts`:
  `getDecisionSupport: (sessionId: number) => api.get<DecisionSupportResult>('/analysis/' + sessionId + '/decision-support')`
- `frontend/src/components/SupportConsole.tsx` (lines 70–82, lines 266–327):
  - Fetches `decisionSupport` on session start and after each completed turn via `useEffect([sessionData.session_id, sessionData.turn])`.
  - Renders priority badge, recommended tone, recommended action, rationale, and a "Use Suggested Tone in Reply" button that injects a hardcoded text template into `agentInput`.
- `frontend/src/components/DecisionSupportCard.tsx` (lines 1–110):
  Standalone reusable card displaying priority badge, escalation warning banner (`ShieldAlert`), recommended tone/action grid, rationale, risk flags, and an `onApplyAction` button.

---

## 2. Task 4 Analysis Models & Analytical Pipeline

### 2.1 Task 4 Schemas (`app/schemas/analysis.py`)
- `CustomerIntent` (8 categories): `refund`, `cancellation`, `delivery_issue`, `payment_issue`, `account_issue`, `complaint`, `return_exchange`, `general_inquiry`
- `CustomerEmotion` (7 categories): `happy`, `neutral`, `confused`, `worried`, `frustrated`, `angry`, `satisfied`
- `CustomerSentiment` (3 polarities): `positive`, `neutral`, `negative`
- `SatisfactionTrend` (3 progression states): `improving`, `declining`, `stable`
- `EscalationRisk` (3 levels): `low`, `medium`, `high`
- `AnalysisResponse`: Public contract with validated types and bounds (`frustration_level: 0..10`, `confidence: 0.0..1.0`).
- `AnalysisResult`: Internal canonical model inheriting `AnalysisResponse` with `session_id`, `conversation_id`, `message_id`, `turn_number`, `analysis_source`, `analysis_timestamp`.
- `TurnAnalysis`: Historical turn snapshot.
- `SessionAnalysisSummary`: Session-wide dominant metrics.

### 2.2 How Task 4 Produces `AnalysisResult` (`app/services/analysis_service.py`)
When `analyze_customer_message(session_id, customer_message, db)` is called:
1. Reconstructs dialogue history from SQLite `Message` table.
2. Formulates prompt for LLM classification (`generate_with_gemini`).
3. If Gemini is available and returns valid JSON: parses intent, emotion, sentiment, confidence.
4. If Gemini fails, rate-limits, or throws an exception: invokes `fallback_classify_message` using rich keyword dictionaries (`INTENT_KEYWORDS`, `EMOTION_KEYWORDS`, `SENTIMENT_POLARITY_KEYWORDS`).
5. Executes deterministic calculation engines:
   - `calculate_frustration_level(message, emotion, sentiment, history, escalation_req, repeated)`: outputs integer `0..10`.
   - `determine_satisfaction_trend(current_frustration, current_sentiment, history, message)`: outputs `improving`, `declining`, or `stable`.
   - `determine_escalation_risk(frustration, emotion, sentiment, escalation_req, repeated)`: outputs `low`, `medium`, or `high`.
6. Instantiates and returns `AnalysisResult`.
7. Updates the `Conversation` row in SQLite (`intent`, `sentiment`, `escalation_risk`).

### 2.3 Persistence Mechanism
In `app/api/simulator.py` (lines 196, 404) and `app/services/conversation_orchestration_service.py` (lines 176, 385):
The system persists a `Message` row with `sender_type="AI"` and `message_type="System"` containing JSON:
```json
{
  "persona": "calm",
  "scenario": "refund",
  "state": { "frustration": 20, "patience": 80, ... },
  "analysis": {
    "intent": "refund",
    "emotion": "frustrated",
    "sentiment": "negative",
    "frustration_level": 6,
    "satisfaction_trend": "stable",
    "escalation_risk": "low",
    "confidence": 0.92,
    ...
  },
  "recommendations": { ... }
}
```
`get_analysis_history(session_id, db)` queries these System messages in order to recreate chronological `TurnAnalysis` records.

---

## 3. Task 5 Knowledge Recommendation Retrieval Architecture

### 3.1 Schemas (`app/schemas/knowledge.py`)
- `KnowledgeRecommendation`:
  - `title: str` (document name)
  - `content: str` (clean chunk text)
  - `source: str` (e.g. `chunk:chunk_id | document:Payment_policy_v1.pdf | v1`)
  - `document_type: str` (e.g. `policy`, `faq`)
  - `relevance_score: float` (`0.0 <= score <= 1.0`)
- `KnowledgeRecommendationRequest`:
  - `query: str`
  - `session_id: Optional[int]`
  - `conversation_id: Optional[int]`
  - `conversation_history: Optional[List[Dict[str, Any]]]`
  - `analysis: Optional[Any]` (Task 4 result)
- `KnowledgeRecommendationResult`:
  - `query: str`
  - `recommendations: List[KnowledgeRecommendation]` (up to 5)
  - `no_relevant_information: bool`
  - `contextual_query: Optional[str]`
  - `session_id: Optional[int]`

### 3.2 Ingestion & ChromaDB/SQLite Integration
- Documents: Real PDFs (`Payment_policy_v1.pdf`, `Delivery_policy_v1.pdf`, `Cancel_policy_v1.pdf`, `Return_policy_v1.pdf`, `Fraud_policy_v1.pdf`) are ingested into SQLite `documents` table and chunked into ChromaDB persistent collection `support_knowledge_base` at `data/chroma_db`.
- SQLite Active Version Filtering: `get_latest_active_document_ids()` filters only active document IDs from SQLite `Document` table. Archived or obsolete versions are excluded during retrieval.
- Distance Conversion: ChromaDB returns L2 distance $d$. Converted via:
  $$\text{base\_relevance} = \frac{1.0}{1.0 + d}$$
- Task 4 Intent Alignment Boost: Bounded adjustment (up to +0.02) if chunk matches customer intent keywords.
- Relevance Threshold: `DEFAULT_RELEVANCE_THRESHOLD = 0.38`. If $\text{relevance\_score} < 0.38$, chunk is discarded.
- Out-of-Domain Signaling: If all retrieved candidates fall below 0.38, or query is unresolvable, `recommendations = []` and `no_relevant_information = True`.

---

## 4. End-to-End Request Flow for Customer Message Turns

```
Customer Simulator (Task 3)
           │
           │  Customer Message
           ▼
Intent & Sentiment Analysis Agent (Task 4)
           │  (analyze_customer_message -> AnalysisResult)
           │
           ├── Intent, Emotion, Frustration, Trend, Risk
           ▼
Knowledge Recommendation Agent (Task 5)
           │  (get_knowledge_recommendations -> KnowledgeRecommendationResult)
           │
           ├── Policy chunks or no_relevant_information=True
           ▼
AI Decision Support / Coaching Agent (Task 6 Phase 1)
           │  (generate_decision_support)
           │  • Suggested Response (context-aware & grounded)
           │  • Coaching Tips (actionable)
           │  • Response Evaluation (clarity, empathy, relevance, professionalism)
           ▼
Persisted in SQLite Message (System Snapshot)
           ▼
Returned to Frontend Support Console
           │
           ├─► Chat Timeline (Customer + Agent messages)
           ├─► Task 4 Analytical Cards (Intent, Emotion, Frustration)
           ├─► Task 5 Knowledge Cards (+ Use in Reply)
           └─► AI Decision Support Panel (Tips, Evaluation, "Use Suggested Tone in Reply")
```

### Turn Progression Details:
1. **Turn 1**:
   - `POST /simulator/start` generates customer opening complaint.
   - Task 4 executes live analysis (`AnalysisResult`).
   - Task 5 executes knowledge retrieval (`KnowledgeRecommendationResult`).
   - State, analysis, and recommendations are serialized in a System `Message` row.
   - Frontend displays opening turn, and triggers `GET /analysis/{session_id}/decision-support`.
   - `get_session_decision_support` reads latest turn snapshot, generates `DecisionSupportResult`, returned to UI.
2. **Turn N (Multi-turn)**:
   - Agent inputs reply (or clicks "Use Suggested Tone in Reply") and submits to `POST /support/turn`.
   - `process_support_turn`:
     1. Reconstructs state from latest System message.
     2. Persists Support Agent reply in `Message` table.
     3. Invokes Task 3 `generate_customer_turn` to produce next customer message.
     4. Persists new Customer message.
     5. Invokes Task 4 `analyze_customer_message`.
     6. Invokes Task 5 `get_knowledge_recommendations`.
     7. Persists new System message with updated state, analysis, recommendations.
     8. Returns `IntegratedTurnResponse`.
   - Frontend receives updated turn, increments `turn`, triggering `GET /analysis/{session_id}/decision-support`.
   - Updated `DecisionSupportResult` is fetched and rendered in the Decision Support panel.

---

## 5. Exact Schema Extension Proposal for `DecisionSupportResult`

To preserve 100% backward compatibility with all existing tests (such as `test_analysis_phase6.py` and `test_task4_final.py`), every added field **must** have a sensible default factory or default value.

### 5.1 Backend Pydantic Schemas (`app/schemas/analysis.py`)

```python
class EvaluationDimension(BaseModel):
    """Evaluation score and feedback for a single qualitative dimension."""
    score: float = Field(
        ...,
        ge=0.0,
        le=10.0,
        description="Dimension score on a 0.0 to 10.0 scale."
    )
    feedback: str = Field(
        ...,
        description="Actionable explanation or qualitative rationale for the score."
    )


class ResponseEvaluation(BaseModel):
    """Comprehensive 4-dimension qualitative evaluation of agent communication."""
    clarity: EvaluationDimension = Field(
        ...,
        description="Clarity of message: directness, readability, lack of ambiguity or technical jargon."
    )
    empathy: EvaluationDimension = Field(
        ...,
        description="Empathy and emotional attunement: validation of customer emotion, warmth, active listening."
    )
    relevance: EvaluationDimension = Field(
        ...,
        description="Relevance to customer issue: precision in answering question or addressing primary intent."
    )
    professionalism: EvaluationDimension = Field(
        ...,
        description="Professional demeanor: polite, brand-aligned, constructive, non-defensive tone."
    )
    overall_score: float = Field(
        ...,
        ge=0.0,
        le=10.0,
        description="Composite score (0.0 to 10.0) across all four dimensions."
    )
    summary: str = Field(
        default="",
        description="High-level coaching summary synthesizing evaluation."
    )


class DecisionSupportResult(BaseModel):
    """Deterministic, agent-ready decision support and coaching recommendations.

    Derived from Task 4 analysis signals, conversation history, and Task 5 knowledge.
    """
    # ---------------- Existing Protected Fields (Unchanged) ----------------
    priority: DecisionPriority = Field(
        ...,
        description="Action priority: low, medium, high, or critical."
    )
    recommended_tone: RecommendedTone = Field(
        ...,
        description="Recommended tone for responding to the customer."
    )
    recommended_action: RecommendedAction = Field(
        ...,
        description="Recommended operational action to take."
    )
    escalation_recommended: bool = Field(
        ...,
        description="Flag indicating if immediate supervisor escalation is recommended."
    )
    risk_flags: list[str] = Field(
        default_factory=list,
        description="List of detected risk flags."
    )
    customer_needs: list[CustomerNeed] = Field(
        default_factory=list,
        description="Primary customer needs mapped from intent."
    )
    rationale: str = Field(
        ...,
        description="Deterministic, explainable rationale for recommendations."
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score inherited directly from the analysis result."
    )
    session_id: int | None = Field(
        default=None,
        description="Optional simulator or support session ID."
    )
    turn_number: int | None = Field(
        default=None,
        description="Optional dialogue turn number."
    )

    # ---------------- Task 6 Phase 1 Extensions (With Safe Defaults) ----------------
    suggested_response: str = Field(
        default="",
        description="Context-aware, non-generic suggested response for the agent to use or adapt."
    )
    coaching_tips: list[str] = Field(
        default_factory=list,
        description="Actionable, context-specific coaching tips tailored to customer emotional state and intent."
    )
    response_evaluation: dict[str, Any] = Field(
        default_factory=dict,
        description="Structured evaluation metrics across clarity, empathy, relevance, and professionalism."
    )
```

### 5.2 Frontend TypeScript Interface (`frontend/src/types/index.ts`)

```typescript
export interface EvaluationDimension {
  score: number;
  feedback: string;
}

export interface ResponseEvaluation {
  clarity: EvaluationDimension;
  empathy: EvaluationDimension;
  relevance: EvaluationDimension;
  professionalism: EvaluationDimension;
  overall_score: number;
  summary?: string;
}

export interface DecisionSupportResult {
  priority: 'low' | 'medium' | 'high' | 'critical';
  recommended_tone: 'empathetic' | 'reassuring' | 'clarifying' | 'apologetic' | 'professional' | 'calm' | 'firm';
  recommended_action: 'resolve' | 'clarify' | 'apologize_and_resolve' | 'provide_status' | 'provide_instructions' | 'offer_options' | 'escalate';
  escalation_recommended: boolean;
  risk_flags: string[];
  customer_needs: string[];
  rationale: string;
  confidence: number;
  session_id?: number | null;
  turn_number?: number | null;
  // Task 6 Phase 1 extensions:
  suggested_response?: string;
  coaching_tips?: string[];
  response_evaluation?: ResponseEvaluation | Record<string, any>;
}
```

---

## 6. Context-Aware Generation & Anti-Hallucination Guardrail

### 6.1 Input Context Assembly
When generating `suggested_response`, `coaching_tips`, and `response_evaluation`, the generator takes:
- **Task 4 Analysis**: `intent`, `emotion`, `sentiment`, `frustration_level` (0–10), `satisfaction_trend`, `escalation_risk`, `confidence`.
- **Task 5 Knowledge**: `recommendations` list (`title`, `content`, `source`), and boolean `no_relevant_information`.
- **Dialogue History**: Prior turns (`sender_type`, `message_text`) and latest customer message.

### 6.2 Strict Anti-Hallucination Guardrail
- **Condition**: `no_relevant_information == True` or `len(recommendations) == 0`.
- **Rule**: The system **must not** invent specific policy clauses, refund timelines (e.g., "5 business days"), fee waivers, warranty lengths, or delivery guarantees.
- **Behavior**:
  - `suggested_response`: Expresses empathy, explicitly states that account verification or further information is needed, and requests necessary identifiers (e.g. order number, email) without claiming unverified policy promises.
  - `coaching_tips`: Includes explicit guidance:
    - `"Do not quote unverified policy timelines or guarantee refund/replacement until verified in the customer account."`
    - `"Ask targeted clarifying questions to identify order or transaction details."`
  - `response_evaluation`: Evaluates `relevance` and `clarity` on general assistance and clarification adherence rather than policy compliance.

### 6.3 Dual Generation Architecture (LLM + Deterministic Fallback)
1. **Primary Generation (Gemini LLM)**:
   - A structured prompt containing system instructions, conversation context, Task 4 analytical dimensions, and Task 5 knowledge chunks (or explicit `NO_KNOWLEDGE_AVAILABLE` flag).
   - Instructs model to output JSON with keys `suggested_response`, `coaching_tips`, and `response_evaluation`.
2. **Deterministic Fallback Generator (Failure Isolation)**:
   - When Gemini is offline, mocked, or encounters an exception, the deterministic generator constructs:
     - Tailored response using modular templates parameterized by `intent`, `emotion`, `recommended_tone`, and top retrieved knowledge chunk (if available).
     - Deterministic coaching tips selected by rules matching `frustration_level >= 7`, `emotion == 'angry'`, `emotion == 'confused'`, `escalation_risk == 'high'`, etc.
     - Deterministic evaluation scores calculated from tone alignment, intent alignment, and knowledge grounding.

### 6.4 The 8 Required Validation Scenarios

| Scenario | Intent | Emotion / Frustration | Knowledge Available? | Suggested Response Focus | Coaching Tips Focus |
|---|---|---|---|---|---|
| **1. Refund / Frustrated** | `refund` | `frustrated` (frustration: 7) | Yes (`Refund_policy_v2.pdf`) | Apologetic, empathetic; quotes exact refund timeframe (e.g. 5–7 days). | De-escalate first; validate frustration; set clear expectation from policy. |
| **2. Payment / Angry** | `payment_issue` | `angry` (frustration: 9) | Yes (`Payment_policy_v1.pdf`) | Calm, empathetic; provides checkout troubleshooting/bank hold info. | Acknowledge urgency immediately; avoid defensive tone; do not blame customer. |
| **3. Delivery / Confused** | `delivery_issue` | `confused` (frustration: 4) | Yes (`Delivery_policy_v1.pdf`) | Clarifying, reassuring; provides status inquiry and transit timeline. | Use clear, numbered steps; confirm shipping address; avoid jargon. |
| **4. Account / Login** | `account_issue` | `worried` / `neutral` (frustration: 3) | Yes (`Customer_Support_FAQ_v1.pdf`) | Clear step-by-step instructions for 2FA / password reset. | Provide direct security steps; offer password reset link; confirm access. |
| **5. Positive** | `general_inquiry` / `complaint` | `happy` / `satisfied` (frustration: 1) | Optional | Professional, warm, appreciative; confirms resolution. | Reinforce positive customer relationship; check if further help needed. |
| **6. With Task 5 Knowledge** | Any | Any | Yes (high relevance chunks) | Incorporates specific document terms, steps, or policy constraints. | Reference relevant policy section; guide customer through documented procedure. |
| **7. Out-of-Domain / No Knowledge** | Any | Any | **No** (`no_relevant_information=True`) | **Guards against fabricating policy**; asks for order/account details politely. | Explicitly warns: "Do not promise unverified policies; collect details first." |
| **8. Multi-Turn Progression** | Mixed | Shift from `frustrated` → `satisfied` | Yes | Adapts tone dynamically; acknowledges ongoing conversation progress. | Note customer's improving sentiment; maintain momentum toward resolution. |

---

## 7. Scope Boundaries (Task 6 Phase 1 ONLY)

Per the strict scope boundaries in `ORIGINAL_REQUEST.md`:
1. **Phase 1 Only**:
   - Scope is restricted to Coaching & Response Suggestion Agent:
     - Generating `suggested_response`
     - Generating `coaching_tips`
     - Generating `response_evaluation` (clarity, empathy, relevance, professionalism)
     - Enhancing existing AI Decision Support backend service and frontend card
     - Test coverage and regression verification
2. **Strict Exclusions**:
   - **NO** dedicated Task 6 Phase 2 Escalation Risk Monitoring Agent.
   - **NO** new escalation scoring algorithms, thresholds, alerts, or monitoring services.
   - **NO** Phase 3 supervisor notification/alert webhooks.
   - **NO** Phase 4 evaluation report documentation.
   - Reuses existing Task 4 `AnalysisResult.escalation_risk` and `DecisionSupportResult.escalation_recommended`.

---

## 8. Integration Plan & Verification Strategy

### 8.1 Backend Modification Checklist
1. `app/schemas/analysis.py`:
   - Add `EvaluationDimension`, `ResponseEvaluation`.
   - Extend `DecisionSupportResult` with `suggested_response`, `coaching_tips`, `response_evaluation` (safe defaults).
2. `app/services/decision_support_service.py`:
   - Implement `generate_suggested_response(...)`.
   - Implement `generate_coaching_tips(...)`.
   - Implement `generate_response_evaluation(...)`.
   - Update `generate_decision_support(...)` to accept optional `knowledge_recommendations`, `customer_message`, `dialogue_history`.
   - Update `get_session_decision_support(session_id, db)`:
     - Query latest System message in SQLite `Message` table.
     - Extract latest `recommendations` and latest `customer_message`.
     - Pass them into `generate_decision_support`.
3. `app/services/conversation_orchestration_service.py`:
   - In `start_orchestrated_session` and `process_support_turn`: optionally attach `decision_support` directly to the returned turn response dictionary and System message for instant frontend access without requiring a secondary round-trip.

### 8.2 Frontend Modification Checklist
1. `frontend/src/types/index.ts`:
   - Extend `DecisionSupportResult` interface with `suggested_response?`, `coaching_tips?`, `response_evaluation?`.
   - Add `ResponseEvaluation`, `EvaluationDimension` interfaces.
2. `frontend/src/components/SupportConsole.tsx`:
   - In the AI Decision Support section (lines 266–327):
     - Render coaching tips list.
     - Render evaluation metric pills/scores for Clarity, Empathy, Relevance, Professionalism.
     - Update "Use Suggested Tone in Reply" button to inject `decisionSupport.suggested_response` into `agentInput` (falling back to legacy templates if empty).
3. `frontend/src/components/DecisionSupportCard.tsx`:
   - Update to display new coaching tips and response evaluation metrics, and inject `suggested_response`.

### 8.3 Verification Test Suite
1. Create `tests/test_coaching_decision_support_phase1.py` with tests covering:
   - Schema validation and serialization with and without new fields.
   - All 8 scenarios in Section 6.4.
   - Anti-hallucination verification (`no_relevant_information=True`).
   - Backward compatibility with Task 4 and Task 5.
   - Deterministic fallback when Gemini is mocked/offline.
2. Run full regression suite:
   - `pytest tests/test_analysis_phase6.py` (53 tests)
   - `pytest tests/test_task4_final.py` (40+ tests)
   - `pytest tests/test_simulator.py` (16 tests)
   - `pytest tests/test_task5_core.py` (8 tests)
   - `pytest tests/test_task3_task4_integration.py` (32 tests)
   - `npm run build` in `final_project/frontend` (0 errors)
