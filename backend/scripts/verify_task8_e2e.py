"""
Live End-to-End Verification Script for Task 8:
- Post-Interaction Summary
- Performance Analytics
- Multi-mode support (Simulator, Manual, Replay)
"""

import sys
import json
import requests

BASE_URL = "http://127.0.0.1:8000"


def print_step(title: str):
    print("\n" + "=" * 70)
    print(f"STEP: {title}")
    print("=" * 70)


def test_performance_analytics_endpoint():
    print_step("1. VERIFY PERFORMANCE ANALYTICS API")
    url = f"{BASE_URL}/api/analytics/performance"
    r = requests.get(url, timeout=10)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()

    print(f"Total sessions in database: {data['total_sessions']}")
    print(f"Completed sessions: {data['completed_sessions']}")
    print(f"Total interactions: {data['total_interactions']}")
    print(f"Resolution rate: {data['resolution_rate']}%")
    print(f"Average resolution quality: {data['average_resolution_quality']}/100")
    print(f"Average customer frustration: {data['average_frustration']}/10")
    print(f"Average response quality: {data['average_response_quality']}/100")
    print(f"Escalation frequency: {data['escalation_frequency']}%")
    print(f"Common customer intents: {[i['intent'] for i in data['common_customer_intents'][:3]]}")
    print(f"Common escalation triggers: {[t['trigger'] for t in data['common_escalation_triggers'][:3]]}")
    print(f"Knowledge gap indicators: {len(data['knowledge_gap_indicators'])} topics")
    print(f"Actionable recommendations: {len(data['actionable_recommendations'])} items")

    assert data["total_sessions"] > 0
    assert 0.0 <= data["resolution_rate"] <= 100.0
    assert 0.0 <= data["average_resolution_quality"] <= 100.0
    assert 0.0 <= data["average_frustration"] <= 10.0
    print("[PASS] Performance Analytics calculations and schema verified.")
    return data


def test_simulator_session_to_summary():
    print_step("2. VERIFY SIMULATOR MODE -> COMPLETION -> SUMMARY REPORT")
    # Start simulator session
    start_payload = {
        "session_label": "Task 8 E2E Test Session",
        "persona": "calm",
        "scenario": "refund",
        "initial_emotion": "frustrated",
        "issue_severity": 3,
        "patience_level": 3,
        "expected_resolution": "Process refund for defective product",
    }
    r = requests.post(f"{BASE_URL}/simulator/start", json=start_payload, timeout=15)
    assert r.status_code == 200, f"Simulator start failed: {r.text}"
    start_data = r.json()
    session_id = start_data["session_id"]
    print(f"Created Simulator Session #{session_id}")
    print(f"Opening customer message: {start_data['customer_message']}")

    # Send agent response
    agent_msg = "I sincerely apologize for the broken item. Under our refund policy, you are fully covered within 15 calendar days and I will process this immediately."
    msg_payload = {
        "session_id": session_id,
        "agent_response": agent_msg,
    }
    r2 = requests.post(f"{BASE_URL}/simulator/message", json=msg_payload, timeout=15)
    assert r2.status_code == 200, f"Simulator message failed: {r2.text}"
    msg_data = r2.json()
    print(f"Customer turn 2 response: {msg_data['customer_message']}")
    print(f"Turn 2 frustration: {msg_data['analysis']['frustration_level']}/10")

    # Complete session
    complete_url = f"{BASE_URL}/api/sessions/{session_id}/complete"
    r3 = requests.post(complete_url, json={"resolution_status": "Resolved"}, timeout=15)
    assert r3.status_code == 200, f"Session completion failed: {r3.text}"
    summary = r3.json()

    print(f"Concise summary: {summary['concise_summary']}")
    print(f"Primary issue: {summary['primary_customer_issue']}")
    print(f"Final resolution status: {summary['final_resolution']}")
    print(f"Resolution quality score: {summary['resolution_quality_score']}/100")
    print(f"Communication quality rating: {summary['communication_quality']}")
    print(f"Empathy score: {summary['empathy_score']}/100")
    print(f"Policy adherence score: {summary['policy_adherence_score']}/100")
    print(f"Sentiment journey turns: {len(summary['sentiment_journey'])}")
    print(f"Agent strengths: {summary['agent_strengths']}")
    print(f"Coaching recommendations: {summary['coaching_recommendations']}")

    assert summary["session_id"] == session_id
    assert summary["final_resolution"] == "Resolved"
    assert summary["resolution_quality_score"] >= 75.0
    assert len(summary["sentiment_journey"]) >= 2
    assert len(summary["agent_strengths"]) > 0
    assert len(summary["coaching_recommendations"]) > 0
    print("[PASS] Simulator session completion & post-interaction report verified.")
    return summary


def test_manual_mode_adhoc_summary():
    print_step("3. VERIFY MANUAL MODE ADHOC SUMMARY REPORT")
    payload = {
        "messages": [
            {
                "sender": "customer",
                "text": "My login credentials are not working on the new portal.",
            },
            {
                "sender": "agent",
                "text": "I understand your frustration with the login issue. Let me send a secure password reset link to your registered email address.",
            },
            {
                "sender": "customer",
                "text": "The reset link worked and I am logged in now. Thank you for resolving this so quickly!",
            },
        ],
        "scenario_title": "Manual Support Turn",
        "resolution_status": "Resolved",
    }
    r = requests.post(f"{BASE_URL}/api/sessions/summary", json=payload, timeout=15)
    assert r.status_code == 200, f"Adhoc summary failed: {r.text}"
    data = r.json()

    print(f"Manual mode primary issue: {data['primary_customer_issue']}")
    print(f"Manual mode resolution quality: {data['resolution_quality_score']}/100")
    print(f"Manual mode turns evaluated: {len(data['sentiment_journey'])}")
    print(f"Manual mode strengths: {data['agent_strengths']}")

    assert data["final_resolution"] == "Resolved"
    assert data["resolution_quality_score"] >= 80.0
    assert len(data["sentiment_journey"]) == 2
    print("[PASS] Manual Mode adhoc summary report verified.")


def test_replay_mode_summary():
    print_step("4. VERIFY REPLAY MODE SUMMARY REPORT")
    payload = {
        "messages": [
            {
                "sender": "customer",
                "text": "Where is order #49281? It was supposed to be here last Friday.",
            },
            {
                "sender": "agent",
                "text": "I understand the delay is inconvenient. I am reviewing the logistics carrier notes right now.",
            },
            {
                "sender": "customer",
                "text": "Your tracking link says out for delivery today. Thanks for checking.",
            },
        ],
        "scenario_title": "Replay Transcript #49281",
        "resolution_status": "Resolved",
    }
    r = requests.post(f"{BASE_URL}/api/sessions/summary", json=payload, timeout=15)
    assert r.status_code == 200, f"Replay summary failed: {r.text}"
    data = r.json()

    print(f"Replay mode resolution quality: {data['resolution_quality_score']}/100")
    print(f"Replay mode sentiment journey: {[p['sentiment'] for p in data['sentiment_journey']]}")
    assert data["resolution_quality_score"] >= 80.0
    print("[PASS] Replay Mode summary report verified.")


def main():
    print("\n=======================================================")
    print("STARTING TASK 8 FULL END-TO-END VERIFICATION")
    print("=======================================================")

    test_performance_analytics_endpoint()
    test_simulator_session_to_summary()
    test_manual_mode_adhoc_summary()
    test_replay_mode_summary()

    print("\n=======================================================")
    print("ALL TASK 8 END-TO-END VERIFICATIONS PASSED (100%)")
    print("=======================================================")


if __name__ == "__main__":
    main()
