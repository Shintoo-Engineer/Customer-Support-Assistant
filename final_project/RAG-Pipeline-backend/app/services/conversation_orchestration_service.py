"""Conversation Orchestration Service for Task 5 Phase 3.

Connects the existing:
    Task 3 — Customer Simulator
            ↓
    Task 4 — Intent & Sentiment Analysis
            ↓
    Task 5 — Knowledge Recommendation Agent
            ↓
    Support Agent Response
            ↓
    Task 3 — Next Customer Turn

into a seamless, context-aware customer-support conversation workflow.

Architectural Principles:
1. Reuses existing services without duplication (no secondary classifiers or vector stores).
2. Enforces strict failure isolation: failure of Task 4 or Task 5 never blocks the customer turn.
3. Preserves complete session isolation: context, analysis, and recommendations are strictly partitioned.
4. Preserves backward compatibility with all Task 3, Task 4, and Task 5 contracts.
"""

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session as DBSession

from app.models.simulator import Scenario, Session as SimSession, Conversation, Message
from app.services.simulator_service import generate_customer_turn
from app.services.simulator_state import initial_state
from app.services.scenario_service import SCENARIOS, get_scenario_brief
from app.services.persona_service import get_persona_brief
from app.services.analysis_service import analyze_customer_message
from app.services.knowledge_recommendation_service import get_knowledge_recommendations

logger = logging.getLogger(__name__)


def start_orchestrated_session(
    session_label: str,
    persona: str,
    scenario: str,
    initial_emotion: str,
    issue_severity: int,
    patience_level: int,
    expected_resolution: str,
    db: DBSession,
) -> Dict[str, Any]:
    """Initializes a new customer simulator session and executes the integrated Turn 1 flow.

    Turn 1 Flow:
    1. Validates persona and scenario.
    2. Persists Scenario, Session, and Conversation rows.
    3. Generates the customer opening complaint (Task 3).
    4. Analyzes the opening message for intent/sentiment (Task 4, failure-isolated).
    5. Retrieves contextually relevant knowledge recommendations (Task 5, failure-isolated).
    6. Persists turn state and analytical snapshot in a System message.
    7. Returns an integrated turn response dictionary.
    """
    # 1. Validate scenario and persona
    get_scenario_brief(scenario)
    get_persona_brief(persona)

    scenario_key = scenario.strip().lower()
    scenario_data = SCENARIOS[scenario_key]

    # 2. Persist Scenario row
    scenario_row = Scenario(
        title=session_label or f"Scenario - {scenario_key.title()}",
        category=scenario_key,
        difficulty="Medium",
        objective=expected_resolution or scenario_data.get("resolution_condition"),
        description=scenario_data.get("opening_complaint"),
        is_active=True,
    )
    db.add(scenario_row)
    db.flush()

    # 3. Persist Session row
    session_row = SimSession(
        scenario_id=scenario_row.scenario_id,
        start_time=datetime.utcnow(),
        status="In Progress",
    )
    db.add(session_row)
    db.flush()

    # 4. Persist Conversation row
    conversation_row = Conversation(
        session_id=session_row.session_id,
        intent=scenario_key,
        sentiment=initial_emotion,
        resolution_status="Unresolved",
        escalation_risk="Low",
        created_at=datetime.utcnow(),
    )
    db.add(conversation_row)
    db.flush()

    # 5. Build initial emotional state
    start_state = initial_state(
        persona=persona,
        initial_emotion=initial_emotion,
        issue_severity=issue_severity,
        patience_level=patience_level,
    )

    opening_message = scenario_data["opening_complaint"]

    # 6. Persist customer's initial opening message (Task 3)
    customer_msg = Message(
        conversation_id=conversation_row.conversation_id,
        sender_type="Customer",
        message_text=opening_message,
        timestamp=datetime.utcnow(),
        message_type="Text",
    )
    db.add(customer_msg)
    db.flush()

    logger.info(
        "orchestration: Turn 1 customer message generated for session %s: %s",
        session_row.session_id,
        opening_message[:60],
    )

    # 7. Task 4 Live Analysis with failure isolation
    analysis_resp = None
    analysis_dict = None
    try:
        logger.info("orchestration: Task 4 analysis started for session %s (turn 1)", session_row.session_id)
        analysis_resp = analyze_customer_message(
            session_id=session_row.session_id,
            customer_message=opening_message,
            db=db,
        )
        if analysis_resp:
            analysis_dict = analysis_resp.model_dump()
            logger.info(
                "orchestration: Task 4 analysis completed for session %s: intent=%s, emotion=%s",
                session_row.session_id,
                analysis_resp.intent.value if hasattr(analysis_resp.intent, "value") else analysis_resp.intent,
                analysis_resp.emotion.value if hasattr(analysis_resp.emotion, "value") else analysis_resp.emotion,
            )
    except Exception as e:
        logger.warning("orchestration: Task 4 analysis gracefully bypassed on exception: %s", e)

    # 8. Task 5 Knowledge Recommendation with failure isolation
    rec_result = None
    rec_dict = None
    try:
        logger.info("orchestration: Task 5 knowledge recommendation started for session %s (turn 1)", session_row.session_id)
        rec_result = get_knowledge_recommendations(
            query=opening_message,
            session_id=session_row.session_id,
            conversation_id=conversation_row.conversation_id,
            analysis=analysis_resp or analysis_dict,
            db=db,
        )
        if rec_result:
            rec_dict = rec_result.model_dump()
            logger.info(
                "orchestration: Task 5 recommendations retrieved for session %s: count=%d, no_relevant=%s",
                session_row.session_id,
                len(rec_result.recommendations),
                rec_result.no_relevant_information,
            )
    except Exception as e:
        logger.warning("orchestration: Task 5 knowledge recommendation gracefully bypassed on exception: %s", e)

    # 9. Persist System state snapshot (state + analysis + recommendations)
    system_state_msg = Message(
        conversation_id=conversation_row.conversation_id,
        sender_type="AI",
        message_text=json.dumps({
            "persona": persona,
            "scenario": scenario_key,
            "state": start_state,
            "analysis": analysis_dict,
            "recommendations": rec_dict,
        }),
        timestamp=datetime.utcnow(),
        message_type="System",
    )
    db.add(system_state_msg)
    db.commit()

    # 10. Assemble integrated turn response
    response_data: Dict[str, Any] = {
        "session_id": session_row.session_id,
        "conversation_id": conversation_row.conversation_id,
        "customer_message": opening_message,
        "state": start_state,
        "turn": 1,
        "is_resolved": False,
        "is_escalated": False,
    }
    if analysis_dict:
        response_data["analysis"] = analysis_dict

    if rec_dict:
        response_data["recommendations"] = rec_dict.get("recommendations", [])
        response_data["no_relevant_information"] = rec_dict.get("no_relevant_information", False)
        response_data["contextual_query"] = rec_dict.get("contextual_query")
        response_data["knowledge_recommendations"] = rec_dict
    else:
        response_data["recommendations"] = []
        response_data["no_relevant_information"] = True

    return response_data


def process_support_turn(
    session_id: int,
    agent_response: str,
    db: DBSession,
) -> Dict[str, Any]:
    """Processes an incoming support agent response and executes the subsequent customer turn.

    Multi-Turn Flow:
    1. Looks up Session and Conversation (raises ValueError if missing).
    2. Reconstructs current emotional state and persona from the latest System message.
    3. Persists Support Agent response (Task 3 dialogue message).
    4. Generates the customer's next message via Task 3 (in-character, emotionally progressive).
    5. Persists the new Customer message.
    6. Analyzes the new customer message via Task 4 (intent, emotion, escalation risk).
    7. Retrieves context-aware knowledge recommendations via Task 5 (using message + context + intent).
    8. Persists updated state snapshot in a new System message.
    9. Updates session/conversation resolution and escalation status.
    10. Commits the transaction and returns the integrated turn result.
    """
    if not agent_response or not agent_response.strip():
        raise ValueError("Agent response cannot be empty or whitespace only.")

    # 1. Lookup Session
    session_row = db.query(SimSession).filter(SimSession.session_id == session_id).first()
    if not session_row:
        raise ValueError("Simulator session not found")

    # 2. Lookup Conversation
    conversation_row = db.query(Conversation).filter(Conversation.session_id == session_id).first()
    if not conversation_row:
        raise ValueError(f"Conversation not found for session {session_id}.")

    scenario_row = db.query(Scenario).filter(Scenario.scenario_id == session_row.scenario_id).first()

    # 3. Fetch ordered messages to reconstruct dialogue history and state
    all_messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_row.conversation_id)
        .order_by(Message.message_id.asc())
        .all()
    )

    # Reconstruct current state, persona, and scenario from latest System message
    current_state = None
    persona = "calm"
    scenario_key = scenario_row.category if scenario_row else "refund"

    for m in reversed(all_messages):
        if m.message_type == "System":
            try:
                payload = json.loads(m.message_text)
                current_state = payload.get("state")
                persona = payload.get("persona", persona)
                scenario_key = payload.get("scenario", scenario_key)
                break
            except Exception:
                pass

    if not current_state:
        current_state = initial_state(persona, "neutral", 3, 3)

    # Filter dialogue history for Task 3 prompt
    dialogue_history = [
        {
            "sender_type": m.sender_type,
            "message_text": m.message_text,
        }
        for m in all_messages
        if m.message_type != "System"
    ]

    # 4. Persist Support Agent's response
    agent_msg = Message(
        conversation_id=conversation_row.conversation_id,
        sender_type="Support Agent",
        message_text=agent_response,
        timestamp=datetime.utcnow(),
        message_type="Text",
    )
    db.add(agent_msg)
    db.flush()

    # 5. Generate next customer turn via Task 3
    turn_result = generate_customer_turn(
        persona=persona,
        scenario=scenario_key,
        state=current_state,
        conversation_history=dialogue_history,
        agent_response=agent_response,
    )

    customer_message = turn_result["customer_message"]
    updated_state = turn_result["updated_state"]
    is_res = turn_result["is_resolved"]
    is_esc = turn_result["is_escalated"]

    # 6. Persist new customer message
    customer_msg_row = Message(
        conversation_id=conversation_row.conversation_id,
        sender_type="Customer",
        message_text=customer_message,
        timestamp=datetime.utcnow(),
        message_type="Text",
    )
    db.add(customer_msg_row)
    db.flush()

    # Calculate turn count
    customer_turns = sum(
        1 for m in dialogue_history if m["sender_type"] == "Customer"
    ) + 1

    logger.info(
        "orchestration: Turn %d customer message generated for session %s: %s",
        customer_turns,
        session_id,
        customer_message[:60],
    )

    # 7. Task 4 Live Analysis with failure isolation
    analysis_resp = None
    analysis_dict = None
    try:
        logger.info("orchestration: Task 4 analysis started for session %s (turn %d)", session_id, customer_turns)
        analysis_resp = analyze_customer_message(
            session_id=session_row.session_id,
            customer_message=customer_message,
            db=db,
        )
        if analysis_resp:
            analysis_dict = analysis_resp.model_dump()
            logger.info(
                "orchestration: Task 4 analysis completed for session %s: intent=%s, emotion=%s",
                session_id,
                analysis_resp.intent.value if hasattr(analysis_resp.intent, "value") else analysis_resp.intent,
                analysis_resp.emotion.value if hasattr(analysis_resp.emotion, "value") else analysis_resp.emotion,
            )
    except Exception as e:
        logger.warning("orchestration: Task 4 turn analysis gracefully bypassed on exception: %s", e)

    # 8. Task 5 Context-Aware Knowledge Recommendation with failure isolation
    rec_result = None
    rec_dict = None
    try:
        logger.info(
            "orchestration: Task 5 knowledge recommendation started for session %s (turn %d)",
            session_id,
            customer_turns,
        )
        rec_result = get_knowledge_recommendations(
            query=customer_message,
            session_id=session_row.session_id,
            conversation_id=conversation_row.conversation_id,
            analysis=analysis_resp or analysis_dict,
            db=db,
        )
        if rec_result:
            rec_dict = rec_result.model_dump()
            logger.info(
                "orchestration: Task 5 recommendations retrieved for session %s: count=%d, no_relevant=%s",
                session_id,
                len(rec_result.recommendations),
                rec_result.no_relevant_information,
            )
    except Exception as e:
        logger.warning("orchestration: Task 5 knowledge recommendation gracefully bypassed on exception: %s", e)

    # 9. Persist updated System state snapshot
    system_state_row = Message(
        conversation_id=conversation_row.conversation_id,
        sender_type="AI",
        message_text=json.dumps({
            "persona": persona,
            "scenario": scenario_key,
            "state": updated_state,
            "analysis": analysis_dict,
            "recommendations": rec_dict,
        }),
        timestamp=datetime.utcnow(),
        message_type="System",
    )
    db.add(system_state_row)

    # 10. Update session and conversation status if resolved or escalated
    if is_res:
        session_row.status = "Completed"
        session_row.end_time = datetime.utcnow()
        conversation_row.resolution_status = "Resolved"
    elif is_esc:
        session_row.status = "Completed"
        session_row.end_time = datetime.utcnow()
        conversation_row.escalation_risk = "High"

    db.commit()

    # 11. Assemble integrated turn response
    response_data: Dict[str, Any] = {
        "session_id": session_row.session_id,
        "conversation_id": conversation_row.conversation_id,
        "customer_message": customer_message,
        "state": updated_state,
        "turn": customer_turns,
        "is_resolved": is_res,
        "is_escalated": is_esc,
    }
    if analysis_dict:
        response_data["analysis"] = analysis_dict

    if rec_dict:
        response_data["recommendations"] = rec_dict.get("recommendations", [])
        response_data["no_relevant_information"] = rec_dict.get("no_relevant_information", False)
        response_data["contextual_query"] = rec_dict.get("contextual_query")
        response_data["knowledge_recommendations"] = rec_dict
    else:
        response_data["recommendations"] = []
        response_data["no_relevant_information"] = True

    return response_data
