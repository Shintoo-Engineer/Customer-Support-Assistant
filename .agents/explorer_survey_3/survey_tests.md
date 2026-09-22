# Comprehensive Test Survey & Test Plan: Task 6 Phase 1 (Coaching & Response Suggestion Agent)

**Document Version:** 1.0.0  
**Author:** explorer_survey_3  
**Date:** 2026-09-21  
**Target Repository:** `Customer-Support-Assistant/final_project/RAG-Pipeline-backend` & `final_project/frontend`  
**Working Directory:** `C:\Users\shrushti\Customer-Support-Assistant\.agents\explorer_survey_3`

---

## 1. Executive Summary

This report establishes the complete testing landscape for **Task 6 Phase 1 (Coaching & Response Suggestion Agent)** within the Customer Support Assistant project. 

Key Findings:
1. **Active Project Location**: Following commit `fac51c2`, the active Python backend and TypeScript frontend are located in `final_project/RAG-Pipeline-backend` and `final_project/frontend`.
2. **Current Test Baseline**: A total of **14 active pytest test suites** comprising **485 automated tests** currently exist across Tasks 3, 4, 5, and E2E pipelines. All existing suites run against Python 3.14.6 and pytest 9.1.1.
3. **Decision Support Heritage**: `DecisionSupportResult` was introduced in Task 4 Phase 6 (`app/services/decision_support_service.py` and `app/schemas/analysis.py`), tested by 53 tests in `test_analysis_phase6.py` and 52 tests in `test_task4_final.py`.
4. **Non-Destructive Schema Extension**: Extending `DecisionSupportResult` with `suggested_response: str | None = None`, `coaching_tips: list[str] = Field(default_factory=list)`, and `response_evaluation: ResponseEvaluation | None = None` provides 100% backward compatibility with all 485 existing tests.
5. **8 Mandatory Test Scenarios**: Complete specification and test design are provided for all 8 required scenarios: Refund/Frustrated, Payment/Angry, Delivery/Confused, Account/Login, Positive, With Task 5 Knowledge, Without Task 5 Knowledge (strict anti-hallucination guardrail), and Multi-Turn Dialogue Context.
6. **Strict Scope Boundary**: Task 6 Phase 1 strictly avoids implementing or testing the Phase 2 Escalation Risk Monitoring Agent, alert services, or supervisor paging infrastructure.

---

## 2. Test Environment & Execution Profile

### 2.1 Runtime Environment
- **Operating System**: Windows 11 (AMD64)
- **Python Version**: Python 3.14.6 (Miniconda3 distribution: `C:\Users\shrushti\miniconda3\python.exe`)
- **Pytest Version**: pytest 9.1.1 (Plugins: `anyio-4.12.1`)
- **Node / Package Manager**: Node.js, npm, Vite 8.3.0, TypeScript 6.0.2

### 2.2 Cold Start & Execution Characteristics
- In the local Windows environment, initial module imports involving `google.genai`, `chromadb`, and `sentence_transformers` take ~30–45 seconds during pytest collection.
- Once collected, in-memory unit tests execute at ~10–50ms per test.
- Vector database tests querying the real persistent ChromaDB take ~200–500ms per search turn.

---

## 3. Inventory of Existing Test Suites

The backend test suite in `final_project/RAG-Pipeline-backend/tests` consists of 20 files. 5 are legacy manual execution scripts (`test_embedding_service.py`, `test_ingestion_service.py`, `test_pdf_extraction.py`, `test_text_service.py`, `test_vector_service.py`), and 14 are automated pytest test suites containing **485 tests**.

### 3.1 Automated Test Suite Matrix

| Module / Milestone | Test File | Test Count | Key Features / Dimensions Validated |
|:---|:---|:---:|:---|
| **Task 3: Simulator** | `tests/test_simulator.py` | 16 | Customer emotional state engine (`frustration`, `trust`, `patience`, `satisfaction`, `escalation_intent`), empathy/dismissive delta formulas, persona multipliers (calm, confused, frustrated, angry, impatient, polite), scenario briefs, `generate_customer_turn` fallback, isolated SQLite DB fixtures, FastAPI TestClient. |
| **Task 4 Phase 1** | `tests/test_analysis_phase1.py` | 15 | `AnalysisRequest`/`AnalysisResponse` schema validation, numeric boundaries, DB conversation context retrieval, baseline `analyze_customer_message`, API endpoint `/analysis/analyze`. |
| **Task 4 Phase 2** | `tests/test_analysis_phase2.py` | 70 | 8 intents, 7 emotions, 3 sentiments, frustration scale (0–10), contextual pronominal intent resolution, repeated complaints, satisfaction trends, escalation risk, confidence calibration, 26 dataset scenarios. |
| **Task 3 ↔ 4 Integration** | `tests/test_task3_task4_integration.py` | 32 | Multi-turn dialogue loop (Customer → T4 Analysis → State Persisted → Agent Reply → Next Customer Turn), session association, all 6 personas, all 5 scenarios, fault isolation (LLM failure does not crash simulator). |
| **Task 4 Phase 4** | `tests/test_analysis_phase4.py` | 50 | LLM JSON normalization, malformed JSON fallback, missing fields, enum fallback, confidence clamping, all 8 intents & 7 emotions realistic examples, multi-turn progression, session isolation, API edge cases. |
| **Task 4 Phase 5** | `tests/test_analysis_phase5.py` | 35 | `AnalysisResult` canonical model, analysis history retrieval, chronological ordering, dominant intent resolution, tie-breaking, operational metrics tracking, downstream consumer simulation (`coaching_agent`, `escalation_monitor`, `rag_prompt_selector`). |
| **Task 4 Phase 6** | `tests/test_analysis_phase6.py` | 53 | Deterministic Decision Support Layer: `DecisionPriority`, `RecommendedTone`, `RecommendedAction`, `CustomerNeed`, `DecisionSupportResult` schema validation, defaults, confidence bounds, mapping rules for all 8 intents, priority determination, risk flags collection, determinism, `/analysis/{session_id}/decision-support` API, downstream consumer simulation. |
| **Task 4 Final Validation** | `tests/test_task4_final.py` | 52 | Combined Phase 7 & 8 validation: 5 core sections covering Multi-Turn Dialogue Loop, Comprehensive Analytical Coverage, Gemini vs Fallback Resilience, Session Isolation & Concurrency Safety, API Endpoints & SQLite Integrity. |
| **Task 5 Phase 1** | `tests/test_knowledge_recommendation_phase1.py` | 47 | `KnowledgeRecommendation`/`KnowledgeRecommendationResult` schemas, vector DB retrieval, similarity ranking, top-k limiting, safe empty responses without hallucinated sources, API endpoint `/knowledge/recommend`. |
| **Task 5 Phase 2** | `tests/test_knowledge_recommendation_phase2.py` | 30 | Context-aware retrieval, pronominal reference resolution ("How long does that take?"), system message exclusion, history bounding, intent keyword expansion, intent boosting, document deduplication, source attribution. |
| **Task 5 Phase 3** | `tests/test_knowledge_recommendation_phase3.py` | 38 | Three-way integration (Task 3 Simulator ↔ Task 4 Analysis ↔ Task 5 Knowledge), support turn loop, multi-turn context retention, emotional progression, fault isolation (T4/T5 crash does not crash conversation), session isolation, backward compatibility. |
| **Task 5 Phase 4** | `tests/test_knowledge_recommendation_phase4.py` | 28 | Evaluation dataset structure, retrieval metrics: Precision@K, Recall@K, MRR, NDCG, safe no-result metric, false-positive metric, duplicate detection, source validation, evaluation reporting. |
| **Task 5 Core** | `tests/test_task5_core.py` | 8 | 5 core capabilities: TC1 Basic Retrieval, TC2 Context-Aware Multi-Turn, TC3 Out-of-Domain Safe Rejection, TC4 Intent-Guided Ranking, TC5 Source Attribution & Deduplication, No Fabricated Sources. |
| **Backend E2E** | `tests/test_backend_e2e.py` | 11 | Complete pipeline integration: TC1 Simulator Session, TC2 Analysis, TC3 Knowledge Recommendation, TC4 Full Pipeline Integration, TC5 API Health. |
| **TOTAL EXISTING** | **14 test files** | **485** | **100% automated test coverage across Tasks 3, 4, 5** |

### 3.2 Mocking, Fixture & Dependency Patterns

1. **Optional Module Mocking**:
   ```python
   for mod in ["google", "google.genai", "pypdf", "sentence_transformers", "chromadb"]:
       if mod not in sys.modules:
           try:
               __import__(mod)
           except ImportError:
               sys.modules[mod] = MagicMock()
   ```
2. **Isolated SQLite Database Fixture**:
   Each test file instantiates its own isolated SQLite database file (e.g. `test_task4_final.db`, `test_simulator.db`), creates tables via `Base.metadata.create_all(bind=test_engine)`, overrides the FastAPI dependency:
   ```python
   app.dependency_overrides[get_db] = override_get_db
   ```
   and cleans up the SQLite file in fixture teardown.
3. **FastAPI TestClient**:
   All HTTP endpoint tests use `starlette.testclient.TestClient(app)`.
4. **Deterministic Fallback vs LLM Mocking**:
   Gemini LLM calls are mocked using `monkeypatch.setattr("app.services.analysis_service.generate_with_gemini", lambda prompt: None)` or by passing invalid responses to verify that the deterministic rule engines safely produce complete, valid results without network dependencies.
5. **Live ChromaDB & Embeddings in Task 5**:
   `test_task5_core.py` and `test_knowledge_recommendation_*.py` test real semantic similarity against the SQLite document store and ChromaDB vector store.

---

## 4. Existing Tests Checking `DecisionSupportResult`

`DecisionSupportResult` is extensively verified in `test_analysis_phase6.py` and `test_task4_final.py`:

### In `tests/test_analysis_phase6.py`:
- `test_decision_support_result_validation` (lines 151–176): Verifies instantiation, enum types, fields (`priority`, `recommended_tone`, `recommended_action`, `escalation_recommended`, `risk_flags`, `customer_needs`, `rationale`, `confidence`, `session_id`, `turn_number`), and `model_dump()`.
- `test_decision_support_result_defaults` (lines 178–192): Verifies default factories for `risk_flags=[]`, `customer_needs=[]`, `session_id=None`, `turn_number=None`.
- `test_decision_support_result_confidence_bounds` (lines 194–205): Verifies strict bounding `0.0 <= confidence <= 1.0`.
- `test_generate_decision_support_complete` (lines 712–735): Verifies complete generation from `AnalysisResult` signals.
- `test_generate_decision_support_determinism` (lines 737–755): Ensures deterministic stability across multiple invocations.
- `test_generate_decision_support_polymorphism` (lines 757–780): Accepts `AnalysisResult`, `AnalysisResponse`, or raw dictionaries.
- `test_api_decision_support_post` / `get` (lines 782–835): Validates `/analysis/{session_id}/decision-support` HTTP contracts.
- `test_downstream_response_suggestion_agent_simulation` (lines 910–940): Simulates a downstream consumer generating response suggestions from `DecisionSupportResult`.
- `test_downstream_escalation_agent_simulation` (lines 942–965): Simulates an escalation monitor consuming `DecisionSupportResult`.

### In `tests/test_task4_final.py`:
- `test_e2e_decision_support_updates_each_turn` (lines 201–235): Verifies dynamic update of decision support across multi-turn customer progression.
- `test_analytical_decision_support_all_needs_and_tones` (lines 620–660): Validates mapping coverage across all tones and needs.
- `test_resilience_fallback_produces_valid_decision_support` (lines 1050–1068): Validates valid decision support even under LLM failure.
- `test_session_isolation_decision_supports_strictly_isolated` (lines 1250–1280): Verifies session A and session B decision supports never cross-contaminate.
- `test_api_post_decision_support_endpoint_contract` / `get` (lines 1460–1500): Validates OpenAPI schema compliance.

---

## 5. Backward-Compatible Schema Extension Analysis

### Current Schema (`app/schemas/analysis.py`):
```python
class DecisionSupportResult(BaseModel):
    priority: DecisionPriority
    recommended_tone: RecommendedTone
    recommended_action: RecommendedAction
    escalation_recommended: bool
    risk_flags: list[str] = Field(default_factory=list)
    customer_needs: list[CustomerNeed] = Field(default_factory=list)
    rationale: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    session_id: int | None = Field(default=None)
    turn_number: int | None = Field(default=None)
```

### Proposed Extended Schema for Task 6 Phase 1:
```python
class ResponseEvaluation(BaseModel):
    clarity: float = Field(..., ge=0.0, le=1.0, description="Clarity and readability score (0.0 to 1.0)")
    empathy: float = Field(..., ge=0.0, le=1.0, description="Empathy and emotional alignment score (0.0 to 1.0)")
    relevance: float = Field(..., ge=0.0, le=1.0, description="Relevance to customer issue and context (0.0 to 1.0)")
    professionalism: float = Field(..., ge=0.0, le=1.0, description="Professionalism and adherence to guidelines (0.0 to 1.0)")
    overall_score: float | None = Field(default=None, ge=0.0, le=1.0, description="Composite evaluation score")
    rationale: str | None = Field(default=None, description="Brief explanation of evaluation dimensions")

class DecisionSupportResult(BaseModel):
    # Existing fields (Protected baseline)
    priority: DecisionPriority
    recommended_tone: RecommendedTone
    recommended_action: RecommendedAction
    escalation_recommended: bool
    risk_flags: list[str] = Field(default_factory=list)
    customer_needs: list[CustomerNeed] = Field(default_factory=list)
    rationale: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    session_id: int | None = Field(default=None)
    turn_number: int | None = Field(default=None)

    # Extended Task 6 Phase 1 fields:
    suggested_response: str | None = Field(
        default=None,
        description="Context-aware AI response suggestion for the support agent."
    )
    coaching_tips: list[str] = Field(
        default_factory=list,
        description="Actionable coaching tips and guidance for the support agent."
    )
    response_evaluation: ResponseEvaluation | None = Field(
        default=None,
        description="Evaluation metrics assessing suggested response quality."
    )
```

### Zero-Regression Guarantee:
Because all new fields provide safe default values (`default=None` and `default_factory=list`), all existing 485 tests that instantiate `DecisionSupportResult` without the new fields will continue to pass without modification.

---

## 6. Test Plan: The 8 Required Test Scenarios

The test suite for Task 6 Phase 1 must be implemented in a dedicated test file: `tests/test_coaching_phase1.py`.

### Scenario 1: Refund / Frustrated
- **Objective**: Verify that a frustrated customer demanding a refund receives an empathetic response suggestion, actionable de-escalation tips, and high empathy evaluation.
- **Input / State**:
  - Customer Message: `"I've been waiting 10 business days for my $89.99 refund! Your support is completely unresponsive and I want my money back NOW!"`
  - Task 4 Analysis: Intent=`refund`, Emotion=`frustrated`, Frustration=8/10, EscalationRisk=`medium` (or `high`), Sentiment=`negative`.
  - Task 5 Knowledge: Return/Refund policy chunks if present, or general policy.
- **Expected Decision Support Output**:
  - `priority`: `HIGH` or `CRITICAL`
  - `recommended_tone`: `EMPATHETIC` or `CALM`
  - `recommended_action`: `RESOLVE`
  - `suggested_response`: Acknowledges delay, offers immediate refund tracking/initiation, maintains empathetic posture (e.g., `"I sincerely apologize for the delay in processing your $89.99 refund. Let me inspect your transaction records right now and ensure this is resolved for you immediately."`).
  - `coaching_tips`: Contains actionable tips:
    1. Acknowledge frustration immediately before asking for details.
    2. Avoid defending standard processing delays.
    3. State immediate resolution action.
  - `response_evaluation`:
    - `clarity` >= 0.80
    - `empathy` >= 0.85
    - `relevance` >= 0.85
    - `professionalism` >= 0.85
- **Assertions**:
  - `assert ds.suggested_response is not None and len(ds.suggested_response) > 20`
  - `assert any(w in ds.suggested_response.lower() for w in ["refund", "apologize", "sorry"])`
  - `assert len(ds.coaching_tips) >= 2`
  - `assert ds.response_evaluation.empathy >= 0.80`

### Scenario 2: Payment / Angry
- **Objective**: Verify that an angry customer facing payment failure/double charge receives a calm, non-defensive response suggestion with clear steps and financial reassurance.
- **Input / State**:
  - Customer Message: `"Your website double-charged my Visa card and the order still failed! You stole $150 from me, fix this right now or I'm filing a fraud dispute!"`
  - Task 4 Analysis: Intent=`payment_issue`, Emotion=`angry`, Frustration=9/10, EscalationRisk=`high`, Sentiment=`negative`.
  - Task 5 Knowledge: Payment policy chunks regarding pending authorization holds.
- **Expected Decision Support Output**:
  - `priority`: `CRITICAL`
  - `recommended_tone`: `CALM` or `EMPATHETIC`
  - `recommended_action`: `ESCALATE` or `PROVIDE_INSTRUCTIONS`
  - `escalation_recommended`: `True`
  - `suggested_response`: Calming, addresses the charge immediately, clarifies authorization hold vs settled charge, offers immediate verification without defensive tone.
  - `coaching_tips`:
    1. Maintain calm, non-defensive composure; do not match customer hostility.
    2. Reassure the customer regarding duplicate authorization holds.
    3. Provide clear timeframe for pending charge release.
  - `response_evaluation`:
    - `clarity` >= 0.80
    - `empathy` >= 0.80
    - `relevance` >= 0.85
    - `professionalism` >= 0.85
- **Assertions**:
  - `assert ds.escalation_recommended is True or ds.priority == DecisionPriority.CRITICAL`
  - `assert any(w in ds.suggested_response.lower() for w in ["charge", "card", "transaction", "hold", "account"])`
  - `assert any("defensive" in tip.lower() or "calm" in tip.lower() for tip in ds.coaching_tips)`

### Scenario 3: Delivery / Confused
- **Objective**: Verify that a confused customer with a delivery tracking exception receives a clarifying, jargon-free explanation with concrete tracking verification steps.
- **Input / State**:
  - Customer Message: `"My tracking number says 'Status: Exception - In Transit to Delivery Hub 04', but the map shows nothing. What does this mean? Is my package lost?"`
  - Task 4 Analysis: Intent=`delivery_issue`, Emotion=`confused`, Frustration=4/10, EscalationRisk=`low`, Sentiment=`neutral`.
  - Task 5 Knowledge: Delivery policy chunks regarding courier transit and exception meanings.
- **Expected Decision Support Output**:
  - `priority`: `LOW` or `MEDIUM`
  - `recommended_tone`: `CLARIFYING`
  - `recommended_action`: `PROVIDE_STATUS`
  - `suggested_response`: Clarifies tracking status without courier jargon, explains that exceptions often indicate transit hub sorting, offers to check direct courier tracking.
  - `coaching_tips`:
    1. Translate technical courier exception codes into plain language.
    2. Confirm customer shipping address politely.
    3. Provide expected arrival window.
  - `response_evaluation`:
    - `clarity` >= 0.90 (exceptionally high clarity)
    - `empathy` >= 0.70
    - `relevance` >= 0.85
    - `professionalism` >= 0.85
- **Assertions**:
  - `assert ds.recommended_tone == RecommendedTone.CLARIFYING`
  - `assert ds.response_evaluation.clarity >= 0.85`
  - `assert any(w in ds.suggested_response.lower() for w in ["tracking", "package", "delivery", "status"])`

### Scenario 4: Account / Login
- **Objective**: Verify that a user locked out of their account with urgent deadlines receives reassuring, security-compliant, step-by-step account recovery assistance.
- **Input / State**:
  - Customer Message: `"I am locked out of my corporate account and the 2FA SMS code is not arriving on my phone. I have an executive board meeting in 20 minutes and need access!"`
  - Task 4 Analysis: Intent=`account_issue`, Emotion=`worried`, Frustration=6/10, EscalationRisk=`medium`, Sentiment=`negative`.
  - Task 5 Knowledge: Account security and 2FA recovery policy chunks.
- **Expected Decision Support Output**:
  - `priority`: `HIGH` or `MEDIUM`
  - `recommended_tone`: `REASSURING` or `CLARIFYING`
  - `recommended_action`: `CLARIFY` or `PROVIDE_INSTRUCTIONS`
  - `suggested_response`: Reassures urgency, provides immediate alternative 2FA steps (backup code / email verification / identity check), advises on spam/whitelist check.
  - `coaching_tips`:
    1. Acknowledge time urgency immediately.
    2. Guide step-by-step through backup verification without compromising security protocols.
    3. Stay on line until access is restored.
  - `response_evaluation`:
    - `clarity` >= 0.85
    - `empathy` >= 0.80
    - `relevance` >= 0.85
    - `professionalism` >= 0.85
- **Assertions**:
  - `assert any(w in ds.suggested_response.lower() for w in ["login", "account", "verification", "2fa", "code", "access"])`
  - `assert len(ds.coaching_tips) >= 2`
  - `assert ds.response_evaluation.relevance >= 0.80`

### Scenario 5: Positive
- **Objective**: Verify that a satisfied customer expressing appreciation receives a warm, professional closing suggestion that reinforces customer loyalty and rapport.
- **Input / State**:
  - Customer Message: `"Thank you so much, the reset link worked and everything is back up! You've been incredibly helpful and solved it in minutes!"`
  - Task 4 Analysis: Intent=`general_inquiry` (or resolution feedback), Emotion=`satisfied` or `happy`, Frustration=0/10, EscalationRisk=`low`, Sentiment=`positive`.
  - Task 5 Knowledge: Standard closing / satisfaction policy.
- **Expected Decision Support Output**:
  - `priority`: `LOW`
  - `recommended_tone`: `PROFESSIONAL`
  - `recommended_action`: `PROVIDE_INSTRUCTIONS`
  - `suggested_response`: Warm, professional closing acknowledging gratitude, offering final assistance, wishing them well.
  - `coaching_tips`:
    1. Reinforce positive customer rapport and acknowledge gratitude.
    2. Confirm no further issues remain before closing.
    3. Keep closing concise without introducing friction.
  - `response_evaluation`:
    - `professionalism` >= 0.90
    - `empathy` >= 0.80
    - `clarity` >= 0.85
- **Assertions**:
  - `assert ds.priority == DecisionPriority.LOW`
  - `assert ds.recommended_tone == RecommendedTone.PROFESSIONAL`
  - `assert any(w in ds.suggested_response.lower() for w in ["welcome", "glad", "happy to help", "pleasure", "wonderful"])`
  - `assert len(ds.risk_flags) == 0`

### Scenario 6: With Task 5 Knowledge
- **Objective**: Verify that when Task 5 retrieves relevant policy documents, the suggested response incorporates verified facts and source attribution from the retrieved chunks.
- **Input / State**:
  - Customer Query: `"Can I cancel my subscription and receive a prorated refund if I cancel mid-month?"`
  - Task 5 Recommendations: Retrieved chunks from `Cancel_policy_v1.pdf`:
    - Title: `"Cancellation & Prorated Refund Policy"`
    - Content: `"Subscribers may cancel their plan at any time. Subscriptions cancelled within the first 14 days of a billing cycle are eligible for a prorated refund for remaining days. Subscriptions cancelled after 14 days remain active until the end of the current billing cycle without prorated refund."`
    - Source: `"Cancel_policy_v1.pdf"`
    - Relevance: `0.87`
    - `no_relevant_information`: `False`
- **Expected Decision Support Output**:
  - `suggested_response`: Cites the verified 14-day cancellation window and prorated refund conditions directly from the policy.
  - `coaching_tips`: Advises checking subscriber start date against the 14-day threshold, transparently communicating the policy.
  - `response_evaluation`: Relevance is high (>= 0.88) because it directly integrates verified knowledge.
- **Assertions**:
  - `assert "14 days" in ds.suggested_response or "prorated" in ds.suggested_response.lower()`
  - `assert ds.response_evaluation.relevance >= 0.85`
  - `assert any("policy" in tip.lower() or "14" in tip for tip in ds.coaching_tips)`

### Scenario 7: Without Task 5 Knowledge (Strict Anti-Hallucination Guardrail)
- **Objective**: Strictly verify that when Task 5 finds no relevant knowledge (`no_relevant_information: True`), the response suggestion NEVER invents fake policies, numbers, or rules.
- **Input / State**:
  - Customer Query: `"Does your company accept payments in Dogecoin cryptocurrency and what is the return policy for outer-space lunar modules?"`
  - Task 5 Recommendations: `recommendations: []`, `no_relevant_information: True`.
- **Expected Decision Support Output**:
  - `suggested_response`: Safe refusal / clarification; politely explains that this information is not available in official policies, offers standard payment options, or offers to escalate to senior management.
  - **Strict Anti-Hallucination Check**: Must NOT contain fabricated terms like `"Dogecoin policy"`, `"cryptocurrency rate"`, `"lunar module returns"`, or fake penalty fees.
  - `coaching_tips`: Contains explicit anti-hallucination guidance:
    1. Do not fabricate policy guidelines when documentation is missing.
    2. Offer verified standard options or offer supervisor consultation.
  - `response_evaluation`: High score for factual restraint and clarity.
- **Assertions**:
  - `assert "dogecoin" not in ds.suggested_response.lower() or "not accepted" in ds.suggested_response.lower() or "not supported" in ds.suggested_response.lower()`
  - `assert "lunar" not in ds.suggested_response.lower() or "no policy" in ds.suggested_response.lower()`
  - `assert any("fabricate" in tip.lower() or "verify" in tip.lower() or "consult" in tip.lower() or "policy" in tip.lower() for tip in ds.coaching_tips)`

### Scenario 8: Multi-Turn Dialogue Context
- **Objective**: Verify that in a multi-turn conversation, response suggestions resolve pronominal references ("that", "it") and maintain dialogue continuity from previous turns.
- **Input / State**:
  - Conversation History (Turn 1):
    - Customer: `"My order #ORD-44912 has not arrived and was supposed to be delivered yesterday."`
    - Agent: `"I understand and I am looking into order #ORD-44912 for you right now."`
  - Turn 2 Customer Follow-up: `"How long does that investigation usually take?"`
  - Task 4 Analysis: Intent=`delivery_issue`, Emotion=`frustrated`, Frustration=5/10.
  - Task 5 Knowledge: Delivery investigation SLA chunks (e.g. 24–48 hours).
- **Expected Decision Support Output**:
  - `suggested_response`: Understands that "that investigation" refers to the delayed order #ORD-44912; does not ask the customer to re-enter order details; provides realistic delivery investigation timeframe (24–48 hours).
  - `coaching_tips`:
    1. Avoid asking the customer to repeat their order number (#ORD-44912).
    2. Provide an explicit follow-up timeframe (24–48 hours).
  - `response_evaluation`: High score on contextual relevance and empathy.
- **Assertions**:
  - `assert "ORD-44912" in ds.suggested_response or "order" in ds.suggested_response.lower()`
  - `assert any("repeat" in tip.lower() or "context" in tip.lower() or "order" in tip.lower() for tip in ds.coaching_tips)`
  - `assert ds.response_evaluation.relevance >= 0.85`

---

## 7. Integration & Architecture Design

### 7.1 Support-Turn Flow Integration (`process_support_turn`)
In `final_project/RAG-Pipeline-backend/app/services/conversation_orchestration_service.py`:
1. Customer message generated (Task 3)
2. Intent & emotion analyzed (Task 4)
3. Knowledge retrieved (Task 5)
4. **Task 6 Phase 1 Decision Support Generation**:
   ```python
   decision_support = generate_decision_support(
       analysis_result=analysis_resp,
       history=analysis_history,
       knowledge=rec_result,
       customer_message=customer_message,
   )
   ```
5. Persist `decision_support.model_dump()` in the System message snapshot.
6. Return `decision_support` in `response_data` dictionary.

### 7.2 API Endpoint Compatibility
- `POST /analysis/{session_id}/decision-support`: Returns `DecisionSupportResult` (with extended fields).
- `GET /analysis/{session_id}/decision-support`: Retrieves the latest `DecisionSupportResult` from session history.
- `POST /support/turn`: Returns `IntegratedTurnResponse` containing the full `decision_support`.

### 7.3 Frontend UI Integration
In `final_project/frontend/src/components/SupportConsole.tsx` & `DecisionSupportCard.tsx`:
- Render Coaching Tips section under AI Decision Support.
- Render Response Evaluation score bars (Clarity, Empathy, Relevance, Professionalism).
- Update the `"Use Suggested Tone in Reply"` button to inject `decisionSupport.suggested_response` directly into the agent textarea:
  ```typescript
  onClick={() => {
    const textToInsert = decisionSupport.suggested_response || fallbackText;
    handleInsertText(textToInsert);
  }}
  ```
- Visual polish: Retain existing clean card design and color scheme.

---

## 8. Regression Testing Plan & Execution Commands

To guarantee a 100% pass rate with zero regressions across the entire project:

### 8.1 Backend Test Commands (Execute from `final_project/RAG-Pipeline-backend`)

| Milestone | Command | Target Passing Count |
|:---|:---|:---:|
| **Task 3 Simulator** | `pytest tests/test_simulator.py -v` | 16 / 16 PASS |
| **Task 4 Analysis** | `pytest tests/test_analysis_phase1.py tests/test_analysis_phase2.py tests/test_analysis_phase4.py tests/test_analysis_phase5.py tests/test_analysis_phase6.py tests/test_task3_task4_integration.py tests/test_task4_final.py -v` | 307 / 307 PASS |
| **Task 5 Knowledge** | `pytest tests/test_knowledge_recommendation_phase1.py tests/test_knowledge_recommendation_phase2.py tests/test_knowledge_recommendation_phase3.py tests/test_knowledge_recommendation_phase4.py tests/test_task5_core.py -v` | 151 / 151 PASS |
| **Backend E2E** | `pytest tests/test_backend_e2e.py -v` | 11 / 11 PASS |
| **Task 6 Phase 1** *(New)* | `pytest tests/test_coaching_phase1.py -v` | 30–35 / 30–35 PASS |
| **Full Regression Suite** | `pytest tests/ -v` | **515+ / 515+ PASS (0 Failures)** |

### 8.2 Frontend Build & Lint Verification (Execute from `final_project/frontend`)

```bash
# Verify zero TypeScript compile errors and valid Vite production build
npm run build
```

Expected result:
```
✓ built in ~200ms
0 TypeScript errors
0 Vite bundle warnings
```

---

## 9. Scope Boundaries & Guardrails (Phase 1 ONLY)

1. **NO Task 6 Phase 2 Escalation Agent**:
   - Do NOT implement or test supervisor paging, alert dispatchers, Webhook callbacks, or dedicated escalation monitoring background services.
   - Reuse existing Task 4 `escalation_risk` (`low`, `medium`, `high`) solely as an input signal to recommend tone and coaching tips.
2. **NO Redundant Models or Classifiers**:
   - Do NOT create a secondary classifier for response coaching; derive recommendations directly from Task 4 analytical signals and Task 5 knowledge.
   - Do NOT create parallel decision support routes or models.
3. **Anti-Hallucination Guardrail**:
   - Strictly verify that no fabricated policies are introduced in response suggestions when Task 5 returns `no_relevant_information: True`.
4. **Preserve Task 3 Baseline**:
   - Zero changes to Task 3 personas, scenarios, emotional state engine, or simulator endpoints.

---

## 10. Summary Checklist for Implementers

- [ ] Add `ResponseEvaluation` Pydantic model to `app/schemas/analysis.py`.
- [ ] Add optional `suggested_response`, `coaching_tips`, and `response_evaluation` to `DecisionSupportResult` in `app/schemas/analysis.py`.
- [ ] Update `generate_decision_support` in `app/services/decision_support_service.py` to generate suggestions, coaching tips, and evaluations using Task 4 analysis and Task 5 knowledge.
- [ ] Ensure `get_session_decision_support` populates the new fields from session state.
- [ ] Connect Task 6 in `conversation_orchestration_service.py` (`process_support_turn` and `start_orchestrated_session`).
- [ ] Create `tests/test_coaching_phase1.py` implementing all 8 test scenarios and schema tests.
- [ ] Update `types/index.ts` in `final_project/frontend` to reflect the extended schema.
- [ ] Update `SupportConsole.tsx` / `DecisionSupportCard.tsx` to display coaching tips, response evaluation metrics, and wire the button.
- [ ] Run full regression test suite (100% PASS).
- [ ] Run `npm run build` in `final_project/frontend` (0 errors).
