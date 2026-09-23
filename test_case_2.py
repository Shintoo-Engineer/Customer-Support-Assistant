import json
import urllib.request

BASE_URL = 'http://127.0.0.1:8000'

def post_json(path, data):
    req = urllib.request.Request(
        f'{BASE_URL}{path}',
        data=json.dumps(data).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

def get_json(path):
    req = urllib.request.Request(f'{BASE_URL}{path}')
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode('utf-8'))

print("=== TEST CASE 2: NEGATIVE PROGRESSION ===")
start_res = post_json('/simulator/start', {
    "session_label": "Negative Escalation Test",
    "persona": "frustrated",
    "scenario": "delayed_order",
    "initial_emotion": "frustrated",
    "issue_severity": 4,
    "patience_level": 2,
    "expected_resolution": "Expedite replacement delivery"
})

session_id = start_res['session_id']
print(f"Turn 1 Customer Message: {start_res.get('customer_message')}")
print(f"Turn 1 Task 4 Analysis: {json.dumps(start_res.get('analysis'), indent=2)}")

ds_t1 = get_json(f'/analysis/{session_id}/decision-support')
print(f"Turn 1 Task 6 Score: {ds_t1['escalation_monitor']['risk_score']}, Risk Level: {ds_t1['escalation_monitor']['risk_level']}")

print("\n--- TURN 2: DISMISSIVE / RUDE AGENT RESPONSE ---")
rude_agent_msg = "We don't see any error on our end. You just have to wait, there is nothing we can do."
turn2_res = post_json('/support/turn', {
    "session_id": session_id,
    "agent_response": rude_agent_msg
})

print(f"Turn 2 Customer Message: {turn2_res.get('customer_message')}")
print(f"Turn 2 Task 4 Analysis: {json.dumps(turn2_res.get('analysis'), indent=2)}")

ds_t2 = get_json(f'/analysis/{session_id}/decision-support')
print(f"Turn 2 Task 6 Score: {ds_t2['escalation_monitor']['risk_score']}, Risk Level: {ds_t2['escalation_monitor']['risk_level']}")
print(f"Turn 2 Task 6 Recommended Action: {ds_t2.get('recommended_action')}")
print(f"Turn 2 Task 6 Alert Active: {ds_t2.get('escalation_alert', {}).get('active')}")
print(f"Turn 2 Task 6 Suggested Response: {ds_t2.get('suggested_response')}")
