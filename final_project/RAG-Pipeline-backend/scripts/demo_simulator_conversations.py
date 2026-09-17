"""Standalone runner to execute demo simulator conversations and export session logs.

Demonstrates customer behavior across all 5 scenario types and 5 distinct personas,
generating genuine conversation logs in logs/simulator/ without requiring an HTTP server.
"""

import os
import sys

sys.path.insert(0, os.path.abspath("."))
os.environ.setdefault("GEMINI_API_KEY", "dummy_key_if_not_configured")

from unittest.mock import MagicMock
for mod in ["pypdf", "sentence_transformers", "chromadb"]:
    if mod not in sys.modules:
        try:
            __import__(mod)
        except ImportError:
            sys.modules[mod] = MagicMock()

import json
from datetime import datetime

from app.models.database import SessionLocal
from app.models.simulator import Scenario, Session, Conversation, Message
from app.services.simulator_service import generate_customer_turn
from app.services.simulator_state import initial_state
from app.services.scenario_service import SCENARIOS
from scripts.export_simulator_logs import export_all_completed_sessions


DEMO_CONVERSATIONS = [
    {
        "title": "Demo 1: Angry Customer - Refund (Empathetic De-escalation)",
        "scenario": "refund",
        "persona": "angry",
        "initial_emotion": "angry",
        "issue_severity": 4,
        "patience_level": 2,
        "expected_resolution": "Full refund of $49.99 initiated within 3-5 business days",
        "agent_turns": [
            "I sincerely apologize for the unexpected charge. I completely understand why you're upset, and I can see the duplicate subscription charge in our system right now.",
            "I have authorized an immediate full refund of $49.99 back to your original payment card. You'll receive a confirmation email shortly, and the credit will appear on your statement in 3 to 5 business days.",
            "You are very welcome. I'm truly sorry again for the frustration this caused. Is there anything else I can double-check for you today to make sure everything is sorted?"
        ]
    },
    {
        "title": "Demo 2: Impatient Customer - Delayed Order (Dismissive Escalation)",
        "scenario": "delayed_order",
        "persona": "impatient",
        "initial_emotion": "impatient",
        "issue_severity": 4,
        "patience_level": 1,
        "expected_resolution": "Expedited courier replacement or full refund",
        "agent_turns": [
            "We can't help with shipping delays once the courier has the box. That's against our policy.",
            "Nothing I can do. It's not possible to expedite a package that is already in transit. You will just have to wait.",
            "Call your bank or courier yourself if you're unhappy. There is nothing more I am authorized to do."
        ]
    },
    {
        "title": "Demo 3: Confused Customer - Payment Failure (Guided Resolution)",
        "scenario": "payment_failure",
        "persona": "confused",
        "initial_emotion": "confused",
        "issue_severity": 3,
        "patience_level": 3,
        "expected_resolution": "Gateway 3DS verification explained and payment successfully verified",
        "agent_turns": [
            "Hello! I understand how confusing payment errors can be. Let me look into that ERR_PAYMENT_FAILED_04 code for you right away.",
            "It looks like your bank's 3D-Secure verification timed out during checkout. I have generated a direct secure verification link for you: https://pay.example.com/verify-3ds. Please click it to approve the transaction via your banking app.",
            "I can confirm the payment has successfully gone through on our end! Your Annual Pro Plan is now fully activated. Thank you for your patience while we sorted that out."
        ]
    },
    {
        "title": "Demo 4: Frustrated Customer - Account Lockout (Empathetic Verification)",
        "scenario": "account_issue",
        "persona": "frustrated",
        "initial_emotion": "frustrated",
        "issue_severity": 4,
        "patience_level": 2,
        "expected_resolution": "Backup email verification completed and account access restored",
        "agent_turns": [
            "I'm very sorry for the lockout trouble! I know how frustrating it is to lose access to your account, especially with 2FA complications. Let me help you regain access right away.",
            "To keep your account secure while bypassing the lost 2FA device, I've just sent a secure one-time verification magic link to your registered backup email address. Please check your inbox and click the link.",
            "Great, I see the verification succeeded! I have reset your primary MFA requirement and unlocked your corporate account. You can now log in normally."
        ]
    },
    {
        "title": "Demo 5: Calm Customer - Cancellation (Respectful Offboarding)",
        "scenario": "cancellation",
        "persona": "calm",
        "initial_emotion": "calm",
        "issue_severity": 2,
        "patience_level": 4,
        "expected_resolution": "Subscription cancelled cleanly with confirmation of access until billing period end",
        "agent_turns": [
            "Hello! I understand you would like to cancel your monthly subscription. I'd be happy to assist you with that right away.",
            "I have processed the cancellation of your Monthly Business Plan. Auto-renewal has been turned off, so you will not be charged again. Your access will remain active until the end of the current billing period in 4 days.",
            "You are very welcome! If you ever decide to return, all your workspace settings and data will be saved. Have a wonderful day!"
        ]
    }
]


def run_demo():
    print("=" * 70)
    print("CUSTOMER SIMULATOR - DEMO CONVERSATION RUNNER")
    print("Generating genuine conversation logs across all 5 scenarios & personas")
    print("=" * 70)

    db = SessionLocal()
    completed_session_ids = []

    try:
        for idx, conv in enumerate(DEMO_CONVERSATIONS, 1):
            scenario_key = conv["scenario"]
            persona_key = conv["persona"]
            scenario_data = SCENARIOS[scenario_key]

            print(f"\n[{idx}/5] {conv['title']}")
            print("-" * 70)

            # 1. Create Scenario row
            scenario_row = Scenario(
                title=conv["title"],
                category=scenario_key,
                difficulty="Medium",
                objective=conv["expected_resolution"],
                description=scenario_data.get("opening_complaint"),
                is_active=True
            )
            db.add(scenario_row)
            db.flush()

            # 2. Create Session row
            session_row = Session(
                scenario_id=scenario_row.scenario_id,
                start_time=datetime.utcnow(),
                status="In Progress"
            )
            db.add(session_row)
            db.flush()

            # 3. Create Conversation row
            conversation_row = Conversation(
                session_id=session_row.session_id,
                intent=scenario_key,
                sentiment=conv["initial_emotion"],
                resolution_status="Unresolved",
                escalation_risk="Low",
                created_at=datetime.utcnow()
            )
            db.add(conversation_row)
            db.flush()

            # 4. Build initial state
            current_state = initial_state(
                persona=persona_key,
                initial_emotion=conv["initial_emotion"],
                issue_severity=conv["issue_severity"],
                patience_level=conv["patience_level"]
            )

            # 5. Customer opening message
            opening_message = scenario_data["opening_complaint"]
            customer_msg = Message(
                conversation_id=conversation_row.conversation_id,
                sender_type="Customer",
                message_text=opening_message,
                timestamp=datetime.utcnow(),
                message_type="Text"
            )
            db.add(customer_msg)

            # 6. System state message
            system_state_msg = Message(
                conversation_id=conversation_row.conversation_id,
                sender_type="AI",
                message_text=json.dumps({
                    "persona": persona_key,
                    "scenario": scenario_key,
                    "state": current_state
                }),
                timestamp=datetime.utcnow(),
                message_type="System"
            )
            db.add(system_state_msg)
            db.commit()

            print(f"Turn 1 (Customer Opening):")
            print(f"  Customer: {opening_message}")
            print(f"  State: Frust={current_state['frustration']}, Trust={current_state['trust']}, Sat={current_state['satisfaction']}, Esc={current_state['escalation_intent']}")

            dialogue_history = [{
                "sender_type": "Customer",
                "message_text": opening_message
            }]

            turn_num = 1
            is_res = False
            is_esc = False

            for agent_turn_text in conv["agent_turns"]:
                turn_num += 1
                print(f"\nTurn {turn_num}:")
                print(f"  Support Agent: {agent_turn_text}")

                # Save agent message
                agent_msg = Message(
                    conversation_id=conversation_row.conversation_id,
                    sender_type="Support Agent",
                    message_text=agent_turn_text,
                    timestamp=datetime.utcnow(),
                    message_type="Text"
                )
                db.add(agent_msg)
                db.flush()

                # Generate customer turn
                turn_result = generate_customer_turn(
                    persona=persona_key,
                    scenario=scenario_key,
                    state=current_state,
                    conversation_history=dialogue_history,
                    agent_response=agent_turn_text
                )

                customer_reply = turn_result["customer_message"]
                current_state = turn_result["updated_state"]
                is_res = turn_result["is_resolved"]
                is_esc = turn_result["is_escalated"]

                print(f"  Customer: {customer_reply}")
                print(f"  State: Frust={current_state['frustration']}, Trust={current_state['trust']}, Sat={current_state['satisfaction']}, Esc={current_state['escalation_intent']} | Resolved={is_res}, Escalated={is_esc}")

                # Save customer message
                customer_reply_msg = Message(
                    conversation_id=conversation_row.conversation_id,
                    sender_type="Customer",
                    message_text=customer_reply,
                    timestamp=datetime.utcnow(),
                    message_type="Text"
                )
                db.add(customer_reply_msg)

                # Save system updated state
                system_state_row = Message(
                    conversation_id=conversation_row.conversation_id,
                    sender_type="AI",
                    message_text=json.dumps({
                        "persona": persona_key,
                        "scenario": scenario_key,
                        "state": current_state
                    }),
                    timestamp=datetime.utcnow(),
                    message_type="System"
                )
                db.add(system_state_row)

                dialogue_history.append({"sender_type": "Support Agent", "message_text": agent_turn_text})
                dialogue_history.append({"sender_type": "Customer", "message_text": customer_reply})

                if is_res or is_esc:
                    break

            # Mark completed session
            session_row.status = "Completed"
            session_row.end_time = datetime.utcnow()
            if is_res:
                conversation_row.resolution_status = "Resolved"
            elif is_esc:
                conversation_row.escalation_risk = "High"

            db.commit()
            completed_session_ids.append(session_row.session_id)
            print(f"\n  -> Session {session_row.session_id} completed. (Status: {session_row.status}, Final Outcome: {'Resolved' if is_res else ('Escalated' if is_esc else 'Concluded')})")

    finally:
        db.close()

    print("\n" + "=" * 70)
    print("EXPORTING COMPLETED SESSION LOGS...")
    print("=" * 70)
    exported_files = export_all_completed_sessions(output_dir="logs/simulator")
    print(f"\nSuccessfully generated and exported {len(exported_files)} conversation log files:")
    for fpath in exported_files:
        print(f"  - {fpath}")


if __name__ == "__main__":
    run_demo()
