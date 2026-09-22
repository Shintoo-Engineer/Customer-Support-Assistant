# Architectural Mapping & Codebase Analysis Report: Task 4 & Task 3 Integration

**Author:** explorer_codebase_1 (Teamwork Preview Explorer)  
**Date:** 2026-09-08 / 2026-09-09  
**Repository:** `C:\Users\shrushti\Customer-Support-Assistant\RAG-Pipeline-backend`  
**Current Test Suite Baseline:** **271/271 tests passing (100% success)**  

---

## Executive Summary

The `RAG-Pipeline-backend` contains a completed, production-hardened implementation of Task 3 (Customer Simulator Agent) and Task 4 Phases 1 through 6 (Intent & Sentiment Analysis Agent with Downstream Decision Support). The entire existing test suite (271 tests across 7 test files) passes with zero failures.

Task 3 acts as an interactive customer simulator simulating 6 personas across 5 support scenarios with an internal 5-dimension emotional state machine. Task 4 provides real-time multi-dimensional customer analysis (8 intents, 7 emotions, 3 sentiments, 0–10 frustration scores, 3 trends, 3 escalation risks) and deterministic downstream decision support (priority, tone, action, risk flags, customer needs, rationale) without secondary classifiers.

Live multi-turn integration is currently wired between Task 3 and Task 4 via FastAPI route handlers in `app/api/simulator.py` and persisted cleanly into existing SQLite tables without requiring schema modifications.

---

## 1. Task 4 Architecture Mapping (Phases 1–6)

### 1.1 Service Layers & Engine Structure

Task 4 is implemented cleanly across two primary service modules and one schema module:

1. **`app/services/analysis_service.py` (951 lines)**:
   - **Core Entry Point:** `analyze_customer_message(session_id: int, customer_message: str, db: DBSession) -> AnalysisResult`.
   - **Historical Analytics:** `get_analysis_history(session_id: int, db: DBSession) -> List[TurnAnalysis]`.
   - **Session Aggregation:** `get_session_analysis_summary(session_id: int, db: DBSession) -> SessionAnalysisSummary`.
   - **Metrics & Observability:** `get_analysis_metrics()` and `reset_analysis_metrics()`. Tracks total analyses, gemini vs fallback calls, validation failures, latency, and persistence failures.
   - **Context Extraction:** `get_conversation_context(session_id: int, db: DBSession)` retrieves session status, scenario category, and dialogue history from Task 3 tables.

2. **`app/services/decision_support_service.py` (338 lines)**:
   - **Core Entry Point:** `generate_decision_support(analysis_result: Any, history: Optional[List[TurnAnalysis]] = None) -> DecisionSupportResult`.
   - **Session Retrieval:** `get_session_decision_support(session_id: int, db: DBSession) -> DecisionSupportResult`.
   - **Deterministic Engines:**
     - `map_customer_needs(intent: CustomerIntent) -> List[CustomerNeed]`
     - `determine_priority(analysis: Any, history: Optional[List[TurnAnalysis]]) -> DecisionPriority`
     - `determine_recommended_tone(analysis: Any) -> RecommendedTone`
     - `determine_recommended_action(analysis: Any) -> RecommendedAction`
     - `collect_risk_flags(analysis: Any, history: Optional[List[TurnAnalysis]]) -> List[str]`

### 1.2 Rule Engines & Classification Logic

| Dimension | Scope / Values | Classification Methodology | Location in Code |
| :--- | :--- | :--- | :--- |
| **Intents (8)** | `refund`, `cancellation`, `delivery_issue`, `payment_issue`, `account_issue`, `complaint`, `return_exchange`, `general_inquiry` | Hybrid: Gemini LLM prompt (`build_analysis_prompt`) with strict JSON schema parsing; Fallback to `classify_intent_deterministic` with token weight dictionary (`INTENT_KEYWORDS`), back-reference matching ("that money", "cancel it"), and scenario category mapping. | `app/services/analysis_service.py:75-118, 264-305` |
| **Emotions (7)** | `happy`, `neutral`, `confused`, `worried`, `frustrated`, `angry`, `satisfied` | Hybrid: Gemini LLM first; Fallback to `classify_emotion_deterministic` checking prioritized affective keywords in order: `ANGRY` -> `FRUSTRATED` -> `WORRIED` -> `CONFUSED` -> `SATISFIED` -> `HAPPY` -> `NEUTRAL`. | `app/services/analysis_service.py:120-160, 307-337` |
| **Sentiments (3)** | `positive`, `neutral`, `negative` | Hybrid: Gemini LLM first; Fallback to `classify_sentiment_deterministic` derived from emotion polarity and lexical counters (positive/negative keywords). | `app/services/analysis_service.py:339-370` |
| **Frustration Scale** | Integer bounded strictly `0 <= frustration <= 10` | Deterministic algorithm `calculate_frustration_level`: Base mapped from emotion (`HAPPY: 0.0`, `SATISFIED: 1.0`, `NEUTRAL: 2.0`, `CONFUSED: 3.5`, `WORRIED: 4.5`, `FRUSTRATED: 7.0`, `ANGRY: 9.0`). Adjusted by sentiment (+1.5 / -2.0), CAPS words (+1.5), exclamation marks (+0.5 each, max +2.0), escalation requests (+2.5), repeated complaints (+2.0), multi-turn history (+1.0), and gratitude clamping (<= 1.0). Clamped via `max(0, min(10, int(round(score))))`. | `app/services/analysis_service.py:372-425` |
| **Satisfaction Trend** | `improving`, `declining`, `stable` | Deterministic algorithm `determine_satisfaction_trend`: Evaluates frustration delta and sentiment transitions compared to prior customer turn. `diff <= -2` or `negative -> neutral/positive` = `improving`; `diff >= 2` or `positive/neutral -> negative` = `declining`; otherwise `stable`. Single turn defaults to `stable`. | `app/services/analysis_service.py:427-464` |
| **Escalation Risk** | `low`, `medium`, `high` | Deterministic algorithm `determine_escalation_risk`: `LOW` if happy/satisfied or frustration <= 2 (without escalation request). `HIGH` if escalation request detected, frustration >= 8, or angry emotion + repeated complaints. `MEDIUM` if frustration >= 5, repeated complaints, or frustrated/worried emotion. | `app/services/analysis_service.py:466-485` |
| **Confidence** | Float bounded strictly `0.0 <= confidence <= 1.0` | Mathematical scoring `calculate_confidence`: Base 0.88 (LLM) or 0.82 (fallback), adjusted by polarity consistency (+0.06 / -0.08), explicit escalation/repetition signals (+0.04), and text evidence quality (weak tokens like "ok", "yes", "hello" penalized by -0.28; domain keywords rewarded by +0.04). Clamped in [0.10, 0.98] and rounded to 2 decimals. | `app/services/analysis_service.py:487-527` |

### 1.3 API Routers & Endpoints (`app/api/analysis.py`)

Router prefix `/analysis`, tagged `["Intent and Sentiment Analysis"]`, registered in `app/main.py`:

| Endpoint | Method | Input Schema | Response Model | Description & Status Codes |
| :--- | :--- | :--- | :--- | :--- |
| `/analysis/analyze` | `POST` | `AnalysisRequest` (`session_id > 0`, `customer_message` non-empty) | `AnalysisResponse` | Analyzes customer message within active session context. Returns 200, 404 (session not found), 422 (validation error). |
| `/analysis/{session_id}/history` | `GET` | Path param `session_id: int` | `List[TurnAnalysis]` | Retrieves chronological customer turn analyses from stored `System` snapshot messages. Returns 200, 404. |
| `/analysis/{session_id}/summary` | `GET` | Path param `session_id: int` | `SessionAnalysisSummary` | Computes aggregated session summary (dominant intent, latest emotion, latest sentiment, current frustration, current risk, overall trend direction, average confidence, turn count). Returns 200, 404. |
| `/analysis/{session_id}/decision-support` | `POST` / `GET` | Path param `session_id: int` | `DecisionSupportResult` | Generates deterministic decision support recommendations from latest analyzed state and history. Returns 200, 404. |
| `/analysis/metrics` | `GET` | None | `Dict[str, Any]` | Returns in-memory operational metrics (analyses counts, latencies, failure counters). Returns 200. |

### 1.4 Pydantic Models & Enums (`app/schemas/analysis.py`)

- **Enums**:
  - `CustomerIntent` (8 items)
  - `CustomerEmotion` (7 items)
  - `CustomerSentiment` (3 items)
  - `SatisfactionTrend` (3 items)
  - `EscalationRisk` (3 items)
  - `DecisionPriority`: `low`, `medium`, `high`, `critical`
  - `RecommendedTone`: `empathetic`, `reassuring`, `clarifying`, `apologetic`, `professional`, `calm`, `firm`
  - `RecommendedAction`: `resolve`, `clarify`, `apologize_and_resolve`, `provide_status`, `provide_instructions`, `offer_options`, `escalate`
  - `CustomerNeed`: `refund_request`, `cancellation_request`, `delivery_resolution`, `payment_resolution`, `account_assistance`, `complaint_resolution`, `return_or_exchange`, `information_request`
- **Models**:
  - `AnalysisRequest`: `session_id` (gt=0), `customer_message` (validated non-empty string).
  - `AnalysisResponse`: Public contract (`intent`, `emotion`, `sentiment`, `frustration_level` [0,10], `satisfaction_trend`, `escalation_risk`, `confidence` [0.0, 1.0]).
  - `AnalysisResult`: Inherits `AnalysisResponse`, adds internal tracing metadata (`session_id`, `conversation_id`, `message_id`, `turn_number`, `analysis_source`, `analysis_timestamp`). Includes `.to_response()` helper.
  - `TurnAnalysis`: Historical turn snapshot (`turn`, `intent`, `emotion`, `sentiment`, `frustration_level`, `satisfaction_trend`, `escalation_risk`, `confidence`, `analysis_source`, `timestamp`).
  - `SessionAnalysisSummary`: Aggregated session state (`session_id`, `dominant_intent`, `latest_emotion`, `latest_sentiment`, `current_frustration`, `current_escalation_risk`, `overall_satisfaction_direction`, `average_confidence`, `turn_count`).
  - `DecisionSupportResult`: Recommended operational action model (`priority`, `recommended_tone`, `recommended_action`, `escalation_recommended`, `risk_flags`, `customer_needs`, `rationale`, `confidence`, `session_id`, `turn_number`).

### 1.5 SQLite Persistence Architecture

- **Database Models** (`app/models/simulator.py` & `app/models/database.py`):
  - `scenarios` table: `scenario_id` (PK), `title`, `category`, `difficulty`, `objective`, `description`, `is_active`.
  - `sessions` table: `session_id` (PK), `agent_id`, `scenario_id` (FK to scenarios), `start_time`, `end_time`, `overall_score`, `status`.
  - `conversations` table: `conversation_id` (PK), `session_id` (FK to sessions, unique), `intent`, `sentiment`, `resolution_status`, `escalation_risk`, `created_at`.
  - `messages` table: `message_id` (PK), `conversation_id` (FK to conversations), `sender_type` ("Customer", "Support Agent", "AI"), `message_text`, `timestamp`, `message_type` ("Text", "System").
- **Analysis Snapshot Persistence Strategy**:
  - **No Schema Alterations Needed:** Task 4 reuses the existing `messages` table by writing internal state snapshots with `sender_type="AI"` and `message_type="System"`.
  - In `app/api/simulator.py`, every turn writes a JSON payload to `message_text`:
    ```json
    {
      "persona": "frustrated",
      "scenario": "refund",
      "state": {"frustration": 65, "trust": 40, ...},
      "analysis": {
        "intent": "refund",
        "emotion": "frustrated",
        "sentiment": "negative",
        "frustration_level": 7,
        "satisfaction_trend": "stable",
        "escalation_risk": "medium",
        "confidence": 0.88,
        "session_id": 1,
        "turn_number": 1,
        "analysis_source": "fallback",
        "analysis_timestamp": "..."
      }
    }
    ```
  - `get_analysis_history` queries only `Message.message_type == "System"`, parses the `analysis` key, and reconstructs `TurnAnalysis` records in strict chronological order.
  - Public Task 3 history endpoint (`GET /simulator/{session_id}/history`) explicitly filters out `Message.message_type == "System"`, ensuring customer/agent chat logs remain clean and unpolluted.
  - When `analyze_customer_message` runs, it also updates `Conversation.intent`, `Conversation.sentiment`, and `Conversation.escalation_risk` for immediate indexed row queries.

### 1.6 Decision Support Generator Mechanics (`app/services/decision_support_service.py`)

- **Design Principle:** 100% deterministic, explainable, and derived strictly from `AnalysisResult` signals and turn history. No secondary LLMs or classifiers.
- **Customer Need Mapping:** Direct 1:1 mapping from `CustomerIntent` (e.g. `REFUND -> refund_request`, `COMPLAINT -> complaint_resolution`, `DELIVERY_ISSUE -> delivery_resolution`).
- **Priority Rules:**
  - `CRITICAL`: High escalation risk (`HIGH`) combined with severe frustration (`>= 8`).
  - `HIGH`: Escalation risk `HIGH`, frustration `>= 8`, emotion `ANGRY`, or `>= 2` negative turns in history.
  - `MEDIUM`: Moderate frustration (`5–7`), negative sentiment, medium escalation risk, or `WORRIED`/`FRUSTRATED` emotion.
  - `LOW`: Mild/no frustration (`<= 4`), low escalation risk, and positive/neutral sentiment.
- **Recommended Tone Rules:**
  - `APOLOGETIC`: Severe frustration (`>= 8`) with `COMPLAINT` intent.
  - `CALM`: Severe frustration (`>= 8`).
  - `EMPATHETIC`: High escalation risk or `ANGRY`/`FRUSTRATED` emotion.
  - `REASSURING`: `WORRIED` emotion.
  - `CLARIFYING`: `CONFUSED` emotion.
  - `PROFESSIONAL`: Default, or `HAPPY`/`SATISFIED`/`NEUTRAL`.
- **Recommended Action Rules:**
  - `ESCALATE`: High escalation risk or extreme frustration (`>= 9`).
  - `APOLOGIZE_AND_RESOLVE`: `COMPLAINT` intent.
  - `PROVIDE_STATUS`: `DELIVERY_ISSUE` intent.
  - `PROVIDE_INSTRUCTIONS`: `PAYMENT_ISSUE` or `GENERAL_INQUIRY`.
  - `CLARIFY`: `ACCOUNT_ISSUE`.
  - `OFFER_OPTIONS`: `RETURN_EXCHANGE`.
  - `RESOLVE`: `REFUND`.
- **Risk Flags:** Deduplicated list extracted from signals: `critical_frustration`, `high_frustration`, `negative_sentiment`, `angry_customer`, `high_escalation_risk`, `medium_escalation_risk`, `declining_satisfaction`, `low_analysis_confidence`, `repeated_negative_sentiment`, `repeated_complaints`.
- **Rationale:** Human-readable explanation synthesizing intent, emotion, frustration, recommended action, tone, and flags.

---

## 2. Task 3 Customer Simulator Interface & Contracts

### 2.1 Protected Baseline

Per strict user requirements, the Customer Simulator is **PROTECTED**:
1. **Personas (`app/services/persona_service.py`)**: 6 personas (`calm`, `confused`, `frustrated`, `angry`, `impatient`, `polite`) with predefined tones, escalation tendencies, and sample phrases. Must NOT be modified.
2. **Scenarios (`app/services/scenario_service.py`)**: 5 scenarios (`refund`, `delayed_order`, `payment_failure`, `account_issue`, `cancellation`) with opening complaints, key facts, and resolution conditions. Must NOT be modified.
3. **Emotional State Engine (`app/services/simulator_state.py`)**:
   - 5 state dimensions on a `[0, 100]` integer scale: `frustration`, `trust`, `patience`, `satisfaction`, `escalation_intent`.
   - `initial_state(...)`: sets initial levels based on severity (1-5), patience (1-5), initial emotion, and persona multiplier.
   - `update_state(...)`: responds to empathy signals (`EMPATHY_SIGNALS`), dismissive signals (`DISMISSIVE_SIGNALS`), message length, and persona multipliers (`low: 0.7`, `medium: 1.0`, `high: 1.5`).
   - `is_resolved(state)`: `satisfaction >= 75` and `frustration <= 25`.
   - `is_escalated(state)`: `escalation_intent >= 85`.
4. **Simulator API Contracts (`app/api/simulator.py`)**:
   - `POST /simulator/start` -> Body: `SimulatorStartRequest(session_label, persona, scenario, initial_emotion, issue_severity, patience_level, expected_resolution)`. Response: `{session_id, conversation_id, customer_message, state, turn: 1, (optional analysis)}`.
   - `POST /simulator/message` -> Body: `SimulatorMessageRequest(session_id, agent_response)`. Response: `{session_id, customer_message, state, turn, is_resolved, is_escalated, (optional analysis)}`.
   - `GET /simulator/{session_id}/history` -> Response: `{session_id, status, messages: [...]}` (non-system messages).
   Must NOT be modified.

### 2.2 Continuous Multi-Turn Dialogue Loop (R1 Integration)

The runtime integration operates seamlessly turn-by-turn:
```
[Turn 1] POST /simulator/start
  │
  ├─► Creates Scenario, Session, Conversation in SQLite
  ├─► Customer opening message persisted (sender_type='Customer', message_type='Text')
  ├─► Task 4 live analysis runs via analyze_customer_message(...)
  ├─► System snapshot persisted (sender_type='AI', message_type='System')
  └─► Returns turn 1 data + analysis snapshot

[Turn 2] Support Agent responds via POST /simulator/message
  │
  ├─► Agent response persisted (sender_type='Support Agent', message_type='Text')
  ├─► Task 3 generates next customer message (Gemini or persona fallback)
  ├─► State machine updates (frustration, trust, patience, satisfaction, escalation)
  ├─► Customer message persisted (sender_type='Customer', message_type='Text')
  ├─► Task 4 live analysis runs on new customer message (with full conversation context)
  ├─► Updated System snapshot persisted (state + analysis)
  ├─► Conversation row updated (intent, sentiment, escalation_risk)
  ├─► Checks resolution or escalation -> updates session status if completed
  └─► Returns turn 2 data + updated analysis snapshot

[Turn N] Downstream Decision Support via GET/POST /analysis/{session_id}/decision-support
  │
  ├─► Retrieves latest analysis and turn history
  └─► Produces DecisionSupportResult (priority, tone, action, risk flags, needs, rationale)
```

**Key Verification Facts**:
- Turn numbers increment cleanly (`turn=1`, `turn=2`, `turn=3`).
- Previous turns serve as chronological dialogue context.
- Zero duplicate messages or snapshot entries.
- Complete session isolation: operations on Session A never alter or read Session B data.

---

## 3. Gemini Integration & Fallback Resilience (R3)

### 3.1 Gemini Client Initialization & Call Sites

- **Client Setup (`app/services/rag_service.py:26-40`)**:
  - Uses new `google-genai` SDK (`from google import genai`).
  - Reads `GEMINI_API_KEY` from environment.
  - Client instance: `client = genai.Client(api_key=api_key)`.
  - Models:
    - Primary: `PRIMARY_MODEL = "gemini-3.5-flash"`
    - Fallback: `FALLBACK_MODEL = "gemini-3.5-flash-lite"`
- **Call Sites**:
  1. `app/services/rag_service.py` -> `generate_with_gemini(prompt: str)`: attempts `gemini-3.5-flash` with 2 attempts (retrying with 3s backoff on 503/UNAVAILABLE), then fails over to `gemini-3.5-flash-lite`.
  2. `app/services/simulator_service.py:177` -> `generate_customer_turn`: invokes `generate_with_gemini(prompt)` to generate in-character customer dialogue.
  3. `app/services/analysis_service.py:652` -> `analyze_customer_message`: invokes `generate_with_gemini(prompt)` with structured JSON prompt requesting `intent`, `emotion`, `sentiment`, `confidence`.

### 3.2 Deterministic Fallback Triggers & Behavior

Fallback is triggered under any of the following conditions:
1. `GEMINI_API_KEY` missing, invalid, or unconfigured.
2. Network timeout, offline environment, DNS failure, or connection drop.
3. API rate limits (HTTP 429), quota exhaustion, or service unavailability (HTTP 503).
4. Any exception raised by `generate_with_gemini`.
5. Empty response, non-JSON response, or malformed markdown output from Gemini.
6. Validation failure: LLM returns an invalid intent, emotion, or sentiment string outside the permitted enum definitions.

When fallback triggers:
- `analysis_source` is explicitly marked as `"fallback"`.
- `ANALYSIS_METRICS["fallback_analyses"]` counter increments.
- Deterministic linguistic keyword matching (`classify_intent_deterministic`, `classify_emotion_deterministic`, `classify_sentiment_deterministic`) classifies the message.
- Bounded deterministic algorithms calculate `frustration_level`, `satisfaction_trend`, `escalation_risk`, and `confidence`.
- The returned `AnalysisResult` contract is 100% compliant with all Pydantic validations, enum boundaries, and schema types.

### 3.3 Failure Isolation (Simulation Continuity)

Failure isolation is implemented at multiple defensive layers:
1. **Simulator API Layer (`app/api/simulator.py:159-171, 329-341`)**:
   Calls to `analyze_customer_message` in `/simulator/start` and `/simulator/message` are wrapped in explicit `try...except Exception as e` blocks:
   ```python
   try:
       analysis_resp = analyze_customer_message(...)
       if analysis_resp:
           analysis_dict = analysis_resp.model_dump()
   except Exception as e:
       logger.warning("Task 4 turn analysis gracefully bypassed on exception: %s", e)
   ```
   If Task 4 or Gemini crashes or fails, the simulation turn completes successfully, returns customer turn data, and updates simulator state. The customer simulation NEVER crashes due to an analysis failure.
2. **Simulator Service Layer (`app/services/simulator_service.py:176-189`)**:
   Calls to `generate_with_gemini` in `generate_customer_turn` are wrapped in `try...except Exception as e`:
   ```python
   try:
       raw_response = generate_with_gemini(prompt)
       customer_message = _clean_customer_message(raw_response)
       if not customer_message:
           raise ValueError("Empty response received from Gemini.")
   except Exception as e:
       customer_message = sample_phrases[0] ...
   ```
   If Gemini fails while generating the customer message, Task 3 falls back to deterministic persona sample phrases, allowing the simulation to proceed seamlessly.
3. **Database Layer (`app/services/analysis_service.py:782-795`)**:
   Updating the `Conversation` table is wrapped in `try...except Exception as db_err`, rolling back transactions cleanly on error without breaking the caller.

---

## 4. Test Suite Baseline Verification

A full test run executed directly on the codebase confirms 100% pass rate:

```
collected 271 items

tests\test_analysis_phase1.py ...............                            [  5%]  (15/15 PASS)
tests\test_analysis_phase2.py .......................................... [ 21%]
............................                                             [ 31%]  (70/70 PASS)
tests\test_analysis_phase4.py .......................................... [ 46%]
........                                                                 [ 49%]  (50/50 PASS)
tests\test_analysis_phase5.py ...................................        [ 62%]  (35/35 PASS)
tests\test_analysis_phase6.py .......................................... [ 78%]
...........                                                              [ 82%]  (53/53 PASS)
tests\test_simulator.py ................                                 [ 88%]  (16/16 PASS)
tests\test_task3_task4_integration.py ................................   [100%]  (32/32 PASS)

================ 271 passed, 490 warnings in 168.76s (0:02:48) ================
```

### Gap Analysis for Combined Phase 7 & 8:
To fulfill the requirements of `ORIGINAL_REQUEST.md`:
1. **Dedicated Final Validation Test Suite (`tests/test_task4_final.py`)**:
   - Needs 40–60 comprehensive automated tests validating multi-turn loop (3–5 turns), all 8 intents, all 7 emotions, all 3 sentiments, boundary frustration values (0, 1, 4, 5, 7, 8, 9, 10), trends, escalation risks, session isolation, Gemini fallback resilience, and endpoint integrity.
   - Adding 40–60 tests will bring total tests to 311–331 tests (all passing).
2. **Final Documentation (`docs/TASK4_FINAL.md`)**:
   - Needs to be authored detailing architecture, contracts, database persistence, Gemini/fallback mechanics, error handling, observability, testing, and deliverable matrix.
3. **Completion Report**:
   - Structured completion report covering Sections A through L.

---

## 5. Architectural Findings & Key Insights

1. **Clean Separation of Concerns**: Task 4 is cleanly layered — HTTP routing in `app/api/analysis.py`, core business logic in `app/services/analysis_service.py`, decision recommendation rules in `app/services/decision_support_service.py`, and domain models in `app/schemas/analysis.py`.
2. **Zero Schema Migration Overhead**: Persisting analysis snapshots inside `Message.message_type="System"` JSON records is elegant and avoids destructive DDL changes to SQLite tables (`sessions`, `conversations`, `messages`).
3. **Deterministic Downstream Safety**: Because `DecisionSupportResult` is purely rule-based and derived from verified signals, downstream systems (or future agents) receive predictable, explainable, and reproducible outputs without additional API cost or non-deterministic variance.
4. **Resilient Failure Isolation**: Both Task 3 and Task 4 have explicit fallback paths; an outage or rate limit on Gemini never breaks the HTTP API or customer simulation.
