# Specification: Task 4 Phases 7 & 8 — Intent & Sentiment Analysis Agent

- **Miner**: `spec_miner_1` (teamwork_preview_spec_miner)
- **Target Project**: `Customer-Support-Assistant / RAG-Pipeline-backend`
- **Target Phase**: Task 4 Phase 7 (End-to-End Runtime Integration) & Phase 8 (Comprehensive Final Validation, Test Suite & Documentation)
- **Authoritative Sources**:
  - `C:\Users\shrushti\Customer-Support-Assistant\.agents\ORIGINAL_REQUEST.md`
  - `RAG-Pipeline-backend/app/schemas/analysis.py`
  - `RAG-Pipeline-backend/app/models/simulator.py`
  - `RAG-Pipeline-backend/app/api/analysis.py`
  - `RAG-Pipeline-backend/app/api/simulator.py`
  - `RAG-Pipeline-backend/app/services/analysis_service.py`
  - `RAG-Pipeline-backend/app/services/decision_support_service.py`
  - `RAG-Pipeline-backend/app/services/rag_service.py`
  - `RAG-Pipeline-backend/tests/test_simulator.py`
  - `RAG-Pipeline-backend/tests/test_analysis_phase1.py` through `test_analysis_phase6.py`
  - `RAG-Pipeline-backend/tests/test_task3_task4_integration.py`

---

## 1. System Architecture & Scope Boundaries

### 1.1 Scope Boundaries & Protected Baselines
- **Task 3 Customer Simulator is Protected**:
  - Zero modifications permitted to Task 3 personas (`calm`, `confused`, `frustrated`, `angry`, `impatient`, `polite`).
  - Zero modifications to scenarios (`refund`, `delayed_order`, `payment_failure`, `account_issue`, `cancellation`).
  - Zero modifications to emotional state engine (`initial_state`, `update_state`, `is_resolved`, `is_escalated`).
  - Strict preservation of API contracts (`POST /simulator/start`, `POST /simulator/message`, `GET /simulator/{session_id}/history`).
- **Task 4 Architecture (Phases 1–6) is Protected**:
  - Existing `AnalysisResult`, `TurnAnalysis`, `SessionAnalysisSummary`, and `DecisionSupportResult` schemas must be preserved.
  - Zero secondary classifiers or redundant LLM calls.
  - Strict boundary: Task 4 terminates at providing analysis results, session summary, turn history, and agent decision support. Downstream agents (Coaching Agent, Response Suggestion Agent, Escalation Agent, RAG Pipeline) must NOT be implemented.

---

## 2. Formal Specification of Requirements R1 through R7

### R1. Multi-Turn End-to-End Runtime Integration (Task 3 ↔ Task 4)
- **Dialogue Loop**: Supports continuous multi-turn dialogue over 3–5 turns per session:
  $$\text{Customer Message} \longrightarrow \text{Task 4 Analysis} \longrightarrow \text{Analysis Persisted} \longrightarrow \text{Support Response} \longrightarrow \text{Task 3 Next Customer Turn} \longrightarrow \text{Task 4 Analysis Updated} \longrightarrow \text{Decision Support Generated}$$
- **Sequence of Operations**:
  1. **Turn 1 (Session Start)**:
     - Client calls `POST /simulator/start`.
     - Simulator generates initial opening customer message from scenario configuration (`opening_complaint`).
     - Simulator invokes `analyze_customer_message(session_id, customer_message, db)` within a failure-isolated try/except block.
     - `AnalysisResult` is returned and persisted as a `Message` record with `message_type="System"`, serializing `{"persona": ..., "scenario": ..., "state": ..., "analysis": analysis_dict}`.
     - `Conversation` table record is updated with `intent`, `sentiment`, `escalation_risk`.
     - Response returned with `turn: 1`, `customer_message`, `state`, and `analysis`.
  2. **Subsequent Customer Turns (Turns 2 through 5)**:
     - Client calls `POST /simulator/message` providing `session_id` and `agent_response`.
     - Simulator appends support agent response to `messages` table (`sender_type="Support Agent"`, `message_type="Text"`).
     - Simulator generates next customer turn via `generate_customer_turn(...)`.
     - Customer message appended to `messages` table (`sender_type="Customer"`, `message_type="Text"`).
     - Turn counter increments deterministically: $\text{turn} = \text{prior\_customer\_turns} + 1$.
     - Task 4 `analyze_customer_message` is invoked with the new customer message.
     - Task 4 loads conversation context (last 6 dialogue messages), resolving contextual back-references and recurring complaints.
     - New analysis snapshot is persisted as a `System` message.
     - `Conversation` record is updated with the latest analytical state.
  3. **Decision Support Generation**:
     - Client or downstream service calls `GET /analysis/{session_id}/decision-support` or `POST /analysis/{session_id}/decision-support`.
     - Service retrieves chronological turn history and evaluates latest turn analysis combined with historical trajectory to produce `DecisionSupportResult`.
- **Deduplication & Database Cleanliness**:
  - `POST /simulator/start` creates exactly 1 `Session` and 1 `Conversation` record.
  - `GET /simulator/{session_id}/history` returns ONLY dialogue messages (`sender_type="Customer"` or `"Support Agent"`), strictly excluding internal `System` state/analysis rows.
  - `GET /analysis/{session_id}/history` returns turn analyses parsed from `System` messages, deduplicating turn numbers so each customer turn appears exactly once.

---

### R2. Comprehensive Analytical Coverage Catalog

#### 1. 8 Customer Intents
| Intent Enum Value | Name | Description | Keywords / Match Criteria | Mapped CustomerNeed |
|---|---|---|---|---|
| `refund` | Refund Request | Demands for reimbursement, billing dispute, double charge, money back | refund, money back, reimburse, overcharged, charged twice, chargeback, billing error | `refund_request` |
| `cancellation` | Cancellation Request | Requests to terminate account, order, service, or recurring subscription | cancel, cancellation, terminate, stop subscription, unsubscribe, opt out, discontinue, end my plan | `cancellation_request` |
| `delivery_issue` | Delivery Issue | Shipping delay, missing parcel, tracking inquiry, transit damage | delivery, shipping, shipment, tracking, courier, package, parcel, order late, hasn't arrived, delayed, lost package | `delivery_resolution` |
| `payment_issue` | Payment Issue | Transaction failures, card declined, 3DS authentication errors, checkout timeout | card declined, payment failed, credit card, debit card, checkout, transaction, 3ds, declined, timing out | `payment_resolution` |
| `account_issue` | Account Assistance | Login lockout, password reset, 2FA/MFA problems, credential errors | account, log in, login, password, locked out, 2fa, authenticator, mfa, reset password, security code | `account_assistance` |
| `complaint` | Service Complaint | Dissatisfaction with agent, poor service quality, unacceptable treatment | formal complaint, file a complaint, terrible, horrible, awful, unacceptable, ridiculous, poor service, worst | `complaint_resolution` |
| `return_exchange` | Return or Exchange | Item return, size/color exchange, damaged product replacement | exchange, swap, wrong size, replace, replacement, return item, send back, defective item | `return_or_exchange` |
| `general_inquiry` | General Inquiry | Informational requests, business hours, pricing, policies, FAQ | hours, pricing, cost, how does, what is, support contact, phone number, information, policy, faq | `information_request` |

#### 2. 7 Customer Emotions
| Emotion Enum Value | Name | Affective State Description | Scoring Base | Typical Phrasing |
|---|---|---|---|---|
| `happy` | Happy | Delighted, pleased, joyful | 0.0 | "Thank you so much!", "Wonderful service!", "Awesome, love this!" |
| `neutral` | Neutral | Objective, matter-of-fact, calm | 2.0 | "What are your business hours?", "Checking status on order #1234." |
| `confused` | Confused | Perplexed, uncertain, lacks clarity | 3.5 | "I don't understand what this fee is.", "Not sure what link to click." |
| `worried` | Worried | Anxious, nervous, fearful of loss/lockout | 4.5 | "I'm worried my account was compromised.", "Hope my package isn't lost." |
| `frustrated` | Frustrated | Exasperated, annoyed, tired of waiting | 7.0 | "I already told you twice!", "This is taking way too long.", "Still waiting!" |
| `angry` | Angry | Aggressive, furious, combative | 9.0 | "Get me your manager right now!", "This is completely unacceptable!", "Lawyer!" |
| `satisfied` | Satisfied | Relieved, content with issue resolution | 1.0 | "That fixed it, thank you.", "All sorted now, appreciate your help." |

#### 3. 3 Sentiment Polarities
- `positive`: Associated with `happy`, `satisfied`, or strong positive lexicon.
- `neutral`: Objective, matter-of-fact, balanced polarity.
- `negative`: Associated with `angry`, `frustrated`, `worried`, or problem/failure lexicon.

#### 4. Frustration Scale [0, 10] Integer Bounds & Boundary Values
- **Bounds**: Strictly bounded integer: $0 \le \text{frustration\_level} \le 10$.
- **Base Scoring Algorithm**:
  $$\text{score} = \text{base}(\text{emotion}) + \Delta_{\text{sentiment}} + \Delta_{\text{caps}} + \Delta_{\text{excl}} + \Delta_{\text{escalation}} + \Delta_{\text{repeated}} + \Delta_{\text{history}}$$
  - $\text{base}(\text{emotion})$: Happy (0.0), Satisfied (1.0), Neutral (2.0), Confused (3.5), Worried (4.5), Frustrated (7.0), Angry (9.0).
  - $\Delta_{\text{sentiment}}$: $+1.5$ if Negative and score $< 6.0$; $-2.0$ if Positive and score $> 2.0$.
  - $\Delta_{\text{caps}}$: $+1.5$ if $\ge 2$ capitalized words of length $\ge 3$.
  - $\Delta_{\text{excl}}$: $+0.5$ per '!' (max $+2.0$).
  - $\Delta_{\text{escalation}}$: $+2.5$ if supervisor escalation phrases detected.
  - $\Delta_{\text{repeated}}$: $+2.0$ if repeated complaint indicators detected.
  - $\Delta_{\text{history}}$: $+1.0$ if $\ge 2$ prior customer turns with negative emotion.
  - Resolution Clamp: If resolving/gratitude phrase present ("thank you", "resolved", "fixed"), score clamped to $\le 1$.
  - Clamping: $\text{frustration\_level} = \max(0, \min(10, \text{round}(\text{score})))$.
- **Key Boundary Values**:
  - `0`: Completely calm/happy interaction.
  - `1`: Successfully resolved or satisfied customer.
  - `4`: Mild confusion or low-severity concern.
  - `5`: Medium frustration threshold; transitions escalation risk to `medium`.
  - `7`: High frustration baseline (standard frustrated emotion).
  - `8`: Severe frustration threshold; triggers `high` escalation risk and `critical` decision priority.
  - `9`: Extreme frustration (angry baseline); triggers `RecommendedAction.ESCALATE`.
  - `10`: Maximum saturation ceiling (angry + escalation threats + caps + exclamations).

#### 5. Satisfaction Trends Across Turns
- Evaluated directionally against prior customer turn:
  - `improving`: Frustration decreases by $\ge 2$ points, OR sentiment shifts from `negative` to `neutral`/`positive`.
  - `declining`: Frustration increases by $\ge 2$ points, OR sentiment shifts from `positive`/`neutral` to `negative`.
  - `stable`: Frustration differential strictly within $(-2, +2)$ without sentiment polarity reversal; also initial baseline for Turn 1.

#### 6. Escalation Risk Levels
- `low`: Customer emotion is `happy` or `satisfied`, OR frustration $\le 2$ without explicit escalation threats.
- `medium`: Frustration between $5$ and $7$, OR repeated complaint detected, OR emotion in `[frustrated, worried]`.
- `high`: Frustration $\ge 8$, OR explicit supervisor escalation phrase detected, OR angry emotion with repeated complaints.

#### 7. Confidence Score Bounds
- Bounded float: $0.0 \le \text{confidence} \le 1.0$, rounded to 2 decimal places.
- Base: $0.88$ (Gemini LLM) / $0.82$ (Deterministic Fallback).
- Modifiers:
  - Emotional alignment: $+0.02$ to $+0.06$.
  - Explicit signals (repeated/escalation): $+0.04$.
  - Strong domain keywords: $+0.04$.
  - Ambiguous text: $-0.10$.
  - Short/weak tokens ("ok", "yes", "hi"): $-0.28$.
  - Dynamic bounds: $[0.10, 0.98]$ in service; schema validator guarantees $[0.0, 1.0]$.

---

### R3. Gemini vs Fallback Resilience & Failure Isolation
1. **Deterministic Fallback Engine**:
   - Executes if Gemini is offline, mock credentials used, network timeout occurs, or LLM output fails schema validation.
   - Operates with zero network dependencies using compiled keyword dictionaries and rule-based state evaluators.
   - Guarantees complete `AnalysisResult` and `DecisionSupportResult` schema compliance with identical field definitions.
   - Sets `analysis_source="fallback"`.
2. **Failure Isolation in Task 3 Runtime**:
   - In `app/api/simulator.py`, Task 4 analysis calls are wrapped in `try ... except Exception as e`.
   - Any unhandled exception during analysis logs a warning and allows Task 3 simulation to proceed without returning 500.
   - Database operations rollback on failure to maintain database integrity.
3. **Real Gemini Execution Reporting Criteria**:
   - `PASS`: Live `GEMINI_API_KEY` present and authorized, Gemini endpoint returns valid structured JSON, successfully validated into `AnalysisResult` with `analysis_source="gemini"`.
   - `FAIL`: Real Gemini key supplied, but API returns HTTP error, schema validation fails, or unrecoverable error occurs without fallback.
   - `NOT RUN — credentials/network/model unavailable`: Environment contains dummy key (e.g. `test_gemini_api_key`) or is offline. Tests verify deterministic fallback behavior.

---

### R4. Session Isolation & Concurrency Safety
1. **Multi-Session Independence**:
   - Multiple concurrent sessions (e.g., Session A and Session B) run simultaneously in the same backend runtime.
   - All state retrieval, turn histories, summaries, and decision support queries filter strictly by `session_id`.
   - Database foreign keys (`session_id` on `conversations`, `conversation_id` on `messages`) enforce relational isolation.
2. **Zero Cross-Contamination**:
   - Customer turns in Session A do not alter or appear in Session B history.
   - Satisfaction trends in Session A do not influence trend calculations in Session B.
   - Dominant intent in Session A summary is derived exclusively from Session A messages.

---

### R5. Dedicated Final Validation Test Suite (`tests/test_task4_final.py`)
- Target: 40–60 comprehensive automated tests covering 4 tiers:
  - **Tier 1: Feature Coverage (15–18 tests)**
  - **Tier 2: Boundary & Corner Cases (12–15 tests)**
  - **Tier 3: Cross-Feature & Combinations (10–12 tests)**
  - **Tier 4: Real-World & E2E Workloads (8–10 tests)**
- Target Execution: 100% pass rate across `tests/test_task4_final.py` and the entire 271+ existing regression test suite.

---

### R6. API & SQLite Database Integrity Audit
1. **Endpoints Audited**:
   - `POST /analysis/analyze`
   - `GET /analysis/{session_id}/history`
   - `GET /analysis/{session_id}/summary`
   - `POST /analysis/{session_id}/decision-support`
   - `GET /analysis/{session_id}/decision-support`
   - `GET /analysis/metrics`
2. **OpenAPI Schema Compliance**:
   - FastAPI `/openapi.json` documents all models, enums, parameters, and responses.
3. **Database Integrity**:
   - Relies strictly on existing tables: `sessions`, `conversations`, `messages`.
   - Zero new tables or schema migrations required.

---

### R7. Documentation Structure for `docs/TASK4_FINAL.md`
- Sections A through L detailed in Section 3 below.

---

## 3. Detailed Structure for `docs/TASK4_FINAL.md` (Sections A through L)

```markdown
# TASK 4 FINAL DOCUMENTATION — Intent & Sentiment Analysis Agent

## Section A: Executive Summary & System Overview
- Purpose and role of Task 4 in AI Coaching Agent architecture.
- Combined Phase 7 & 8 scope and achievements.
- Protected architectural boundaries and non-goals (no downstream agents implemented).

## Section B: Architectural Design & Multi-Turn Integration Pipeline
- System diagram: Task 3 Customer Simulator ↔ Task 4 Analysis Agent.
- Multi-turn interaction loop (Turns 1 through 5).
- Sequence of calls, payload schemas, and turn lifecycle.

## Section C: Comprehensive Analytical Catalog & Schema Definitions
- 8 Customer Intents (definitions, keyword mappings, needs).
- 7 Customer Emotions (definitions, affective base scores, phrasing).
- 3 Customer Sentiments (polarity definitions, alignment rules).
- Frustration Scale [0, 10] (formula, boundary values 0, 1, 4, 5, 7, 8, 9, 10, escalation triggers).
- Satisfaction Trends (improving, declining, stable progression logic).
- Escalation Risk Levels (low, medium, high multi-signal criteria).
- Confidence Bounds [0.0, 1.0] (base score, evidence modifiers).

## Section D: Downstream Decision Support Engine
- Architecture of deterministic recommendation layer (Phase 6).
- DecisionSupportResult schema and fields.
- DecisionPriority (critical, high, medium, low).
- RecommendedTone (empathetic, reassuring, clarifying, apologetic, professional, calm).
- RecommendedAction (resolve, clarify, apologize_and_resolve, provide_status, provide_instructions, offer_options, escalate).
- CustomerNeed mapping (8 categories).
- Deterministic Risk Flags (collection, deduplication).
- Explainable Rationale generation.

## Section E: Hybrid LLM & Deterministic Fallback Resilience
- Gemini 2.5/3.5 Flash prompt structure and contract enforcement.
- JSON extraction, markdown stripping, and normalization logic.
- Deterministic Fallback Engine architecture and keyword dictionaries.
- Graceful degradation and failure isolation in simulator loop.
- Real Gemini execution status reporting (PASS / FAIL / NOT RUN).

## Section F: Session Isolation, Concurrency Safety & State Management
- Concurrency model and multi-session isolation guarantees.
- Session A vs Session B test scenario verification.
- In-memory metrics vs relational persistence safety.
- Idempotency and duplicate request protection.

## Section G: SQLite Database Persistence & Schema Integrity
- Database schema audit: `sessions`, `conversations`, `messages`.
- Non-invasive state persistence via `System` message records.
- Conversation summary synchronization.
- Transaction boundaries, commit, and rollback error handling.

## Section H: REST API Reference & OpenAPI Specification
- Complete endpoint reference:
  - `POST /analysis/analyze`
  - `GET /analysis/{session_id}/history`
  - `GET /analysis/{session_id}/summary`
  - `POST /analysis/{session_id}/decision-support`
  - `GET /analysis/{session_id}/decision-support`
  - `GET /analysis/metrics`
- Request/response contracts, HTTP status codes (200, 404, 422), OpenAPI JSON verification.

## Section I: Observability, Logging, Metrics & Error Handling
- Structured logging specifications (`analysis_started`, `analysis_completed`, `analysis_persisted`).
- In-memory operational metrics counters (`ANALYSIS_METRICS`).
- Latency tracking and SLA monitoring.
- Error recovery and warning propagation.

## Section J: Test Strategy & Full Verification Matrix
- Multi-tier testing methodology (Tiers 1 through 4).
- Structure and breakdown of `tests/test_task4_final.py` (40–60 tests).
- Regression test suite verification (271+ tests, 100% pass rate).
- Test environment isolation and database teardown fixtures.

## Section K: Deliverable Matrix & Requirement Traceability
- Complete mapping matrix linking Requirements R1 through R7 to:
  - Concrete source files
  - Key functions and endpoints
  - Database tables
  - Automated test cases

## Section L: Verification, Runbook & Operational Procedures
- Environment setup and requirements verification.
- Test suite execution commands (`pytest` invocation).
- OpenAPI documentation verification instructions.
- Real Gemini configuration and troubleshooting guide.
```

---

## 4. Comprehensive Test Case Inventory for `tests/test_task4_final.py` (Target: 40–60 Tests)

### Tier 1: Feature Coverage (Core Analytical Dimensions & Endpoints) [16 Tests]
1. `test_tier1_all_eight_intents_classification`: Verifies deterministic classification across all 8 intents (`refund`, `cancellation`, `delivery_issue`, `payment_issue`, `account_issue`, `complaint`, `return_exchange`, `general_inquiry`).
2. `test_tier1_all_seven_emotions_classification`: Verifies classification across all 7 emotions (`happy`, `neutral`, `confused`, `worried`, `frustrated`, `angry`, `satisfied`).
3. `test_tier1_all_three_sentiments_classification`: Verifies positive, neutral, and negative sentiment classification.
4. `test_tier1_frustration_base_scoring_by_emotion`: Validates base frustration score calculation for all emotions.
5. `test_tier1_satisfaction_trend_improving`: Validates `improving` trend when customer frustration drops $\ge 2$ points or sentiment turns positive.
6. `test_tier1_satisfaction_trend_declining`: Validates `declining` trend when customer frustration increases $\ge 2$ points.
7. `test_tier1_satisfaction_trend_stable_baseline`: Validates `stable` trend on Turn 1 or minor frustration shifts.
8. `test_tier1_escalation_risk_low_medium_high`: Verifies low, medium, and high escalation risk rules.
9. `test_tier1_confidence_score_calculation`: Verifies confidence calculation within $[0.0, 1.0]$.
10. `test_tier1_customer_need_mapping_all_intents`: Verifies deterministic mapping from all 8 intents to `CustomerNeed` enums.
11. `test_tier1_decision_support_priority_levels`: Verifies priority determination (critical, high, medium, low).
12. `test_tier1_decision_support_tone_selection`: Verifies recommended tone selection (apologetic, calm, empathetic, reassuring, clarifying, professional).
13. `test_tier1_decision_support_action_selection`: Verifies recommended action mapping (escalate, apologize_and_resolve, provide_status, etc.).
14. `test_tier1_api_analyze_endpoint`: Validates `POST /analysis/analyze` request/response contract.
15. `test_tier1_api_history_endpoint`: Validates `GET /analysis/{session_id}/history` returns chronological turn list.
16. `test_tier1_api_summary_endpoint`: Validates `GET /analysis/{session_id}/summary` aggregates dominant intent and current metrics.

### Tier 2: Boundary & Corner Cases (Limits, Validation & Data Cleansing) [14 Tests]
17. `test_tier2_frustration_boundary_zero`: Verifies frustration level clamps cleanly at lower bound `0` for happy customer.
18. `test_tier2_frustration_boundary_one`: Verifies frustration level clamps at `1` for satisfied/resolved customer with gratitude keywords.
19. `test_tier2_frustration_boundary_four_five`: Verifies boundary transition between 4 (mild) and 5 (moderate, medium risk trigger).
20. `test_tier2_frustration_boundary_seven_eight`: Verifies boundary transition between 7 and 8 (severe, high risk trigger).
21. `test_tier2_frustration_boundary_nine_ten`: Verifies boundary 9 (escalation action) and ceiling saturation at 10 with max exclamations/caps.
22. `test_tier2_confidence_weak_tokens_degradation`: Verifies confidence lowers on short/weak tokens ("ok", "yes", "hi").
23. `test_tier2_confidence_strong_evidence_boost`: Verifies confidence boost on explicit domain keywords.
24. `test_tier2_empty_and_whitespace_message_validation`: Verifies `POST /analysis/analyze` rejects empty or whitespace strings with 422.
25. `test_tier2_very_long_message_handling`: Verifies 5,000+ character customer message parses without error or buffer overflow.
26. `test_tier2_unicode_and_emojis_support`: Verifies emojis (😡, 🔥, 🎉, 💸) and accented Unicode characters parse safely.
27. `test_tier2_single_turn_session_summary`: Verifies summary calculations on a single-turn session (turn_count=1, stable trend).
28. `test_tier2_dominant_intent_tie_breaking`: Verifies tie-breaking logic in summary when two intents have equal frequency (prefers latest turn).
29. `test_tier2_api_nonexistent_session_returns_404`: Verifies all endpoints return 404 on invalid session ID.
30. `test_tier2_zero_turn_session_history_and_summary`: Verifies history returns empty list and summary returns zeroed baseline when no turns exist.

### Tier 3: Cross-Feature & Combinations (Interactions & Resilience) [12 Tests]
31. `test_tier3_session_isolation_concurrent_sessions`: Verifies Session A (angry refund) and Session B (polite inquiry) execute interleaved with zero state bleed.
32. `test_tier3_contextual_back_referencing`: Verifies ambiguous customer references ("cancel it", "that money") resolve accurately using scenario and prior turns.
33. `test_tier3_satisfaction_inversion_negative_to_positive`: Verifies multi-turn sequence transitioning from negative (turn 1) to positive (turn 2) produces `improving` trend.
34. `test_tier3_satisfaction_inversion_positive_to_negative`: Verifies multi-turn sequence transitioning from positive to negative produces `declining` trend.
35. `test_tier3_escalation_risk_progression`: Verifies risk escalates from `low` -> `medium` -> `high` across progressive customer messages.
36. `test_tier3_gemini_exception_triggers_fallback`: Simulates Gemini throwing network/timeout exception; verifies fallback returns complete valid contract with `analysis_source="fallback"`.
37. `test_tier3_gemini_malformed_json_fallback`: Simulates Gemini returning non-JSON text; verifies JSON parser gracefully falls back to deterministic engine.
38. `test_tier3_decision_support_repeated_negative_flags`: Verifies history with $\ge 2$ negative turns triggers `repeated_negative_sentiment` risk flag and elevated priority.
39. `test_tier3_decision_support_api_get_and_post_parity`: Verifies both `GET` and `POST` `/analysis/{session_id}/decision-support` return identical results.
40. `test_tier3_operational_metrics_counter_accuracy`: Verifies `total_analyses`, `gemini_analyses`, and `fallback_analyses` counters track operational events accurately.
41. `test_tier3_repeated_complaint_indicator_frustration_boost`: Verifies explicit phrasing ("already told you", "second time") boosts frustration score by $+2.0$.
42. `test_tier3_caps_and_exclamation_frustration_stacking`: Verifies ALL-CAPS words and multiple exclamations stack frustration score correctly up to upper bound.

### Tier 4: Real-World & E2E Workloads (Runtime Workflows & Persistence Audit) [10 Tests]
43. `test_tier4_e2e_three_turn_customer_simulator_dialogue`: Executes full 3-turn dialogue via `/simulator/start` and `/simulator/message`, verifying end-to-end analysis progression.
44. `test_tier4_e2e_five_turn_complex_resolution_dialogue`: Executes full 5-turn dialogue covering complaint, agent response, de-escalation, and final resolution.
45. `test_tier4_e2e_database_message_deduplication_audit`: Audits `messages` table ensuring exactly 1 System snapshot per customer turn and zero duplicate customer/agent messages.
46. `test_tier4_e2e_conversation_record_synchronization`: Verifies `conversations` table updates `intent`, `sentiment`, and `escalation_risk` synchronously on every turn.
47. `test_tier4_e2e_history_endpoint_filters_system_messages`: Confirms `/simulator/{session_id}/history` excludes System messages while `/analysis/{session_id}/history` includes them.
48. `test_tier4_e2e_failure_isolation_simulator_resilience`: Injects an unhandled exception into Task 4 analysis; verifies `/simulator/message` still returns 200 and continues Task 3 simulation.
49. `test_tier4_e2e_downstream_decision_support_consumption`: Simulates downstream Response Suggestion and Escalation Agent consuming `DecisionSupportResult` payload.
50. `test_tier4_e2e_openapi_json_schema_completeness`: Validates FastAPI `/openapi.json` accurately exposes all Task 4 routes, schemas, and enum values.
51. `test_tier4_e2e_real_gemini_status_reporting`: Formally tests and reports real Gemini environment availability status (`PASS`, `FAIL`, or `NOT RUN`).
52. `test_tier4_e2e_full_session_lifecycle_cleanup`: Verifies complete session lifecycle from start to resolution to database session closure and metrics verification.

---

## 5. Features Discovered Table

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|---|---|---|---|---|---|---|
| 1 | API Routing | `POST /analysis/analyze` | Standalone customer message analysis | `AnalysisRequest(session_id, customer_message)` | `AnalysisResponse` | 404 if session missing, 422 if empty message | `app/api/analysis.py` |
| 2 | API Routing | `GET /analysis/{session_id}/history` | Chronological turn-by-turn analysis history | `session_id: int` | `List[TurnAnalysis]` | 404 if session missing | `app/api/analysis.py` |
| 3 | API Routing | `GET /analysis/{session_id}/summary` | Aggregated session summary derived from history | `session_id: int` | `SessionAnalysisSummary` | 404 if session missing | `app/api/analysis.py` |
| 4 | API Routing | `POST /analysis/{session_id}/decision-support` | Generates downstream decision support | `session_id: int` | `DecisionSupportResult` | 404 if session missing | `app/api/analysis.py` |
| 5 | API Routing | `GET /analysis/{session_id}/decision-support` | Idempotent decision support retrieval | `session_id: int` | `DecisionSupportResult` | 404 if session missing | `app/api/analysis.py` |
| 6 | API Routing | `GET /analysis/metrics` | In-memory operational metrics & latency | None | JSON metrics object | None (always 200) | `app/api/analysis.py` |
| 7 | Simulator Hook | Live Analysis in `/simulator/start` | Automatically analyzes opening complaint on turn 1 | `SimulatorStartRequest` | Simulation response with embedded `analysis` dict | Gracefully bypassed on exception | `app/api/simulator.py` |
| 8 | Simulator Hook | Live Analysis in `/simulator/message` | Automatically analyzes customer response on turns 2-5 | `SimulatorMessageRequest` | Simulation response with embedded `analysis` dict | Gracefully bypassed on exception | `app/api/simulator.py` |
| 9 | History Filtering | System Message Exclusion | Simulator history filters out internal System rows | `session_id: int` | Only Customer & Agent messages | 404 if session missing | `app/api/simulator.py` |
| 10 | Context Resolution | Context Extraction | Retrieves last 6 dialogue messages for context | `session_id, db` | Dict with dialogue history & scenario category | None if session missing | `app/services/analysis_service.py` |
| 11 | Semantic Intent | Deterministic Intent Classifier | Classifies intent using weighted keywords & back-refs | text, history, scenario | `CustomerIntent` | Defaults to `GENERAL_INQUIRY` | `app/services/analysis_service.py` |
| 12 | Affective Emotion | Deterministic Emotion Classifier | Classifies emotion using intensity hierarchy | text | `CustomerEmotion` | Defaults to `NEUTRAL` | `app/services/analysis_service.py` |
| 13 | Polarity Sentiment | Deterministic Sentiment Classifier | Classifies sentiment from emotion & lexicon | text, emotion | `CustomerSentiment` | Defaults to `NEUTRAL` | `app/services/analysis_service.py` |
| 14 | Frustration Scoring | Bounded Frustration Engine | Calculates frustration on integer scale [0, 10] | message, emotion, sentiment, signals | `int` in [0, 10] | Clamped to bounds | `app/services/analysis_service.py` |
| 15 | Trend Progression | Directional Satisfaction Trend | Evaluates delta from previous customer turn | frustration, sentiment, history | `SatisfactionTrend` | Defaults to `STABLE` | `app/services/analysis_service.py` |
| 16 | Risk Assessment | Escalation Risk Evaluator | Multi-signal evaluation for supervisor escalation | frustration, emotion, sentiment, signals | `EscalationRisk` | Defaults to `LOW` | `app/services/analysis_service.py` |
| 17 | Confidence Engine | Confidence Score Estimator | Evaluates classification certainty | emotion, sentiment, intent, signals, text | `float` in [0.0, 1.0] | Clamped between [0.10, 0.98] | `app/services/analysis_service.py` |
| 18 | LLM Integration | Gemini Structured JSON Prompt | Formats prompt requesting raw JSON classification | message, history, scenario | LLM prompt string | None | `app/services/analysis_service.py` |
| 19 | JSON Robustness | LLM Output Sanitizer & Parser | Strips markdown fences, extracts JSON, handles commas | raw string from LLM | Parsed dict or None | Returns None on failure | `app/services/analysis_service.py` |
| 20 | State Persistence | System Message Storage | Stores state & analysis without DB schema change | conversation_id, JSON text | Database row in `messages` | Logged and skipped on DB error | `app/services/analysis_service.py` |
| 21 | Decision Priority | Deterministic Priority Engine | Computes action priority from frustration & risk | analysis, history | `DecisionPriority` | Defaults to `LOW` | `app/services/decision_support_service.py` |
| 22 | Tone Selection | Deterministic Tone Recommender | Recommends agent tone tailored to emotion | analysis | `RecommendedTone` | Defaults to `PROFESSIONAL` | `app/services/decision_support_service.py` |
| 23 | Action Selection | Deterministic Action Recommender | Recommends operational workflow action | analysis | `RecommendedAction` | Defaults to `PROVIDE_INSTRUCTIONS` | `app/services/decision_support_service.py` |
| 24 | Need Mapping | Customer Need Mapper | Maps intent to structured customer need | `CustomerIntent` | `List[CustomerNeed]` | Defaults to `INFORMATION_REQUEST` | `app/services/decision_support_service.py` |
| 25 | Risk Flags | Risk Flag Collector | Gathers deduplicated operational risk flags | analysis, history | `List[str]` | Empty list if no risks | `app/services/decision_support_service.py` |

---

## 6. Edge Cases Table

| # | Feature | Input / Condition | Observed Behavior |
|---|---|---|---|
| 1 | Frustration Scoring | Customer expressing delight: "Thank you so much, you are amazing!" | Frustration calculates to `0`; escalation risk is `low`; trend is `improving` or `stable`. |
| 2 | Frustration Scoring | Resolved issue: "That fixed it, thank you for handling this." | Gratitude clamp limits score to $\le 1$; RecommendedTone is `PROFESSIONAL`. |
| 3 | Frustration Scoring | Frustrated customer with ALL-CAPS: "I NEED THIS FIXED RIGHT NOW" | Caps words ($\ge 2$) add $+1.5$ boost; exclamations add boost; score reaches $8$–$10$. |
| 4 | Frustration Scoring | Customer demands supervisor: "Get me your manager immediately" | Escalation trigger detected; adds $+2.5$ boost; escalation risk forced to `high`. |
| 5 | Frustration Scoring | Customer repeating grievance: "I already told you this three times" | Repeated complaint detector triggers; adds $+2.0$ boost; risk elevated to `medium` or `high`. |
| 6 | Frustration Scoring | Extreme saturation: Angry + Caps + Exclamations + Supervisor threat | Raw score exceeds 14.0; strictly clamped to maximum integer `10`. |
| 7 | Satisfaction Trend | Single turn session (Turn 1 opening complaint) | No prior customer turn exists; satisfaction trend defaults to `stable`. |
| 8 | Satisfaction Trend | Turn 1 angry (frustration 9) -> Turn 2 resolved (frustration 1) | Frustration differential is $-8$ ($\le -2$); trend evaluates to `improving`. |
| 9 | Satisfaction Trend | Turn 1 calm (frustration 2) -> Turn 2 annoyed (frustration 5) | Frustration differential is $+3$ ($\ge +2$); trend evaluates to `declining`. |
| 10 | Satisfaction Trend | Turn 1 confused (frustration 4) -> Turn 2 confused (frustration 4) | Differential is $0$; trend evaluates to `stable`. |
| 11 | Confidence Scoring | Very short/elliptical tokens: "ok", "yes", "hi", "yep" | Weak evidence penalty applied ($-0.28$); confidence degrades to $\sim 0.50$–$0.60$. |
| 12 | Confidence Scoring | Ambiguous phrase: "something is wrong with the service" | Ambiguous penalty applied ($-0.10$); confidence moderately lowered. |
| 13 | Confidence Scoring | Explicit keywords: "I want a refund for this double charge" | Strong keyword boost applied ($+0.04$); confidence reaches high level ($\ge 0.88$). |
| 14 | API Validation | Empty string `""` or whitespace `"   "` in `customer_message` | Pydantic field validator raises ValueError; FastAPI returns `422 Unprocessable Entity`. |
| 15 | API Validation | Negative or zero `session_id` (`0` or `-5`) | Pydantic validation constraint `gt=0` fails; FastAPI returns `422 Unprocessable Entity`. |
| 16 | API Error Handling | Valid positive `session_id` that does not exist in DB (`999999`) | Database query returns None; endpoint raises HTTPException `404 Not Found`. |
| 17 | Session Summary | Tie in intent frequency (e.g. Turn 1 refund, Turn 2 cancellation) | Tie-breaking rule prioritizes the latest turn's intent (`cancellation`). |
| 18 | Session Summary | Session with zero analyzed turns in history | Returns default baseline: general inquiry, neutral, frustration 0, stable, turn_count 0. |
| 19 | LLM Resilience | Gemini API throws 503 / 429 / socket timeout | Exception caught; metrics increment `fallback_analyses`; deterministic fallback runs. |
| 20 | LLM Resilience | Gemini returns markdown fences ````json {"intent": "refund"} ```` | Sanitizer strips code fences and extracts clean JSON object successfully. |
| 21 | LLM Resilience | Gemini returns invalid enum (e.g., `intent: "free_stuff"`) | Validation catches invalid enum; falls back to deterministic keyword classifier. |
| 22 | Decision Support | Session with high escalation risk and frustration $\ge 8$ | Priority set to `critical`; action is `escalate`; `escalation_recommended=True`. |
| 23 | Decision Support | Severe frustration ($\ge 8$) with `complaint` intent | Recommended tone is `apologetic`; action is `apologize_and_resolve`. |
| 24 | Concurrency | Session A (refund) and Session B (account issue) run concurrently | Database queries filter strictly by `session_id`; zero cross-contamination. |
| 25 | Deduplication | Re-invoking `GET /analysis/{session_id}/history` multiple times | Operation is idempotent; returns identical records; zero new rows created in DB. |

---

## 7. Critical Implementation & Test Execution Notes (Spec Miner Findings)

### 7.1 Database Dependency Override Requirement in Tests
During comprehensive test probing across the 271+ existing tests, an architectural nuance was identified:
- Both `app/api/simulator.py` and `app/api/analysis.py` define their own independent `get_db()` generator functions.
- When constructing FastAPI test fixtures with `app.dependency_overrides`, tests that invoke BOTH simulator endpoints (`/simulator/*`) and analysis endpoints (`/analysis/*`) **MUST override both functions**:
  ```python
  from app.api.simulator import get_db as sim_get_db
  from app.api.analysis import get_db as analysis_get_db

  app.dependency_overrides[sim_get_db] = override_get_db
  app.dependency_overrides[analysis_get_db] = override_get_db
  ```
- If only `sim_get_db` is overridden, requests to `/analysis/*` will fallback to the default production/development database (`app.db`), failing to locate sessions created inside the test's isolated SQLite database. This was confirmed as the root cause of isolated test failures in Phase 4 during multi-suite runs.
- `tests/test_task4_final.py` must strictly implement dual overrides in its `pytest` database fixture.

### 7.2 In-Memory Operational Metrics Isolation
- The analysis service maintains global in-memory metrics in `ANALYSIS_METRICS` (`app/services/analysis_service.py`).
- To prevent cross-test metric pollution, tests verifying metrics counters (`test_tier3_operational_metrics_counter_accuracy`, etc.) should use an `autouse=True` fixture calling `reset_analysis_metrics()`.

### 7.3 Real Gemini API Status Reporting Protocol
- In environments without active paid Google Gemini credentials (where `GEMINI_API_KEY=test_gemini_api_key`), `test_tier4_e2e_real_gemini_status_reporting` must explicitly log and report:
  `STATUS: NOT RUN — credentials/network/model unavailable (simulated test environment active)`.
- Fallback tests must verify that `analysis_source == "fallback"` and all schema fields remain 100% valid under this condition.

