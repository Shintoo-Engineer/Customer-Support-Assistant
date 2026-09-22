# Execution Plan — Customer Support Assistant Semantic & Retrieval Refinement

## Objectives
Implement and verify all fixes for:
1. **R1: Task 3 Customer Response to Agent Feedback** (Positive, Negative, Neutral feedback response; dynamic emotional progression, frustration/trust/satisfaction adjustment).
2. **R2: Task 4 Semantic Accuracy for Emotion, Intent, and Sentiment** (Accurate classification of angry/frustrated expressions, 8 intents, frustration bounds and trends, failure resilience).
3. **R3: Task 5 Knowledge Recommendation & ChromaDB Document Ingestion** (Policy PDFs ingestion into SQLite & ChromaDB, topic-relevant retrieval, anti-hallucination fallback).
4. **R4: Frontend UI Refinement & Display Truth** (Login page credential cleanup & role routing, Home page clean hero without "HOW IT WORKS", truth in display without artificial overrides).
5. **E2E & Full Regression** (100% pytest pass in backend, 0 errors `npm run build` in frontend, comprehensive Live API E2E tests).

## Milestones
- **Milestone 0: Comprehensive Survey & Gap Analysis**
  - Dispatch 3 Explorers across backend Task 3, Task 4/5, and Frontend.
  - Baseline existing tests and establish gap analysis against R1–R4.
- **Milestone 1: Task 3 Emotional Progression & Dynamic Response (R1)**
  - Worker updates Task 3 simulator to dynamically evaluate agent response (positive/helpful, negative/unhelpful, neutral/info-seeking).
  - Adjust customer emotion, frustration, satisfaction, and response text accordingly.
  - Review, Challenge, and Verify with unit tests.
- **Milestone 2: Task 4 Semantic Accuracy for Emotion, Intent, and Sentiment (R2)**
  - Worker enhances emotion recognition (explicit anger/frustration not defaulting to neutral), intent classification, frustration scaling, satisfaction trends.
  - Review, Challenge, and Verify.
- **Milestone 3: Task 5 Knowledge Recommendation & ChromaDB Ingestion (R3)**
  - Ingest policy PDFs (`Payment_policy_v1.pdf`, `Delivery_policy_v1.pdf`, etc.) into SQLite/ChromaDB.
  - Topic-relevant retrieval and out-of-domain safe fallback.
  - Review, Challenge, and Verify.
- **Milestone 4: Frontend UI Refinement & Truth in Display (R4)**
  - Clean Login page (remove hardcoded demo credentials, auth via backend).
  - Clean Home page (remove "HOW IT WORKS" 5-step cards, clean hero).
  - Ensure exact backend display values without client-side fake overrides.
  - Verify `npm run build` succeeds with 0 errors.
- **Milestone 5: Full Regression, E2E Verification & Forensic Audit Gate**
  - Full pytest backend regression (all existing + new tests).
  - Frontend build validation.
  - Live API End-to-End tests covering all acceptance criteria.
  - Forensic integrity audit.
  - Synthesis and final victory report to Sentinel.
