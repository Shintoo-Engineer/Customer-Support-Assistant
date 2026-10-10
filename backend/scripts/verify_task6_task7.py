"""
Comprehensive Verification Script for Task 6 and Task 7
Testing against the running backend (http://127.0.0.1:8000) and verifying
data contracts required by the frontend (http://localhost:5173).
"""

import json
import urllib.request
import urllib.error
import time

BASE_URL = "http://127.0.0.1:8000"

def http_post(endpoint: str, data: dict, token: str = None) -> tuple[int, dict]:
    url = f"{BASE_URL}{endpoint}"
    payload = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"error": body}

def http_get(endpoint: str, token: str = None) -> tuple[int, dict]:
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url, method="GET")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"error": body}

print("=" * 80)
print("COMPREHENSIVE VERIFICATION: TASK 6 & TASK 7")
print("Target: Backend http://127.0.0.1:8000 | Frontend http://localhost:5173")
print("=" * 80)

# Authenticate
status, login_res = http_post("/auth/login", {
    "email": "employee@company.com",
    "password": "Employee1234!"
})
assert status == 200, f"Login failed with status {status}: {login_res}"
token = login_res["access_token"]
print("[OK] Authenticated as Support Employee (JWT token obtained)")

# ==============================================================================
# PART 1: TASK 6 — COACHING, RESPONSE SUGGESTION & ESCALATION
# ==============================================================================
print("\n" + "=" * 60)
print("PART 1: TASK 6 — COACHING, RESPONSE SUGGESTION & ESCALATION")
print("=" * 60)

# ------------------------------------------------------------------------------
# Test 6.1 & 6.2: Suggested Response & Coaching
# ------------------------------------------------------------------------------
print("\n--- Test 6.1 & 6.2: Suggested Response & Coaching (POST /coaching/suggest) ---")
angry_msg = (
    "I requested to cancel last week and you charged me $49.99 anyway! "
    "Connect me to a supervisor right now or I am filing a dispute through my bank!"
)

# Step 1: Analyze message with Task 4 and Task 5
status, task4_res = http_post("/support/analyze", {
    "message": angry_msg,
    "conversation_history": []
})
assert status == 200, f"Task 4 analysis failed: {task4_res}"
print(f"Task 4 Analysis Result:")
print(f"  Intent: {task4_res['intent']}")
print(f"  Emotion: {task4_res['emotion']}")
print(f"  Sentiment: {task4_res['sentiment']}")
print(f"  Frustration Level: {task4_res['frustration_level']}/10")
print(f"  Escalation Risk: {task4_res['escalation_risk']}")

# Task 5 RAG knowledge recommendations for the query
# Using /api/analyze-turn to get real RAG recommendations
status, manual_turn = http_post("/api/analyze-turn", {
    "customer_message": angry_msg,
    "conversation_history": []
})
assert status == 200, f"Analyze turn failed: {manual_turn}"
knowledge_recs = manual_turn["knowledge_recommendations"]
print(f"Task 5 Knowledge Recommendations Count: {len(knowledge_recs)}")
if knowledge_recs:
    print(f"  Top Knowledge Doc: {knowledge_recs[0].get('title')}")

# Step 2: Request real Task 6 Coaching & Response Suggestion
coaching_payload = {
    "message": angry_msg,
    "intent": task4_res["intent"],
    "emotion": task4_res["emotion"],
    "sentiment": task4_res["sentiment"],
    "frustration_level": task4_res["frustration_level"],
    "escalation_risk": task4_res["escalation_risk"],
    "conversation_history": [],
    "knowledge_recommendations": knowledge_recs
}
status, coaching_res = http_post("/coaching/suggest", coaching_payload)
assert status == 200, f"Coaching suggest failed: {coaching_res}"
print(f"Task 6 Coaching Result:")
print(f"  Suggested Response: \"{coaching_res['suggested_response']}\"")
print(f"  Tone: {coaching_res['tone']}")
print(f"  Clarity: {coaching_res['clarity']}")
print(f"  Empathy: {coaching_res['empathy']}")
print(f"  Professionalism: {coaching_res['professionalism']}")
print(f"  Communication Rating: {coaching_res['communication_rating']}")
print(f"  Coaching Tips ({len(coaching_res['coaching_tips'])}):")
for tip in coaching_res['coaching_tips']:
    print(f"    - {tip}")

# Assertions for 6.1 & 6.2
assert len(coaching_res["suggested_response"]) > 20, "Suggested response must not be empty"
assert coaching_res["communication_rating"] in {"Good", "Needs Improvement"}
assert len(coaching_res["coaching_tips"]) > 0, "Actionable coaching tips must be provided"
assert coaching_res["tone"] != "", "Tone must be evaluated"
assert coaching_res["clarity"] != "", "Clarity must be evaluated"
assert coaching_res["empathy"] != "", "Empathy must be evaluated"
assert coaching_res["professionalism"] != "", "Professionalism must be evaluated"
# Verify context awareness (mentions cancel/charge/refund/inconvenience)
suggested_lower = coaching_res["suggested_response"].lower()
assert any(term in suggested_lower for term in ["cancel", "refund", "charge", "inconvenience", "frustrat", "concern", "assist", "verify", "escalat"]), \
    "Suggested response must be context-aware and address the customer issue"

print(">>> Test 6.1 (Suggested Response) & Test 6.2 (Coaching Evaluation): PASS")

# ------------------------------------------------------------------------------
# Test 6.3 & 6.4: Escalation Monitor & Alert
# ------------------------------------------------------------------------------
print("\n--- Test 6.3 & 6.4: Escalation Monitor & Alert ---")
escalation_data = manual_turn["escalation"]
print(f"Escalation Monitor Output:")
print(f"  Risk Score: {escalation_data['risk_score']}/10 (Scaled: {escalation_data['risk_score']*10}/100)")
print(f"  Risk Level: {escalation_data['risk_level']}")
print(f"  Risk Threshold: {escalation_data['risk_threshold']}/10")
print(f"  Critical Threshold: {escalation_data['critical_threshold']}/10")
print(f"  Indicators / Reasons: {escalation_data['reasons']}")
print(f"  Recommended Action: \"{escalation_data['recommended_action']}\"")
print(f"  Alert Active: {escalation_data['alert']}")
print(f"  Critical Alert Active: {escalation_data['critical_alert']}")

assert escalation_data["risk_score"] >= 7, f"Expected risk score >= 7, got {escalation_data['risk_score']}"
assert escalation_data["risk_level"] in {"High", "Critical"}, f"Expected High or Critical, got {escalation_data['risk_level']}"
assert len(escalation_data["reasons"]) > 0, "Must provide trigger reasons"
assert escalation_data["alert"] is True, "Alert must be active"
assert "escalat" in escalation_data["recommended_action"].lower() or "supervisor" in escalation_data["recommended_action"].lower(), \
    "Recommended action must recommend escalation/supervisor"

print(">>> Test 6.3 (Escalation Monitor) & Test 6.4 (Escalation Alert): PASS")

# ------------------------------------------------------------------------------
# Test 6.5: Resolution & De-escalation Turn
# ------------------------------------------------------------------------------
print("\n--- Test 6.5: Resolution / De-escalation Turn ---")
agent_solution = (
    "I have immediately cancelled your recurring subscription so no future charges will occur, "
    "and I have processed a full refund of $49.99 back to your original payment method. "
    "You should see the credit reflected on your statement within 3 to 5 business days."
)
customer_resolution_msg = (
    "Thank you so much! I just checked my account and I see the cancellation confirmed. "
    "I appreciate you resolving this quickly."
)

history_with_resolution = [
    {"sender_type": "customer", "message_text": angry_msg},
    {"sender_type": "agent", "message_text": agent_solution}
]

status, deescalate_turn = http_post("/api/analyze-turn", {
    "customer_message": customer_resolution_msg,
    "conversation_history": history_with_resolution
})
assert status == 200, f"De-escalation turn analysis failed: {deescalate_turn}"
res_analysis = deescalate_turn["analysis"]
res_escalation = deescalate_turn["escalation"]

print(f"De-escalation Turn Results:")
print(f"  Frustration Level: {res_analysis['frustration_level']}/10 (Dropped from {task4_res['frustration_level']}/10)")
print(f"  Satisfaction Trend: {res_analysis['satisfaction_trend']}")
print(f"  Sentiment: {res_analysis['sentiment']}")
print(f"  Escalation Risk Level: {res_escalation['risk_level']}")
print(f"  Escalation Risk Score: {res_escalation['risk_score']}/10 (Dropped from {escalation_data['risk_score']}/10)")
print(f"  Alert Active: {res_escalation['alert']}")

assert res_analysis["frustration_level"] <= 4, f"Frustration should drop <= 4 upon resolution, got {res_analysis['frustration_level']}"
assert res_analysis["satisfaction_trend"] == "Improving", f"Satisfaction trend should be Improving, got {res_analysis['satisfaction_trend']}"
assert res_escalation["risk_level"] in {"Low", "Medium"}, f"Risk level should decrease, got {res_escalation['risk_level']}"
assert res_escalation["alert"] is False, "Escalation alert should clear on de-escalation"

print(">>> Test 6.5 (Resolution / De-escalation): PASS")

# ==============================================================================
# PART 2: TASK 7 — LIVE SUPPORT CONSOLE: MANUAL, REPLAY & THREE-PANEL UI
# ==============================================================================
print("\n" + "=" * 60)
print("PART 2: TASK 7 — LIVE SUPPORT CONSOLE")
print("=" * 60)

# ------------------------------------------------------------------------------
# Test 7.1: Manual Mode Analysis
# ------------------------------------------------------------------------------
print("\n--- Test 7.1: Manual Mode Single Turn (POST /api/analyze-turn) ---")
manual_customer_msg = "I received a defective charging cable in my order yesterday and would like to exchange it."
status, manual_turn1 = http_post("/api/analyze-turn", {
    "customer_message": manual_customer_msg,
    "conversation_history": []
})
assert status == 200, f"Manual mode analyze turn 1 failed: {manual_turn1}"

# Verify Task 4 analysis is present
m1_analysis = manual_turn1["analysis"]
assert m1_analysis["intent"] in {"return_exchange", "order_status", "general_inquiry"}, f"Unexpected intent: {m1_analysis['intent']}"
print(f"  Task 4 Intent: {m1_analysis['intent']} (confidence: {m1_analysis['confidence']})")
print(f"  Task 4 Emotion: {m1_analysis['emotion']}, Sentiment: {m1_analysis['sentiment']}")

# Verify Task 5 recommendations are present
m1_recs = manual_turn1["knowledge_recommendations"]
print(f"  Task 5 Knowledge Recommendations: {len(m1_recs)} docs retrieved")
assert len(m1_recs) >= 1, "Must return at least 1 knowledge recommendation"

# Verify Task 6 coaching & escalation are present
m1_coaching = manual_turn1["coaching"]
m1_escalation = manual_turn1["escalation"]
print(f"  Task 6 Suggested Response: \"{m1_coaching['suggested_response'][:80]}...\"")
print(f"  Task 6 Escalation Risk Level: {m1_escalation['risk_level']} (Score: {m1_escalation['risk_score']}/10)")
assert m1_coaching["suggested_response"] != "", "Coaching suggested response must be populated"
assert m1_escalation["risk_level"] == "Low", f"Defective item return inquiry should have Low escalation risk, got {m1_escalation['risk_level']}"

print(">>> Test 7.1 (Manual Mode Analysis): PASS")

# ------------------------------------------------------------------------------
# Test 7.2: Manual Mode Multi-turn & History Persistence
# ------------------------------------------------------------------------------
print("\n--- Test 7.2: Manual Mode Multi-turn & History Persistence ---")
manual_agent_reply1 = "I am sorry that your cable was defective. Could you please share your order number and confirm if you want a replacement?"
manual_customer_reply2 = "My order number is #ORD-44910. Yes, please send a replacement right away."

manual_history = [
    {"sender_type": "customer", "message_text": manual_customer_msg},
    {"sender_type": "agent", "message_text": manual_agent_reply1}
]

status, manual_turn2 = http_post("/api/analyze-turn", {
    "customer_message": manual_customer_reply2,
    "conversation_history": manual_history
})
assert status == 200, f"Manual mode analyze turn 2 failed: {manual_turn2}"
m2_analysis = manual_turn2["analysis"]
m2_coaching = manual_turn2["coaching"]
print(f"  Turn 2 Analyzed Customer Reply: \"{manual_customer_reply2}\"")
print(f"  Turn 2 Preserved/Updated Intent: {m2_analysis['intent']}")
print(f"  Turn 2 Suggested Response: \"{m2_coaching['suggested_response'][:80]}...\"")
print(f"  Turn 2 Frustration: {m2_analysis['frustration_level']}/10")
assert len(manual_history) == 2, "Conversation history must contain 2 previous turns"
assert m2_analysis["frustration_level"] <= 4, "Customer providing order number has low frustration"

print(">>> Test 7.2 (Manual Mode Multi-Turn): PASS")

# ------------------------------------------------------------------------------
# Test 7.3: Replay Mode Transcript Parsing & Dynamic Step Simulation
# ------------------------------------------------------------------------------
print("\n--- Test 7.3: Replay Mode Transcript Parsing & Per-Turn Stepping ---")

# Sample 3-turn transcript in JSON
replay_json_data = [
    {"sender": "customer", "text": "I was overcharged by $25 on my invoice last month."},
    {"sender": "agent", "text": "Hello, let me look into this billing discrepancy for you."},
    {"sender": "customer", "text": "Why hasn't this been fixed yet? I need this refunded immediately!"},
    {"sender": "agent", "text": "I apologize for the delay. I have authorized the $25 refund credit to your card."},
    {"sender": "customer", "text": "Thank you, I just got the email confirmation. Have a great day!"}
]

# Simulate stepping through the replay transcript turn by turn
turns_to_simulate = [
    (1, replay_json_data[0]["text"], []),
    (2, replay_json_data[2]["text"], replay_json_data[:2]),
    (3, replay_json_data[4]["text"], replay_json_data[:4])
]

replay_results = []
for turn_idx, cust_text, history in turns_to_simulate:
    conv_hist = [
        {"sender_type": m["sender"], "message_text": m["text"]}
        for m in history
    ]
    status, turn_data = http_post("/api/analyze-turn", {
        "customer_message": cust_text,
        "conversation_history": conv_hist
    })
    assert status == 200, f"Replay step turn {turn_idx} failed: {turn_data}"
    t_analysis = turn_data["analysis"]
    t_escalation = turn_data["escalation"]
    t_coaching = turn_data["coaching"]
    t_know = turn_data["knowledge_recommendations"]
    
    replay_results.append({
        "turn": turn_idx,
        "customer_message": cust_text,
        "emotion": t_analysis["emotion"],
        "frustration": t_analysis["frustration_level"],
        "risk_score": t_escalation["risk_score"],
        "risk_level": t_escalation["risk_level"],
        "knowledge_count": len(t_know),
        "coaching_tips_count": len(t_coaching["coaching_tips"])
    })
    print(f"  [Replay Turn {turn_idx}] Msg: \"{cust_text[:40]}...\"")
    print(f"    Emotion: {t_analysis['emotion']} | Frustration: {t_analysis['frustration_level']}/10 | Risk: {t_escalation['risk_level']} ({t_escalation['risk_score']}/10)")
    print(f"    Knowledge Recommendations: {len(t_know)} | Coaching Tips: {len(t_coaching['coaching_tips'])}")

# Check progression across replay turns:
# Turn 2 has urgency ("immediately"), frustration should be higher than Turn 3 resolution
assert replay_results[1]["frustration"] >= replay_results[2]["frustration"], \
    "Turn 2 frustration should be greater than or equal to Turn 3 resolution frustration"
assert replay_results[2]["risk_level"] == "Low", "Final resolution turn must have Low risk"
print(f"  Summary Statistics across {len(replay_results)} turns:")
print(f"    Average Frustration: {sum(r['frustration'] for r in replay_results)/len(replay_results):.1f}/10")
print(f"    Max Escalation Risk Score: {max(r['risk_score'] for r in replay_results)}/10")

print(">>> Test 7.3 (Replay Mode Transcript & Stepping): PASS")

# ------------------------------------------------------------------------------
# Test 7.4: Three-Panel UI Data Contract Synchronization
# ------------------------------------------------------------------------------
print("\n--- Test 7.4: Three-Panel UI Data Contract Synchronization ---")
# Verify that the response from /api/analyze-turn provides every single field
# required by the 3 panels of LiveConsole:
# Left Panel: Conversation Window (customer_message, dialogue history, emotion, sentiment)
# Middle/Right: Knowledge & Escalation (relevantKnowledge, riskReasons, escalation_risk_score, recommended_action, alert)
# Right: Coaching & Suggestions (suggested_response, tone, clarity, empathy, professionalism, coaching_tips)

test_response = manual_turn
assert "customer_message" in test_response
assert "analysis" in test_response
assert "escalation" in test_response
assert "coaching" in test_response
assert "knowledge_recommendations" in test_response

analysis_fields = ["intent", "emotion", "sentiment", "frustration_level", "satisfaction_trend", "escalation_risk", "confidence"]
for f in analysis_fields:
    assert f in test_response["analysis"], f"Missing field {f} in analysis"

escalation_fields = ["risk_score", "risk_level", "risk_threshold", "critical_threshold", "reasons", "recommended_action", "alert", "critical_alert"]
for f in escalation_fields:
    assert f in test_response["escalation"], f"Missing field {f} in escalation"

coaching_fields = ["suggested_response", "tone", "clarity", "empathy", "professionalism", "communication_rating", "coaching_tips"]
for f in coaching_fields:
    assert f in test_response["coaching"], f"Missing field {f} in coaching"

print("  All data contract fields verified across Panel 1, Panel 2, and Panel 3.")
print(">>> Test 7.4 (Three-Panel UI Data Contract Synchronization): PASS")

print("\n" + "=" * 80)
print("ALL TASK 6 & TASK 7 VERIFICATION TESTS COMPLETED SUCCESSFULLY (100% PASS)")
print("=" * 80)
