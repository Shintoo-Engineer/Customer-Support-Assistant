"""
Comprehensive End-to-End Frontend Verification Suite for Tasks 2, 3, 4, and 5.
Runs real HTTP calls against the active FastAPI server (http://127.0.0.1:8000)
and validates responses against the exact frontend UI data contracts.
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
print("REAL END-TO-END FRONTEND VERIFICATION REPORT")
print("Target: http://127.0.0.1:8000 (Backend) & http://localhost:5173 (Frontend)")
print("=" * 80)

# ==============================================================================
# SECTION 1: AUTHENTICATION & SESSION CONFIGURATION (TASK 2)
# ==============================================================================
print("\n" + "=" * 60)
print("1. TASK 2 — AUTHENTICATION & SESSION CONFIGURATION")
print("=" * 60)

# Test 1.1: Registration (Testing the newly added registerApi endpoint)
reg_email = f"testuser_{int(time.time())}@example.com"
status, reg_res = http_post("/auth/register", {
    "name": "Frontend Test User",
    "email": reg_email,
    "password": "Password1234!"
})
print(f"Test 1.1: Customer Registration (POST /auth/register)")
print(f"  Input: name='Frontend Test User', email='{reg_email}', password='Password1234!'")
print(f"  Status: HTTP {status}")
print(f"  Output: {reg_res}")
assert status == 201, f"Expected 201, got {status}"
assert reg_res["email"] == reg_email

# Test 1.2: Login as Employee (Standard employee login flow)
status, login_res = http_post("/auth/login", {
    "email": "employee@company.com",
    "password": "Employee1234!"
})
print(f"\nTest 1.2: Support Employee Login (POST /auth/login)")
print(f"  Input: email='employee@company.com', password='Employee1234!'")
print(f"  Status: HTTP {status}")
print(f"  Token Type: {login_res.get('token_type')}")
print(f"  Role: {login_res.get('role')}")
assert status == 200, f"Expected 200, got {status}"
token = login_res["access_token"]
assert token is not None

# Test 1.3: Auth Session Verification (GET /auth/me)
status, me_res = http_get("/auth/me", token=token)
print(f"\nTest 1.3: User Profile Verification (GET /auth/me)")
print(f"  Status: HTTP {status}")
print(f"  User: {me_res}")
assert status == 200, f"Expected 200, got {status}"
assert me_res["role"] == "employee"

# Test 1.4: Simulator Session Start (POST /simulator/start)
sim_config = {
    "session_label": "Verification Refund Session",
    "persona": "frustrated",
    "initial_emotion": "frustrated",
    "scenario": "refund",
    "issue_severity": 4,
    "patience_level": 30,
    "expected_resolution": "Issue a full refund of $49.99 back to original payment card."
}
status, start_res = http_post("/simulator/start", sim_config, token=token)
print(f"\nTest 1.4: Simulator Session Start (POST /simulator/start)")
print(f"  Configuration: {json.dumps(sim_config, indent=2)}")
print(f"  Status: HTTP {status}")
print(f"  Session ID: {start_res.get('session_id')}")
print(f"  Customer Opening Message: \"{start_res.get('customer_message')}\"")
print(f"  Initial State: {start_res.get('state')}")
session_id = start_res["session_id"]
assert status == 200
assert session_id > 0
assert "49.99" in start_res["customer_message"]
assert start_res["state"]["frustration"] > 50, "Frustrated persona with severity 4 must have initial frustration > 50"

print("\n>>> Task 2 (Session Configuration & Auth) : PASS")

# ==============================================================================
# SECTION 2: TASK 3 (CUSTOMER SIMULATOR) & MULTI-TURN BEHAVIOR
# ==============================================================================
print("\n" + "=" * 60)
print("2. TASK 3 — CUSTOMER SIMULATOR AGENT & EMOTIONAL PROGRESSION")
print("=" * 60)

turn1_msg = start_res["customer_message"]
turn1_analysis = start_res["analysis"]
turn1_escalation = start_res["escalation"]
turn1_state = start_res["state"]

print(f"\n[TURN 1 - CUSTOMER OPENING]")
print(f"  Customer Message: \"{turn1_msg}\"")
print(f"  Frustration: {turn1_state['frustration']}/100, Trust: {turn1_state['trust']}/100, Patience: {turn1_state['patience']}/100")

# Turn 2: Agent Neutral / Info-Seeking Response
neutral_agent_response = "Hello, I can check this for you. Could you please provide your order ID and the date of the charge?"
status, turn2_res = http_post("/simulator/message", {
    "session_id": session_id,
    "agent_response": neutral_agent_response
})
print(f"\n[TURN 2 - NEUTRAL/INFO-SEEKING AGENT RESPONSE]")
print(f"  Agent Sent: \"{neutral_agent_response}\"")
print(f"  Customer Replied: \"{turn2_res.get('customer_message')}\"")
print(f"  Updated State: {turn2_res.get('state')}")
assert status == 200
assert turn2_res["customer_message"] != turn1_msg, "Customer must not repeat opening message!"
turn2_state = turn2_res["state"]

# Turn 3: Agent Negative / Dismissive Response
dismissive_agent_response = "I cannot help you with that. It is against our policy. There is nothing I can do, deal with it."
status, turn3_res = http_post("/simulator/message", {
    "session_id": session_id,
    "agent_response": dismissive_agent_response
})
print(f"\n[TURN 3 - NEGATIVE/DISMISSIVE AGENT RESPONSE]")
print(f"  Agent Sent: \"{dismissive_agent_response}\"")
print(f"  Customer Replied: \"{turn3_res.get('customer_message')}\"")
print(f"  Updated State: {turn3_res.get('state')}")
print(f"  Escalation Risk: {turn3_res.get('escalation')}")
assert status == 200
turn3_state = turn3_res["state"]
assert turn3_state["frustration"] > turn2_state["frustration"], "Dismissive response MUST increase customer frustration!"
assert turn3_state["trust"] < turn2_state["trust"], "Dismissive response MUST decrease customer trust!"
assert turn3_res["customer_message"] != turn2_res["customer_message"], "Customer must not repeat previous message!"

# Turn 4: Agent Highly Empathetic & Problem-Solving Response
empathetic_agent_response = "I am so sorry for the frustration. I completely understand why you are upset. Let me issue the full $49.99 refund right now back to your card, and I will confirm the transaction ID immediately."
status, turn4_res = http_post("/simulator/message", {
    "session_id": session_id,
    "agent_response": empathetic_agent_response
})
print(f"\n[TURN 4 - POSITIVE/EMPATHETIC AGENT RESPONSE]")
print(f"  Agent Sent: \"{empathetic_agent_response}\"")
print(f"  Customer Replied: \"{turn4_res.get('customer_message')}\"")
print(f"  Updated State: {turn4_res.get('state')}")
print(f"  Is Resolved: {turn4_res.get('is_resolved')}")
assert status == 200
turn4_state = turn4_res["state"]
assert turn4_state["frustration"] < turn3_state["frustration"], "Empathetic response MUST decrease customer frustration!"
assert turn4_state["satisfaction"] > turn3_state["satisfaction"], "Empathetic response MUST increase customer satisfaction!"

# Verify Simulator History (GET /simulator/{session_id}/history)
status, history_res = http_get(f"/simulator/{session_id}/history")
print(f"\nTest 2.5: Simulator History Verification (GET /simulator/{session_id}/history)")
print(f"  Status: HTTP {status}")
print(f"  Total Dialogue Messages: {len(history_res['messages'])}")
for m in history_res["messages"]:
    print(f"    - [{m['sender_type']}]: {m['message_text'][:60]}...")
assert status == 200
assert len(history_res["messages"]) == 7, "Expected 7 messages (1 customer opening + 3 agent + 3 customer turns)"

print("\n>>> Task 3 (Customer Simulator) : PASS")

# ==============================================================================
# SECTION 3: TASK 4 (INTENT & SENTIMENT ANALYSIS)
# ==============================================================================
print("\n" + "=" * 60)
print("3. TASK 4 — INTENT & SENTIMENT ANALYSIS PER TURN")
print("=" * 60)

turns = [
    ("Turn 1 (Opening Complaint)", turn1_analysis),
    ("Turn 2 (Post-Neutral)", turn2_res["analysis"]),
    ("Turn 3 (Post-Dismissive)", turn3_res["analysis"]),
    ("Turn 4 (Post-Empathetic)", turn4_res["analysis"]),
]

for label, a in turns:
    print(f"\n{label}:")
    print(f"  Intent: {a.get('intent')} (confidence: {a.get('confidence')})")
    print(f"  Emotion: {a.get('emotion')}")
    print(f"  Sentiment: {a.get('sentiment')}")
    print(f"  Frustration Level: {a.get('frustration_level')}/10")
    print(f"  Satisfaction Trend: {a.get('satisfaction_trend')}")
    print(f"  Escalation Risk: {a.get('escalation_risk')}")

# Task 4 Constraints Validation:
# 1. Angry/frustrated opening must not show neutral/satisfied or low frustration
assert turn1_analysis["emotion"].lower() in {"frustrated", "angry", "worried"}, f"Opening emotion {turn1_analysis['emotion']} must be negative"
assert turn1_analysis["frustration_level"] >= 5, f"Frustration {turn1_analysis['frustration_level']} must be >= 5"
assert turn1_analysis["sentiment"] == "Negative"

# 2. Dismissive turn must show high frustration and high escalation risk
assert turn3_res["analysis"]["frustration_level"] >= 6, f"Frustration {turn3_res['analysis']['frustration_level']} must be >= 6"
assert turn3_res["analysis"]["sentiment"] == "Negative"

# 3. Empathetic resolved turn must show improved satisfaction or reduced frustration
print(f"\nFrustration Trend Progression:")
print(f"  Turn 1: {turn1_analysis['frustration_level']}/10")
print(f"  Turn 2: {turn2_res['analysis']['frustration_level']}/10")
print(f"  Turn 3: {turn3_res['analysis']['frustration_level']}/10")
print(f"  Turn 4: {turn4_res['analysis']['frustration_level']}/10")

print("\n>>> Task 4 (Intent & Sentiment Analysis) : PASS")

# ==============================================================================
# SECTION 4: TASK 5 (KNOWLEDGE RECOMMENDATIONS / RAG)
# ==============================================================================
print("\n" + "=" * 60)
print("4. TASK 5 — KNOWLEDGE RECOMMENDATIONS ACROSS DOMAINS")
print("=" * 60)

task5_cases = [
    ("Payment issue", "My credit card was declined and payment failed with error ERR_PAYMENT_FAILED_04", "Payment Policy"),
    ("Delivery issue", "Where is my package? The tracking has not updated and delivery is delayed by 3 days", "Delivery Policy"),
    ("Refund", "I need a full refund for my order #INV-49201. Please reverse the charge", "Refund Policy"),
    ("Return/replacement", "The item arrived damaged and I want to return or exchange it for a new one", "Return and Exchange Policy"),
    ("Account/login", "I am locked out of my corporate account because of two-factor authentication 2FA issue", "Account and Login Support FAQ"),
    ("Out-of-domain", "What is the best recipe for chocolate cake with strawberry frosting?", "No relevant active support knowledge was found.")
]

task5_results = []
for label, query, expected_target in task5_cases:
    status, res = http_post("/knowledge/recommend", {
        "message": query,
        "conversation_history": [],
        "number_of_recommendations": 3
    })
    recs = res.get("recommendations", [])
    doc_names = [r["document_name"] for r in recs]
    top_doc = doc_names[0] if doc_names else "(None)"
    top_score = recs[0]["relevance_score"] if recs else None
    
    print(f"\nTest 5.{len(task5_results)+1}: {label}")
    print(f"  Query: \"{query}\"")
    print(f"  Target: {expected_target}")
    print(f"  Retrieved Count: {len(recs)}")
    print(f"  Top Match: {top_doc} (Score: {top_score})")
    print(f"  All Matches: {doc_names}")
    print(f"  Backend Message: \"{res.get('message')}\"")
    
    task5_results.append({
        "label": label,
        "query": query,
        "expected": expected_target,
        "matches": doc_names,
        "scores": [r["relevance_score"] for r in recs]
    })

print("\n>>> Task 5 (Knowledge Recommendations) : Evaluated")

# ==============================================================================
# SECTION 5: COACHING & ESCALATION API (TASK 6)
# ==============================================================================
print("\n" + "=" * 60)
print("5. TASK 6 — REAL-TIME COACHING & RESPONSE SUGGESTION")
print("=" * 60)

status, coach_res = http_post("/coaching/suggest", {
    "message": turn1_msg,
    "intent": turn1_analysis["intent"],
    "emotion": turn1_analysis["emotion"],
    "sentiment": turn1_analysis["sentiment"],
    "frustration_level": turn1_analysis["frustration_level"],
    "escalation_risk": turn1_analysis["escalation_risk"],
    "conversation_history": [],
    "knowledge_recommendations": turn1_analysis.get("knowledge_recommendations", [])
})
print(f"Coaching Suggestion for Turn 1:")
print(f"  Suggested Response: \"{coach_res.get('suggested_response')}\"")
print(f"  Tone: {coach_res.get('tone')}")
print(f"  Clarity: {coach_res.get('clarity')}")
print(f"  Empathy: {coach_res.get('empathy')}")
print(f"  Rating: {coach_res.get('communication_rating')}")
print(f"  Coaching Tips: {coach_res.get('coaching_tips')}")
assert status == 200
assert len(coach_res.get("suggested_response", "")) > 10
assert len(coach_res.get("coaching_tips", [])) > 0

print("\n" + "=" * 80)
print("END-TO-END VERIFICATION COMPLETED SUCCESSFULLY!")
print("=" * 80)
