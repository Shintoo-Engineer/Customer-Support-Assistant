"""
Task 5 Phase 3 Multi-turn Demonstration Script
Runs a 3-turn customer support conversation through Task 3 -> Task 4 -> Task 5
using the real RAG knowledge base.
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models.database import SessionLocal
from app.services.conversation_orchestration_service import (
    start_orchestrated_session,
    process_support_turn
)

def run_demo():
    db = SessionLocal()
    try:
        print("=" * 80)
        print("TASK 5 PHASE 3: REAL MULTI-TURN CONVERSATION DEMONSTRATION")
        print("=" * 80)

        # 1. Start session (Turn 1)
        print("\n--- TURN 1: Starting Session (Order Delay Inquiry) ---")
        turn1 = start_orchestrated_session(
            session_label="Phase 3 Multi-Turn Real RAG Demo",
            persona="calm",
            scenario="delayed_order",
            initial_emotion="neutral",
            issue_severity=2,
            patience_level=4,
            expected_resolution="Track order status and estimated delivery time",
            db=db
        )
        session_id = turn1["session_id"]
        print(f"Session ID: {session_id}, Conversation ID: {turn1['conversation_id']}")
        print(f"Customer Turn 1 Message:\n  \"{turn1['customer_message']}\"")
        analysis1 = turn1.get("analysis")
        if analysis1:
            print(f"Task 4 Analysis:\n  Intent: {analysis1.get('intent')}, Emotion: {analysis1.get('emotion')}, Frustration: {analysis1.get('frustration_level')}/10")
        print(f"Task 5 Recommendations (Total: {len(turn1.get('recommendations', []))}):")
        for i, rec in enumerate(turn1.get("recommendations", [])[:3], 1):
            print(f"  [{i}] Source: {rec.get('source_doc')} (Score: {rec.get('relevance_score', 0):.4f}, Category: {rec.get('category')})")
            print(f"      Text: {rec.get('recommended_text', '')[:120]}...")

        # 2. Agent responds, triggering Customer Turn 2
        print("\n--- TURN 2: Support Agent Responds -> Customer Turn 2 ---")
        agent_resp_1 = "I understand your order is delayed. Could you please provide your order ID or tracking number so I can check its current delivery status?"
        print(f"Support Agent Response:\n  \"{agent_resp_1}\"")
        
        turn2 = process_support_turn(
            session_id=session_id,
            agent_response=agent_resp_1,
            db=db
        )
        print(f"Customer Turn 2 Message:\n  \"{turn2['customer_message']}\"")
        analysis2 = turn2.get("analysis")
        if analysis2:
            print(f"Task 4 Analysis:\n  Intent: {analysis2.get('intent')}, Emotion: {analysis2.get('emotion')}, Frustration: {analysis2.get('frustration_level')}/10")
        print(f"Task 5 Recommendations (Total: {len(turn2.get('recommendations', []))}):")
        for i, rec in enumerate(turn2.get("recommendations", [])[:3], 1):
            print(f"  [{i}] Source: {rec.get('source_doc')} (Score: {rec.get('relevance_score', 0):.4f}, Category: {rec.get('category')})")
            print(f"      Text: {rec.get('recommended_text', '')[:120]}...")

        # 3. Agent responds, triggering Customer Turn 3 (Topic shift to refund)
        print("\n--- TURN 3: Support Agent Responds -> Customer Turn 3 ---")
        agent_resp_2 = "Thank you. The package appears to be held at the sorting facility. It will take another 3 business days to reach your address."
        print(f"Support Agent Response:\n  \"{agent_resp_2}\"")
        
        turn3 = process_support_turn(
            session_id=session_id,
            agent_response=agent_resp_2,
            db=db
        )
        print(f"Customer Turn 3 Message:\n  \"{turn3['customer_message']}\"")
        analysis3 = turn3.get("analysis")
        if analysis3:
            print(f"Task 4 Analysis:\n  Intent: {analysis3.get('intent')}, Emotion: {analysis3.get('emotion')}, Frustration: {analysis3.get('frustration_level')}/10")
        print(f"Task 5 Recommendations (Total: {len(turn3.get('recommendations', []))}):")
        for i, rec in enumerate(turn3.get("recommendations", [])[:3], 1):
            print(f"  [{i}] Source: {rec.get('source_doc')} (Score: {rec.get('relevance_score', 0):.4f}, Category: {rec.get('category')})")
            print(f"      Text: {rec.get('recommended_text', '')[:120]}...")

        print("\n" + "=" * 80)
        print("DEMO COMPLETE - MULTI-TURN FLOW VERIFIED")
        print("=" * 80)
    finally:
        db.close()

if __name__ == "__main__":
    run_demo()
