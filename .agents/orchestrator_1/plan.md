# Orchestrator Plan — Task 4 Phase 7 & 8 Completion

## Objective
Deliver complete Task 4 (Intent & Sentiment Analysis Agent) Phase 7 & 8 integration, validation test suite (`tests/test_task4_final.py` 40-60 tests), documentation (`docs/TASK4_FINAL.md`), and ensure 100% pass across all 310+ tests while maintaining strict architectural boundaries and protected baselines.

## Execution Steps

### Phase 0: Survey & Spec Mining
- Dispatch 3 parallel exploration subagents:
  1. `teamwork_preview_explorer` (Codebase architecture: Task 4 Phases 1-6 implementation, routers, models, persistence, Task 3 contracts)
  2. `teamwork_preview_explorer` (Test baseline: Existing 271+ tests, test runner environment, fixtures, DB handling, test execution status)
  3. `teamwork_preview_spec_miner` (Requirement specs: Detailed breakdown of R1-R7, analytical dimensions, Gemini vs Fallback reporting, Section A-L documentation requirements)
- Synthesize findings into `PROJECT.md` and `TEST_INFRA.md`.

### Phase 1: Test Infrastructure & Validation Suite Development (R5)
- Dispatch `teamwork_preview_test_writer` / `teamwork_preview_worker` to create `tests/test_task4_final.py` with 40-60 automated tests covering:
  - Multi-turn runtime integration (Task 3 Simulator <-> Task 4 Analysis) across 3-5 turns (R1)
  - Full analytical coverage: 8 intents, 7 emotions, 3 sentiments, frustration 0-10, satisfaction trends, escalation risks, confidence bounds (R2)
  - Gemini resilience, deterministic fallback, failure isolation, and real Gemini reporting (R3)
  - Concurrent session isolation (Session A & Session B) without cross-contamination (R4)
  - API and SQLite DB persistence integrity (R6)
- Review with 2 Reviewers, 2 Challengers, 1 Forensic Auditor.

### Phase 2: Runtime Verification & Integration Gap Remediation (if needed)
- Run full regression suite (all 8 test files, 310+ tests) via worker.
- If any test fails or minor integration gap exists:
  - Explorer diagnoses root cause.
  - Worker fixes strictly within Phase 7 & 8 boundaries (never touching Task 3 or rewriting Task 4 Phases 1-6 core).
  - Gate review (2 Reviewers, 2 Challengers, 1 Auditor).

### Phase 3: Final Documentation (R7)
- Dispatch worker to generate `docs/TASK4_FINAL.md` covering all sections A through L:
  - Section A: System Architecture & Data Flow
  - Section B: Contract Specifications (Pydantic models, enums, endpoints)
  - Section C: Multi-turn Continuous Dialogue Integration (Task 3 <-> Task 4)
  - Section D: Analytical Engine & Rule Hierarchy (8 intents, 7 emotions, 3 sentiments, etc.)
  - Section E: Gemini vs Fallback Mechanics & Failure Isolation
  - Section F: Session Isolation & Concurrency Verification
  - Section G: SQLite Persistence & Database Integrity
  - Section H: API Endpoint Audit & OpenAPI Conformance
  - Section I: Test Suite Architecture & Verification Matrix (310+ tests)
  - Section J: Real Gemini Execution Status Report
  - Section K: Protected Baseline & Non-Violation Compliance
  - Section L: Deliverable Matrix & Sign-Off Checklist

### Phase 4: Full Audit, Verification & Final Reporting
- Run full regression verification across all 8 test files.
- Run final Forensic Audit for Task 3 & Task 4 protected baselines, no secondary classifiers, strict boundary compliance, no mock cheating.
- Prepare comprehensive handoff report to Sentinel with full verification logs.
