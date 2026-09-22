# Original User Request

## 2026-09-17T07:35:27Z

Fix frontend–backend semantic accuracy, emotional progression, and knowledge retrieval for Customer Support Assistant.

Working directory: C:\Users\shrushti\Customer-Support-Assistant
Integrity mode: demo

## Requirements

### R1. Task 3 Customer Response to Agent Feedback (Positive, Negative, Neutral)
The simulated customer must dynamically and contextually respond to the support agent's actual response:
- **Positive / Helpful agent response** (e.g. resolution, refund processed, delivery expedited, reset link sent): Customer acknowledges resolution/progress, frustration decreases, trust and satisfaction increase, escalation risk drops.
- **Negative / Unhelpful agent response** (e.g. refusal to help, dismissive tone, telling customer nothing can be done without next steps): Customer reacts with increased frustration/anger, satisfaction declines, escalation risk increases, and customer demands supervisor or complains.
- **Neutral / Information-seeking response** (e.g. asking for order ID or email): Customer provides requested information without unjustified emotional swings.

### R2. Task 4 Semantic Accuracy for Emotion, Intent, and Sentiment
- **Emotion Recognition**: Explicit emotional expressions (e.g. "I'm extremely angry", "This is ridiculous", "You people are useless", "I've been waiting for days", "This is the third time") must be accurately classified into `angry`, `frustrated`, `confused`, `worried`, `happy`, or `satisfied`. Must NOT default to `neutral` when affective signals are present.
- **Intent Detection**: The customer's primary issue must be correctly classified into existing backend enum types:
  - Card/transaction declines -> `payment_issue`
  - Order tracking/delays -> `delivery_issue`
  - Money back requests -> `refund`
  - Subscription/order stop -> `cancellation`
  - Login/password/2FA issues -> `account_issue`
  - Damaged goods/swaps -> `return_exchange`
- **Frustration, Satisfaction Trend, and Escalation Risk**: Must accurately reflect dialogue history, repeated complaints, emotional intensity, and agent resolution impact.

### R3. Task 5 Knowledge Recommendation & ChromaDB Document Ingestion
- Ingest real policy documents for all supported scenarios into SQLite and ChromaDB (`Payment_policy_v1.pdf`, `Delivery_policy_v1.pdf`, `Cancel_policy_v1.pdf`, `Return_policy_v1.pdf`, `Fraud_policy_v1.pdf`).
- Prioritize topic-relevant knowledge matching the customer's actual issue (e.g., payment queries retrieve payment troubleshooting and policies, not unrelated refund articles).
- Maintain strict anti-hallucination guardrail: out-of-domain queries must return "No relevant knowledge found".

### R4. Frontend UI Refinement (Login Page & Home Page)
- **Login Page**: Remove hardcoded credentials and demo account pills. Keep a simple, clean form (Email, Password, [Login]). Authenticate via backend SQLite and route Admins to Admin Panel and normal users to Dashboard.
- **Home Page**: Remove the entire "HOW IT WORKS" section and 5-step numbered cards. Provide a clean hero with a one-line description and a single `[Start New Simulation]` button.
- **Truth in Display**: Frontend must display the exact backend return values without artificial overrides or fallback defaults.

## Acceptance Criteria

### Automated & Programmatic Verification
- [ ] Pytest suite in `RAG-Pipeline-backend`: all existing and new unit/integration tests pass (100%).
- [ ] Frontend build: `npm run build` in `frontend/` succeeds with 0 TypeScript/Vite errors.
- [ ] Live API End-to-End Tests:
  - Positive support response triggers customer resolution message and decreased frustration (< 3/10).
  - Negative support response triggers customer complaint/escalation message and increased frustration (> 7/10).
  - Neutral information request triggers customer providing data without emotional spikes.
  - Emotion classification correctly identifies `angry` and `frustrated` phrases instead of `neutral`.
  - Intent classification correctly matches payment, delivery, refund, cancellation, and account issues.
  - Task 5 retrieves payment policies for payment issues and delivery policies for delivery issues.
  - Task 5 safely returns "No relevant knowledge found" for out-of-domain queries.
  - Login page has zero exposed credentials.
  - Home page contains no "HOW IT WORKS" section.

## 2026-09-21T16:16:38Z

# Teamwork Project Prompt

Build Task 6 Phase 1 (Coaching & Response Suggestion Agent) by formalizing and extending the existing AI Decision Support system in the Customer Support Assistant, without duplicating UI or breaking existing Task 3/4/5 logic.

Working directory: c:\Users\shrushti\Customer-Support-Assistant
Integrity mode: demo

## Requirements

### R1. Inspection & Schema Extension
Inspect the existing frontend/backend AI Decision Support flow. Extend the existing schema/model to include `suggested_response`, `coaching_tips`, and `response_evaluation` (clarity, empathy, relevance, professionalism). Do not create parallel logic if existing models can safely be extended.

### R2. Context-Aware Generation
Generate non-generic response suggestions and actionable coaching tips using real context (Task 4 intent/emotion/frustration, Task 5 knowledge). Do not fabricate policies if Task 5 returns no relevant knowledge.

### R3. Backend & Frontend Integration
Integrate cleanly into the existing support-turn flow (Customer → Task 4 → Task 5 → Task 6 → UI). Update the frontend AI Decision Support panel to display the new coaching metrics while reusing the existing "Use Suggested Tone in Reply" button. Keep the current visual design.

### R4. SCOPE LIMIT — PHASE 1 ONLY
This is ONLY Task 6 Phase 1.
Do NOT implement the dedicated Task 6 Phase 2 Escalation Risk Monitoring Agent yet.
Do NOT add new escalation scoring algorithms, escalation thresholds, escalation alerts, or escalation-monitoring services unless they already exist and are required only for compatibility.
Reuse existing Task 4 escalation-risk information where needed for response coaching, but do not redesign or replace it.
Do not implement Phase 3 alerts or Phase 4 final evaluation/documentation.
Keep all changes strictly limited to:
- Coaching
- Context-aware response suggestion
- Coaching tips
- Response evaluation
- Existing AI Decision Support enhancement
- Integration with Task 4 and Task 5
- Tests and regression verification

## Acceptance Criteria

### Testing & Verification
- [ ] Programmatic Tests: Write or update automated pytest scripts covering the 8 specific test scenarios (Refund/frustrated, Payment/angry, Delivery/confused, Account/login, Positive, with/without Task 5 knowledge, multi-turn) to verify new coaching tips and response evaluations are generated.
- [ ] No fabricated knowledge is introduced in suggestions (verified via programmatic tests).
- [ ] Existing "Use Suggested Tone in Reply" button injects the new Task 6 response suggestion (verified via frontend build/tests).
- [ ] Existing Task 3, Task 4, and Task 5 automated test suites continue to pass at 100% (Regression).
- [ ] Frontend `npm run build` succeeds with zero TypeScript/Vite errors.

