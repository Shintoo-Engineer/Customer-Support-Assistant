"""
Complete E2E QA Test Runner for Task 2 + Task 3
Hits every endpoint, records results, and prints a live test log.
"""
import json
import time
import requests

BASE = "http://127.0.0.1:8000"
RESULTS = []
PASS = 0
FAIL = 0

def test(test_id, name, method, url, **kwargs):
    global PASS, FAIL
    print(f"\n{'='*70}")
    print(f"TC-{test_id:03d}: {name}")
    print(f"  {method} {url}")
    try:
        if method == "GET":
            r = requests.get(url, timeout=15)
        elif method == "POST":
            if "files" in kwargs:
                r = requests.post(url, files=kwargs["files"], data=kwargs.get("data", {}), timeout=30)
            else:
                r = requests.post(url, json=kwargs.get("json"), timeout=15)
        status = r.status_code
        try:
            body = r.json()
        except Exception:
            body = r.text
        
        expected = kwargs.get("expected_status", 200)
        passed = status == expected
        
        if passed:
            PASS += 1
            verdict = "PASS"
        else:
            FAIL += 1
            verdict = "FAIL"
        
        print(f"  Status: {status} (expected {expected}) -> {verdict}")
        print(f"  Response: {json.dumps(body, indent=2) if isinstance(body, dict) else str(body)[:300]}")
        
        RESULTS.append({
            "id": f"TC-{test_id:03d}",
            "name": name,
            "method": method,
            "url": url,
            "status": status,
            "expected": expected,
            "verdict": verdict,
            "response_summary": str(body)[:200] if body else ""
        })
        return body, status
    except Exception as e:
        FAIL += 1
        print(f"  ERROR: {e}")
        RESULTS.append({
            "id": f"TC-{test_id:03d}",
            "name": name,
            "method": method,
            "url": url,
            "status": "ERROR",
            "expected": kwargs.get("expected_status", 200),
            "verdict": "FAIL",
            "response_summary": str(e)[:200]
        })
        return None, None

print("=" * 70)
print("   AI COACHING AGENT - COMPLETE E2E QA TEST RUN")
print("   Server: http://localhost:8000")
print("   Swagger UI: http://localhost:8000/docs")
print("=" * 70)

# ===================================================================
# SECTION A: ROOT & SWAGGER
# ===================================================================
print("\n" + "#" * 70)
print("# SECTION A: Server Health & Swagger UI")
print("#" * 70)

test(1, "Root endpoint returns welcome message", "GET", f"{BASE}/")
test(2, "Swagger OpenAPI schema loads", "GET", f"{BASE}/openapi.json")

# ===================================================================
# SECTION B: TASK 2 - DOCUMENT UPLOAD & VERSIONING
# ===================================================================
print("\n" + "#" * 70)
print("# SECTION B: Task 2 - Document Upload & Versioning")
print("#" * 70)

# Upload refund_policy_v1 as admin (policy type)
with open("data/documents/refund_policy_v1.pdf", "rb") as f:
    test(3, "Upload refund_policy_v1.pdf (admin, policy)", "POST",
         f"{BASE}/documents/upload",
         files={"file": ("refund_policy_v1.pdf", f, "application/pdf")},
         data={"document_name": "QA Test Refund Policy", "document_type": "policy", "role": "admin"})

# Upload v2 (should auto-increment version, archive v1)
with open("data/documents/refund_policy_v2.pdf", "rb") as f:
    test(4, "Upload refund_policy_v2.pdf (version auto-increment)", "POST",
         f"{BASE}/documents/upload",
         files={"file": ("refund_policy_v2.pdf", f, "application/pdf")},
         data={"document_name": "QA Test Refund Policy", "document_type": "policy", "role": "admin"})

# Upload FAQ as support_agent (faq type - should work)
with open("data/documents/constumer_support_faq_v1.pdf", "rb") as f:
    test(5, "Upload FAQ as support_agent (faq type)", "POST",
         f"{BASE}/documents/upload",
         files={"file": ("faq.pdf", f, "application/pdf")},
         data={"document_name": "QA FAQ Document", "document_type": "faq", "role": "support_agent"})

# RBAC: support_agent trying to upload policy -> 403
with open("data/documents/refund_policy_v1.pdf", "rb") as f:
    test(6, "RBAC: support_agent cannot upload policy (expect 403)", "POST",
         f"{BASE}/documents/upload",
         files={"file": ("refund_policy_v1.pdf", f, "application/pdf")},
         data={"document_name": "Blocked Policy", "document_type": "policy", "role": "support_agent"},
         expected_status=403)

# Invalid file type
test(7, "Reject non-PDF upload (expect 400)", "POST",
     f"{BASE}/documents/upload",
     files={"file": ("test.txt", b"hello", "text/plain")},
     data={"document_name": "Bad File", "document_type": "faq", "role": "admin"},
     expected_status=400)

# Invalid document type
with open("data/documents/refund_policy_v1.pdf", "rb") as f:
    test(8, "Reject invalid document_type (expect 400)", "POST",
         f"{BASE}/documents/upload",
         files={"file": ("refund_policy_v1.pdf", f, "application/pdf")},
         data={"document_name": "Bad Type", "document_type": "newsletter", "role": "admin"},
         expected_status=400)

# Version history check
body, _ = test(9, "Version history shows correct versioning", "GET",
     f"{BASE}/documents/history/QA Test Refund Policy")
if body:
    versions = body.get("versions", [])
    v_map = {v["version"]: v["status"] for v in versions}
    max_v = max(v_map.keys()) if v_map else 0
    assert v_map.get(max_v) == "active", f"Highest version {max_v} not active!"
    for v_num, st in v_map.items():
        if v_num < max_v:
            assert st == "archived", f"Version {v_num} should be archived, is {st}"
    print(f"  -> Versioning VERIFIED: v{max_v}=active, lower=archived")

# List all documents
test(10, "GET /documents/ lists all uploaded docs", "GET", f"{BASE}/documents/")

# ===================================================================
# SECTION C: TASK 2 - SEMANTIC SEARCH
# ===================================================================
print("\n" + "#" * 70)
print("# SECTION C: Task 2 - Semantic Search")
print("#" * 70)

test(11, "Search: refund policy query", "POST", f"{BASE}/search/",
     json={"query": "How many days do I have to request a refund?", "number_of_results": 3})

test(12, "Search: empty query (expect 400)", "POST", f"{BASE}/search/",
     json={"query": "   ", "number_of_results": 1},
     expected_status=400)

# ===================================================================
# SECTION D: TASK 2 - RAG
# ===================================================================
print("\n" + "#" * 70)
print("# SECTION D: Task 2 - RAG (Retrieval-Augmented Generation)")
print("#" * 70)

body, status = test(13, "RAG: ask about refund policy", "POST", f"{BASE}/rag/ask",
     json={"question": "What is the refund window for digital products?", "number_of_results": 3})
# Note: 500 expected if no real GEMINI_API_KEY - pipeline still runs correctly up to LLM call

test(14, "RAG: empty question (expect 400)", "POST", f"{BASE}/rag/ask",
     json={"question": "   "},
     expected_status=400)

# ===================================================================
# SECTION E: TASK 2 - CHAT
# ===================================================================
print("\n" + "#" * 70)
print("# SECTION E: Task 2 - Chat with History")
print("#" * 70)

test(15, "Chat: send message to new session", "POST", f"{BASE}/chat/message",
     json={"session_id": "qa_test_session", "message": "What is your refund policy?", "number_of_results": 2})

test(16, "Chat: retrieve session history", "GET",
     f"{BASE}/chat/qa_test_session/history")

# ===================================================================
# SECTION F: TASK 2 - LIVE SUPPORT
# ===================================================================
print("\n" + "#" * 70)
print("# SECTION F: Task 2 - Live Support")
print("#" * 70)

test(17, "Support: technical issue", "POST", f"{BASE}/support/",
     json={"issue_type": "Technical Issue", "message": "App keeps crashing on document upload"})

test(18, "Support: document upload issue", "POST", f"{BASE}/support/",
     json={"issue_type": "Document Upload", "message": "PDF fails to process"})

test(19, "Support: coaching help", "POST", f"{BASE}/support/",
     json={"issue_type": "Coaching Help", "message": "How do I improve my customer handling?"})

test(20, "Support: unknown issue type", "POST", f"{BASE}/support/",
     json={"issue_type": "Billing", "message": "I was overcharged"})

# ===================================================================
# SECTION G: TASK 3 - SIMULATOR START
# ===================================================================
print("\n" + "#" * 70)
print("# SECTION G: Task 3 - Customer Simulator Start")
print("#" * 70)

body, _ = test(21, "Simulator: start angry/refund session", "POST", f"{BASE}/simulator/start",
     json={"session_label": "QA Angry Refund", "persona": "angry", "scenario": "refund",
           "initial_emotion": "angry", "issue_severity": 4, "patience_level": 2,
           "expected_resolution": "Full refund processed"})
angry_sid = body.get("session_id") if body else None

body, _ = test(22, "Simulator: start polite/delayed_order session", "POST", f"{BASE}/simulator/start",
     json={"session_label": "QA Polite Delayed", "persona": "polite", "scenario": "delayed_order",
           "initial_emotion": "calm", "issue_severity": 2, "patience_level": 5,
           "expected_resolution": "Tracking update"})
polite_sid = body.get("session_id") if body else None

test(23, "Simulator: invalid persona (expect 400)", "POST", f"{BASE}/simulator/start",
     json={"session_label": "Bad", "persona": "excited", "scenario": "refund",
           "initial_emotion": "excited", "issue_severity": 3, "patience_level": 3,
           "expected_resolution": "N/A"},
     expected_status=400)

test(24, "Simulator: invalid scenario (expect 400)", "POST", f"{BASE}/simulator/start",
     json={"session_label": "Bad", "persona": "angry", "scenario": "shipping_damage",
           "initial_emotion": "angry", "issue_severity": 3, "patience_level": 3,
           "expected_resolution": "N/A"},
     expected_status=400)

# ===================================================================
# SECTION H: TASK 3 - SIMULATOR MESSAGE TURNS
# ===================================================================
print("\n" + "#" * 70)
print("# SECTION H: Task 3 - Simulator Message Turns")
print("#" * 70)

if angry_sid:
    body, _ = test(25, "Simulator: empathetic agent response (angry session)", "POST",
         f"{BASE}/simulator/message",
         json={"session_id": angry_sid,
               "agent_response": "I sincerely apologize for the trouble. I understand your frustration and I am processing your refund right away."})
    if body:
        print(f"  -> Customer reply: {body.get('customer_message', '')[:80]}...")
        print(f"  -> State: {body.get('state')}")

    body, _ = test(26, "Simulator: dismissive agent response (angry session)", "POST",
         f"{BASE}/simulator/message",
         json={"session_id": angry_sid,
               "agent_response": "Can't help you with that. Policy doesn't allow it."})
    if body:
        print(f"  -> Customer reply: {body.get('customer_message', '')[:80]}...")
        print(f"  -> State: {body.get('state')}")

if polite_sid:
    body, _ = test(27, "Simulator: helpful agent response (polite session)", "POST",
         f"{BASE}/simulator/message",
         json={"session_id": polite_sid,
               "agent_response": "I understand how important this is. Let me track your order right away and I will resolve this for you."})
    if body:
        print(f"  -> Customer reply: {body.get('customer_message', '')[:80]}...")
        print(f"  -> State: {body.get('state')}")

test(28, "Simulator: nonexistent session (expect 404)", "POST",
     f"{BASE}/simulator/message",
     json={"session_id": 999999, "agent_response": "Hello"},
     expected_status=404)

# ===================================================================
# SECTION I: TASK 3 - SIMULATOR HISTORY
# ===================================================================
print("\n" + "#" * 70)
print("# SECTION I: Task 3 - Simulator History")
print("#" * 70)

if angry_sid:
    body, _ = test(29, "Simulator: get history (excludes System messages)", "GET",
         f"{BASE}/simulator/{angry_sid}/history")
    if body:
        msgs = body.get("messages", [])
        system_count = sum(1 for m in msgs if m.get("message_type") == "System")
        print(f"  -> Total dialogue messages: {len(msgs)}, System messages: {system_count}")
        assert system_count == 0, "System messages should be excluded from history!"

test(30, "Simulator: history for nonexistent session (expect 404)", "GET",
     f"{BASE}/simulator/999999/history",
     expected_status=404)

# ===================================================================
# SUMMARY
# ===================================================================
print("\n\n" + "=" * 70)
print(f"   QA TEST RUN COMPLETE")
print(f"   Total: {PASS + FAIL} | Passed: {PASS} | Failed: {FAIL}")
print("=" * 70)

# Save results to JSON for report generation
with open("qa_test_results.json", "w") as f:
    json.dump({"total": PASS + FAIL, "passed": PASS, "failed": FAIL, "results": RESULTS}, f, indent=2)
print(f"\nResults saved to qa_test_results.json")
