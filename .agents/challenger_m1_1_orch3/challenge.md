# Adversarial Challenge Report — Milestone 1: Response Coaching & Decision Support

**Author**: `challenger_m1_1_orch3`  
**Target**: Milestone 1 Implementation (`final_project/RAG-Pipeline-backend`)  
**Commit/Test Target**: `app/services/decision_support_service.py`, `app/schemas/analysis.py`, `tests/test_m1_adversarial_challenger.py`  
**Verdict**: **REQUEST_CHANGES**

---

## Challenge Summary

**Overall risk assessment**: **HIGH**

The Milestone 1 implementation successfully handles emotional spectrum transitions, boundary frustration scaling (0 to 10), critical/low priority determinations, malformed dialogue histories, standard empty knowledge states (`None`, `[]`, `no_relevant_information=True`), and LLM network/JSON failure recovery. 24 of 27 adversarial stress tests passed.

However, **adversarial stress testing revealed 2 reproducible defects (including 1 critical anti-hallucination leak)** where the coaching engine hallucinates specific refund timeframes ("within 5-7 business days") and payment hold timeframes ("within 24-48 hours") when provided with whitespace or unextractable knowledge chunks, and creates semantic contamination when retrieved knowledge does not match the customer's intent.

---

## Challenges

### [High] Challenge 1: Anti-Hallucination Guardrail Bypass on Whitespace / Unextractable Chunks

- **Assumption challenged**: `_parse_knowledge_context` implicitly assumed that if `raw_recs` contains items, valid knowledge is available (`no_relevant_info = False`). Furthermore, `generate_coaching_fallback` assumed that if `chunk_snippets` is empty (`[]`) despite `no_relevant_info = False`, it is safe to emit hardcoded policy promises with explicit timelines.
- **Attack scenario**:
  A knowledge recommendation payload containing chunks with whitespace-only content (e.g. `content="   \t   "`) or unextractable snippets is passed to `generate_decision_support`.
  ```python
  rec = KnowledgeRecommendationResult(
      query="refund time",
      recommendations=[
          KnowledgeRecommendation(
              title="Refund Policy Blank",
              content="   \t   ",
              source="Refund_policy_v2.pdf",
              document_type="policy",
              relevance_score=0.9
          )
      ],
      no_relevant_information=False
  )
  res = generate_decision_support(analysis_result=analysis, knowledge_recommendations=rec)
  ```
- **Observed empirical failure**:
  `res.suggested_response` emitted:
  > *"I understand your frustration and appreciate your patience while we work through this together. According to our refund policy, once verified, refunds are processed back to your original payment method within 5-7 business days. Please share your order number so I can check your refund status right away. Please let me know if you have any questions, and I will be happy to help."*
- **Blast radius**:
  The system explicitly promised `"within 5-7 business days"` when zero verified policy text was retrieved. If this happens with payment or delivery issues, it promises `"within 24-48 hours"` (lines 534, 539 of `decision_support_service.py`). This directly violates the anti-hallucination mandate: *"assert that suggested responses NEVER claim specific refund policies, warranty windows, or unverified claims."*
- **Recommended mitigation**:
  1. In `_parse_knowledge_context` (`decision_support_service.py` lines 281–292): filter out any chunk where `not item.get("content", "").strip()`. If no valid non-empty chunks remain, set `no_relevant_info = True`.
  2. In `generate_coaching_fallback` (`decision_support_service.py` line 516): if `not chunk_snippets`, treat it as `no_relevant_info = True` and route to the clarifying question guardrail (lines 508–514) rather than fabricating fallback timeframes.

---

### [Medium] Challenge 2: Cross-Domain Semantic Mismatch in Fallback Body Generation

- **Assumption challenged**: `generate_coaching_fallback` assumes that any retrieved knowledge chunk snippet matches the customer's intent category, and formats the response as `"According to our {intent} policy, {chunk_snippets[0]}"`.
- **Attack scenario**:
  Customer has intent `CustomerIntent.REFUND` ("Can I get my money back?"), but RAG retrieval returns a hardware warranty chunk (`"Hardware components have a strict 1-year limited warranty from the date of purchase."`).
- **Observed empirical failure**:
  `res.suggested_response` emitted:
  > *"According to our refund policy, hardware components have a strict 1-year limited warranty from the date of purchase. Once verified, refunds are typically processed back to your original payment method within standard processing timelines."*
- **Blast radius**:
  The support agent is advised to tell the customer that the company's refund policy is a 1-year hardware warranty. This generates confusing, legally incorrect advice.
- **Recommended mitigation**:
  Instead of hardcoding `"According to our {intent} policy, {chunk_snippets[0]}"`, format using the retrieved document's own title or generic phrasing (e.g. `"Based on our {chunk_title} guidelines: {chunk_snippets[0]}"`), or verify that the document matches the intent topic before asserting that it represents the `{intent}` policy.

---

## Stress Test Results

Test suite: `final_project/RAG-Pipeline-backend/tests/test_m1_adversarial_challenger.py` (27 items)

| # | Test Name | Scenario / Focus | Result | Verbatim Observation / Assertion |
|---|-----------|------------------|:------:|----------------------------------|
| 1 | `test_boundary_frustration_zero_calm` | Frustration = 0, Low priority, calm tone | **PASS** | `priority == DecisionPriority.LOW`, no risk flags, polite opening |
| 2 | `test_boundary_frustration_ten_critical` | Frustration = 10, Escalation risk HIGH | **PASS** | `priority == DecisionPriority.CRITICAL`, action ESCALATE, apology opening |
| 3–10 | `test_frustration_boundary_spectrum` [0, 1, 4, 5, 7, 8, 9, 10] | Step-by-step frustration boundary transitions | **PASS** | 0-4 -> LOW; 5-7 -> MEDIUM; 8-10 -> HIGH; 9-10 -> ESCALATE action |
| 11 | `test_critical_priority_requires_both_high_risk_and_severe_frustration` | Priority rules combination check | **PASS** | Frustration 7 + HIGH risk -> HIGH; Frustration 8 + HIGH risk -> CRITICAL |
| 12 | `test_emotion_angry_triggers_empathy_and_risk_flag` | Extreme emotion: ANGRY | **PASS** | EMPATHETIC tone, `angry_customer` flag, empathy score >= 0.90 |
| 13 | `test_emotion_satisfied_triggers_professional_tone_and_appreciation` | Extreme emotion: SATISFIED | **PASS** | PROFESSIONAL tone, LOW priority, positive opening/closing |
| 14 | `test_emotion_worried_triggers_reassuring_tone` | Extreme emotion: WORRIED | **PASS** | REASSURING tone, reassurance coaching tip |
| 15 | `test_emotion_confused_triggers_clarifying_tone` | Extreme emotion: CONFUSED | **PASS** | CLARIFYING tone, numbered steps coaching tip |
| 16 | `test_dialogue_history_none_and_empty` | Dialogue history `None` and `[]` | **PASS** | Handled without exception; valid decision support produced |
| 17 | `test_dialogue_history_missing_keys_graceful_handling` | History dicts missing standard keys | **PASS** | Prompt builder falls back to default keys safely |
| 18 | `test_dialogue_history_with_none_elements_resilience` | Adversarial history with `None` & non-dict | **PASS** | Safely caught in generation flow, falls back to deterministic |
| 19 | `test_out_of_domain_query_no_policy_fabrication` | Query asking for 5-yr laptop warranty | **PASS** | Zero warranty fabrication; requests order/account info |
| 20 | `test_anti_hallucination_empty_knowledge_formats` | 6 empty knowledge representations (`None`, `[]`, `no_relevant_info=True`, etc.) | **PASS** | Zero timeline fabrication; requests clarifying details |
| 21 | `test_parse_knowledge_context_robustness` | Valid models vs `no_relevant_information=True` | **PASS** | Correctly extracts chunks and sets `no_relevant_info` flag |
| 22 | `test_gemini_timeout_network_exception_fallback` | Gemini raises `TimeoutError` | **PASS** | Falls back cleanly to deterministic response & coaching |
| 23 | `test_gemini_missing_keys_json_fallback` | Gemini returns incomplete JSON | **PASS** | Safely detects missing fields and falls back |
| 24 | `test_gemini_eval_scores_clamped` | Gemini returns scores > 1.0 or < 0.0 | **PASS** | Scores clamped strictly within [0.0, 1.0] |
| 25 | `test_adversarial_empty_string_content_chunk` | Recommendation with whitespace-only content | **FAIL** | Fabricated `"5-7 business days"` timeline |
| 26 | `test_adversarial_whitespace_content_chunk` | Raw dict chunk with whitespace `content` | **FAIL** | Fabricated `"5-7 business days"` timeline |
| 27 | `test_adversarial_irrelevant_cross_domain_chunk` | Refund query with hardware warranty chunk | **FAIL** | Conflated hardware warranty as `"refund policy"` |

---

## Unchallenged Areas

- **Frontend UI Components (`DecisionSupportCard.tsx`, `SupportConsole.tsx`)**: Out of scope for Milestone 1; reserved for Milestone 2.
- **Live Gemini API Live End-to-End Traffic**: The environment lacks a valid Gemini API key (`400 INVALID_ARGUMENT`), so LLM interactions were validated via mock and fallback resilience harnesses.

---

## Verdict & Recommendation

**Verdict**: **REQUEST_CHANGES**

Milestone 1 is well-structured and 89% of adversarial challenges pass. However, before proceeding to Milestone 2, the worker agent must patch `app/services/decision_support_service.py` to:
1. Ensure `_parse_knowledge_context` rejects whitespace-only chunks and marks `no_relevant_info = True`.
2. Ensure `generate_coaching_fallback` routes to the clarifying-question guardrail if `chunk_snippets` is empty, rather than emitting hardcoded timeline claims ("5-7 business days", "24-48 hours").
3. Ensure knowledge chunk citations in fallback responses reflect the document source rather than falsely branding cross-domain chunks as the `{intent}` policy.
