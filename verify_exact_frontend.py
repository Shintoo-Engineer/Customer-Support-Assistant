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

print("==================== TEST CASE 1 (POSITIVE) ====================")
tc1_start = post_json('/simulator/start', {
    "session_label": "Positive Resolution Test",
    "persona": "confused",
    "scenario": "payment_failure",
    "initial_emotion": "confused",
    "issue_severity": 3,
    "patience_level": 4,
    "expected_resolution": "Process refund"
})
s1_id = tc1_start['session_id']
print(f"Turn 1 Customer Msg: {tc1_start.get('customer_message')}")
print(f"Turn 1 Patience State: {tc1_start.get('state', {}).get('patience')}/100")
ds1_t1 = get_json(f'/analysis/{s1_id}/decision-support')
print(f"Turn 1 Suggested Response: {ds1_t1.get('suggested_response')}")

tc1_t2 = post_json('/support/turn', {
    "session_id": s1_id,
    "agent_response": "I am very sorry for the confusion! I have reviewed your account, cancelled the duplicate transaction, and processed a full refund of .99 back to your original payment method. You will see it in 1-2 business days."
})
print(f"\nTurn 2 Customer Msg: {tc1_t2.get('customer_message')}")
print(f"Turn 2 Patience State: {tc1_t2.get('state', {}).get('patience')}/100")
ds1_t2 = get_json(f'/analysis/{s1_id}/decision-support')
print(f"Turn 2 Suggested Response: {ds1_t2.get('suggested_response')}")

print("\n==================== TEST CASE 2 (NEGATIVE) ====================")
tc2_start = post_json('/simulator/start', {
    "session_label": "Negative Escalation Test",
    "persona": "frustrated",
    "scenario": "delayed_order",
    "initial_emotion": "frustrated",
    "issue_severity": 4,
    "patience_level": 2,
    "expected_resolution": "Expedite replacement delivery"
})
s2_id = tc2_start['session_id']
print(f"Turn 1 Customer Msg: {tc2_start.get('customer_message')}")
print(f"Turn 1 Patience State: {tc2_start.get('state', {}).get('patience')}/100")
ds2_t1 = get_json(f'/analysis/{s2_id}/decision-support')
print(f"Turn 1 Suggested Response: {ds2_t1.get('suggested_response')}")

tc2_t2 = post_json('/support/turn', {
    "session_id": s2_id,
    "agent_response": "We don't see any error on our end. You just have to wait, there is nothing we can do."
})
print(f"\nTurn 2 Customer Msg: {tc2_t2.get('customer_message')}")
print(f"Turn 2 Patience State: {tc2_t2.get('state', {}).get('patience')}/100")
ds2_t2 = get_json(f'/analysis/{s2_id}/decision-support')
print(f"Turn 2 Suggested Response: {ds2_t2.get('suggested_response')}")
