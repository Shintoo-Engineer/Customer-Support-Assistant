# Project: Task 6 Phase 1 - Coaching & Response Suggestion Agent

## Architecture
Extends existing AI Decision Support architecture in `Customer-Support-Assistant/final_project` without duplicating UI or breaking Task 3/4/5 logic.
- **Backend Flow**:
  1. Customer Message -> Task 4 Analysis (`AnalysisResult`: intent, emotion, frustration 0-10, satisfaction trend, escalation risk).
  2. Query -> Task 5 Knowledge Retrieval (`KnowledgeRecommendationResult`: active ChromaDB + SQLite documents, relevance threshold 0.38, `no_relevant_information` flag).
  3. Context-Aware Decision Support (`DecisionSupportResult`): Ingests Task 4 analysis + Task 5 knowledge.
     - Generates non-generic `suggested_response`.
     - Generates actionable `coaching_tips`.
     - Generates `response_evaluation` (clarity, empathy, relevance, professionalism).
     - Strict anti-hallucination guardrail: if `no_relevant_information == True`, provides helpful inquiry/clarification without fabricating unverified policy guarantees.
- **Frontend Flow**:
  1. `SupportConsole.tsx` polls/fetches `GET /analysis/{sessionId}/decision-support`.
  2. Renders via unified `DecisionSupportCard.tsx` displaying:
     - Suggested response in a styled quote box.
     - Coaching tips in an actionable list.
     - Response evaluation 4-metric score grid (Clarity, Empathy, Relevance, Professionalism).
     - "Use Suggested Tone in Reply" button: clicking injects `suggested_response` into the agent's message draft area.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Schema Extension | Extend `DecisionSupportResult` with `suggested_response`, `coaching_tips`, and `response_evaluation` (backward compatible) | M1 | ORIGINAL_REQUEST R1 |
| 2 | Response Evaluation Model | Define `ResponseEvaluation` schema with clarity, empathy, relevance, professionalism | M1 | ORIGINAL_REQUEST R1 |
| 3 | Context-Aware Generation | Generate tailored suggestions combining Task 4 emotions/intents and Task 5 policy knowledge | M1 | ORIGINAL_REQUEST R2 |
| 4 | Anti-Hallucination Guardrail | When Task 5 returns no relevant knowledge, do not invent or fabricate policy details | M1 | ORIGINAL_REQUEST R2 |
| 5 | Deterministic Fallback Engine | Robust rule-based fallback generating valid responses & coaching when offline/mocked | M1 | ORIGINAL_REQUEST R2 |
| 6 | Frontend Type Parity | Update `src/types/index.ts` with `ResponseEvaluation` and new `DecisionSupportResult` fields | M2 | ORIGINAL_REQUEST R1 |
| 7 | UI Metrics Display | Render suggested response, coaching tips, and evaluation scores in `DecisionSupportCard.tsx` | M2 | ORIGINAL_REQUEST R3 |
| 8 | Button Action Injection | Update "Use Suggested Tone in Reply" button to inject `decision.suggested_response` into agent input | M2 | ORIGINAL_REQUEST R3 |
| 9 | SupportConsole Deduplication | Replace inline duplicated decision support JSX in `SupportConsole.tsx` with `<DecisionSupportCard />` | M2 | ORIGINAL_REQUEST R3 |
| 10 | 8-Scenario Pytest Suite | Dedicated pytest suite `test_coaching_decision_support_phase1.py` covering all 8 scenarios | M3 | ORIGINAL_REQUEST Acceptance Criteria |
| 11 | Anti-Hallucination Assertion | Programmatic test verifying zero fabricated policies when Task 5 knowledge is empty | M3 | ORIGINAL_REQUEST Acceptance Criteria |
| 12 | Regression Verification | Verify 100% pass across Task 3, Task 4, Task 5 automated test suites | M3 | ORIGINAL_REQUEST Acceptance Criteria |
| 13 | Frontend Build Verification | Verify `npm run build` in `final_project/frontend` succeeds with 0 TypeScript/Vite errors | M3 | ORIGINAL_REQUEST Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend Schema & Coaching Engine | Extend `DecisionSupportResult`, implement context-aware suggestion & coaching generator with anti-hallucination guardrail | none | IN_PROGRESS (ec886d56-6d15-4069-b309-33f2d7302ccb) |
| M2 | Frontend Decision Support Panel | Update TypeScript interfaces, enhance `DecisionSupportCard.tsx` with coaching metrics, wire button injection, deduplicate `SupportConsole.tsx` | M1 | PLANNED |
| M3 | Comprehensive Test Suite & Regression | Implement `test_coaching_decision_support_phase1.py` covering 8 scenarios, verify 100% regression pass, verify frontend build | M1, M2 | PLANNED |

## Interface Contracts
### Backend ↔ Frontend
```typescript
export interface ResponseEvaluation {
  clarity: number; // 0.0 - 1.0 or 0 - 100
  empathy: number; // 0.0 - 1.0 or 0 - 100
  relevance: number; // 0.0 - 1.0 or 0 - 100
  professionalism: number; // 0.0 - 1.0 or 0 - 100
  notes?: string | null;
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
  suggested_response: string;
  coaching_tips: string[];
  response_evaluation: ResponseEvaluation;
}
```

### Backend Internal Contract: `decision_support_service.py`
```python
def generate_decision_support(
    analysis: AnalysisResult,
    conversation_history: list[dict[str, Any]] | None = None,
    knowledge_recommendations: KnowledgeRecommendationResult | list[dict[str, Any]] | None = None,
    session_id: int | None = None,
    turn_number: int | None = None,
) -> DecisionSupportResult:
    ...
```

## Code Layout
- Backend Root: `C:\Users\shrushti\Customer-Support-Assistant\final_project\RAG-Pipeline-backend`
  - `app/schemas/analysis.py`: Pydantic models (`ResponseEvaluation`, `DecisionSupportResult`).
  - `app/services/decision_support_service.py`: Decision support, suggestion, and coaching logic.
  - `app/api/analysis.py`: Decision support API endpoints.
  - `tests/test_coaching_decision_support_phase1.py`: Dedicated 8-scenario test suite.
- Frontend Root: `C:\Users\shrushti\Customer-Support-Assistant\final_project\frontend`
  - `src/types/index.ts`: TypeScript contracts.
  - `src/components/DecisionSupportCard.tsx`: Coaching & Decision Support presentation component.
  - `src/components/SupportConsole.tsx`: Parent support agent console.
