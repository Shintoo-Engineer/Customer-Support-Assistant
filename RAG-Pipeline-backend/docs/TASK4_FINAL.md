# TASK 4 — FINAL TECHNICAL SPECIFICATION & SYSTEM DOCUMENTATION

## Intent & Sentiment Analysis Agent (Phases 1–8 Complete)

---

## 1. Task 4 Objective
The **Intent & Sentiment Analysis Agent** (Task 4) is a production-grade analytical and decision-support component for the Customer Support Assistant backend (`RAG-Pipeline-backend`). It operates directly on customer messages—both in standalone mode and continuously integrated with the Task 3 Customer Simulator—to derive semantic intent, emotional state, sentiment polarity, quantitative frustration level (0–10), directional satisfaction progression, and supervisor escalation risk. In addition, it maintains chronological turn-level analytical history, aggregates session-level summaries, and outputs deterministic, explainable downstream recommendations (`DecisionSupportResult`) for future downstream agents.

---

## 2. Architecture
The architecture comprises a hybrid intelligence engine backed by robust fallback mechanisms, historical tracking, and deterministic decision support:

```text
                    ┌─────────────────────────┐
                    │   Task 3 Customer       │
                    │   Simulator Agent       │
                    └───────────┬─────────────┘
                                │ (Customer Turn)
                                ▼
                    ┌─────────────────────────┐
                    │  POST /analysis/analyze │
                    └───────────┬─────────────┘
                                │
                                ▼
           ┌──────────────────────────────────────────┐
           │   Task 4 Analytical Engine (Hybrid)       │
           │  - LLM Semantic Analysis (Gemini 2.5)    │
           │  - Deterministic Keyword/Regex Fallback  │
           │  - Quantitative Frustration Engine (0-10) │
           │  - Satisfaction Trend Calculator         │
           │  - Escalation Risk Assessor              │
           └────────────────────┬─────────────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │     AnalysisResult      │
                    │ (Canonical Internal)    │
                    └───────────┬─────────────┘
                                │
            ┌───────────────────┴───────────────────┐
            ▼                                       ▼
┌────────────────────────┐              ┌────────────────────────┐
│  Turn Analysis History │              │ Session Analysis       │
│  & SQLite Persistence  │              │ Summary                │
└───────────┬────────────┘              └───────────┬────────────┘
            │                                       │
            └───────────────────┬───────────────────┘
                                │
                                ▼
           ┌──────────────────────────────────────────┐
           │ Phase 6 Downstream Decision Support      │
           │  - Priority: critical/high/medium/low    │
           │  - Recommended Tone & Action             │
           │  - Customer Needs & Risk Flags           │
           │  - Deterministic Explainable Rationale   │
           └────────────────────┬─────────────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │  DecisionSupportResult  │
                    └───────────┬─────────────┘
                                │
                     (Downstream Contract)
                                │
                 ┌──────────────┼──────────────┐
                 ▼              ▼              ▼
           Coaching Agent    RAG Agent    Escalation Agent
              (Future)        (Future)        (Future)
```

---

## 3. Task 3 → Task 4 Integration
- **Zero Breaking Changes**: Task 3 Customer Simulator files (`app/api/simulator.py`, `app/services/simulator_service.py`, `app/services/persona_service.py`, `app/services/scenario_service.py`, `app/services/simulator_state.py`, `app/models/simulator.py`) remain completely untouched.
- **Synchronous Context Hand-off**: Whenever `/simulator/start` or `/simulator/message` generates a customer turn, the message is automatically dispatched to the Task 4 analysis engine.
- **Failure Isolation**: An analytical failure, Gemini rate limit, or persistence failure in Task 4 NEVER interrupts or terminates the Task 3 customer simulator session.

---

## 4. Canonical Analysis Contract
Defined in `app/schemas/analysis.py`:

| Signal Field | Type / Enum | Allowed Values / Bounds | Description |
| :--- | :--- | :--- | :--- |
| `intent` | `CustomerIntent` | `refund`, `cancellation`, `delivery_issue`, `payment_issue`, `account_issue`, `complaint`, `return_exchange`, `general_inquiry` | Primary semantic customer goal |
| `emotion` | `CustomerEmotion` | `happy`, `neutral`, `confused`, `worried`, `frustrated`, `angry`, `satisfied` | Assessed emotional state |
| `sentiment` | `CustomerSentiment` | `positive`, `neutral`, `negative` | Overall sentiment polarity |
| `frustration_level` | `int` | `[0, 10]` | Strictly bounded quantitative frustration score |
| `satisfaction_trend` | `SatisfactionTrend` | `improving`, `declining`, `stable` | Directional customer satisfaction trend across dialogue |
| `escalation_risk` | `EscalationRisk` | `low`, `medium`, `high` | Risk of supervisor escalation or dispute |
| `confidence` | `float` | `[0.0, 1.0]` | Normalized confidence score |

---

## 5. Historical Analysis & Traceability
- **Turn Analysis Snapshot**: Each analyzed customer turn is captured as a `TurnAnalysis` object containing the turn number, classified dimensions, timestamp, and analysis source (`gemini` or `fallback`).
- **History Retrieval**: `GET /analysis/{session_id}/history` returns the ordered chronological sequence of analyzed turns for any session.
- **Traceability**: Analysis records link back to `session_id`, `conversation_id`, and `message_id`.

---

## 6. Session Analysis Summary
Derived via `GET /analysis/{session_id}/summary` or internal service call `get_session_analysis_summary(session_id, db)`:
- `dominant_intent`: Mode intent across all analyzed turns.
- `latest_emotion` & `latest_sentiment`: Current customer emotional state.
- `current_frustration`: Latest turn frustration score (0–10).
- `current_escalation_risk`: Latest turn escalation risk level.
- `overall_satisfaction_direction`: Net satisfaction trajectory across conversation.
- `average_confidence`: Mean classification confidence.
- `turn_count`: Total analyzed customer turns.

---

## 7. Downstream Decision Support Layer
Implemented in `app/services/decision_support_service.py`:
- **Enums**: `DecisionPriority` (`low`, `medium`, `high`, `critical`), `RecommendedTone` (`empathetic`, `reassuring`, `clarifying`, `apologetic`, `professional`, `calm`, `firm`), `RecommendedAction` (`resolve`, `clarify`, `apologize_and_resolve`, `provide_status`, `provide_instructions`, `offer_options`, `escalate`), and `CustomerNeed`.
- **Purely Deterministic**: Zero LLM calls, zero secondary classifiers, sub-millisecond execution.
- **Endpoints**: `POST /analysis/{session_id}/decision-support` and `GET /analysis/{session_id}/decision-support`.

---

## 8. API Endpoints
All endpoints are registered under `/analysis`:
1. `POST /analysis/analyze`: Standalone message analysis.
2. `GET /analysis/{session_id}/history`: Chronological turn-level analyses.
3. `GET /analysis/{session_id}/summary`: Aggregated session analytics.
4. `POST /analysis/{session_id}/decision-support`: Agent-ready recommendation generation.
5. `GET /analysis/{session_id}/decision-support`: Idempotent decision support retrieval.
6. `GET /analysis/metrics`: Operational monitoring metrics (latency, fallbacks, call counts).

---

## 9. Database Persistence & Integrity
- Reuses existing SQLite schema: `sessions`, `conversations`, `messages`.
- **No Database Migrations Required**: Zero schema alterations.
- Analysis snapshots are persisted as structured system records associated with the session conversation, ensuring transactional integrity and query isolation.

---

## 10. Gemini + Fallback Architecture
- **Primary Engine**: Gemini 2.5 Flash via `google-genai` SDK with strict JSON response parsing.
- **Deterministic Keyword/Regex Fallback Engine**: Comprehensive linguistic dictionaries (`INTENT_KEYWORDS`, `EMOTION_KEYWORDS`, `SENTIMENT_KEYWORDS`) ensure 100% contract compliance if Gemini fails, times out, or quota is exhausted.
- **Clamping Safeguards**: Frustration scores are strictly clamped between 0 and 10; confidence is clamped between 0.0 and 1.0.

---

## 11. Error Handling & Failure Isolation
- Input validation prevents empty or whitespace-only messages (`422 Unprocessable Entity`).
- Non-existent session IDs return clean `404 Not Found`.
- Malformed LLM responses gracefully degrade to deterministic fallback without throwing unhandled exceptions.

---

## 12. Observability
- In-memory operational metrics tracked in `ANALYSIS_METRICS`:
  - `total_analyses`, `gemini_analyses`, `fallback_analyses`
  - `validation_failures`, `analysis_failures`, `persistence_failures`
  - `total_latency_ms`, `average_latency_ms`
- Accessible via `GET /analysis/metrics`.

---

## 13. Security & Data Safety
- Zero leakage of API credentials or auth tokens in logs.
- Safe handling of Unicode, SQL injection patterns, HTML tags, and emoji in customer input text.
- Clean separation of internal metadata from public API response schemas.

---

## 14. Testing & Verification
Full test suite contains **323 automated tests** with 100% pass rate:
- `tests/test_simulator.py`: 16/16
- `tests/test_analysis_phase1.py`: 15/15
- `tests/test_analysis_phase2.py`: 70/70
- `tests/test_task3_task4_integration.py`: 32/32
- `tests/test_analysis_phase4.py`: 50/50
- `tests/test_analysis_phase5.py`: 35/35
- `tests/test_analysis_phase6.py`: 53/53
- `tests/test_task4_final.py`: 52/52

---

## 15. Real Gemini Status
- Status: **NOT RUN — credentials/network/model unavailable** in the automated test sandbox.
- Verified via mock injection and deterministic fallback testing.

---

## 16. Known Limitations
- LLM response latency depends on external Google GenAI network availability (mitigated by deterministic fallback < 5 ms).
- Metrics counters are in-memory per process instance.

---

## 17. Future Integration Boundary
> **Architectural Boundary Statement:**  
> Task 4 provides analysis, historical analytics, session summaries, and decision-support recommendations for downstream consumption. It explicitly does **NOT** implement the future Coaching Agent, Response Suggestion Agent, RAG Agent, or Escalation Agent.
