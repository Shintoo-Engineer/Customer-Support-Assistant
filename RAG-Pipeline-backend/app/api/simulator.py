import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession

from app.models.database import SessionLocal
from app.models.simulator import Scenario, Session, Conversation, Message
from app.services.simulator_service import generate_customer_turn
from app.services.simulator_state import initial_state
from app.services.scenario_service import SCENARIOS, get_scenario_brief
from app.services.persona_service import get_persona_brief


router = APIRouter(
    prefix="/simulator",
    tags=["Customer Simulator"]
)


# --------------------------------------------------
# Database dependency
# --------------------------------------------------

def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


# --------------------------------------------------
# Request models
# --------------------------------------------------

class SimulatorStartRequest(BaseModel):

    session_label: str

    persona: str

    scenario: str

    initial_emotion: str

    issue_severity: int

    patience_level: int

    expected_resolution: str


class SimulatorMessageRequest(BaseModel):

    session_id: int

    agent_response: str


# --------------------------------------------------
# Endpoint 1: Start Simulation
# --------------------------------------------------

@router.post("/start")
def start_simulator_session(

    request: SimulatorStartRequest,

    db: DBSession = Depends(get_db)

):
    # Validate scenario
    try:
        get_scenario_brief(request.scenario)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    # Validate persona
    try:
        get_persona_brief(request.persona)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    scenario_key = request.scenario.strip().lower()
    scenario_data = SCENARIOS[scenario_key]

    # Create Scenario row
    scenario_row = Scenario(
        title=request.session_label or f"Scenario - {scenario_key.title()}",
        category=scenario_key,
        difficulty="Medium",
        objective=request.expected_resolution or scenario_data.get("resolution_condition"),
        description=scenario_data.get("opening_complaint"),
        is_active=True
    )
    db.add(scenario_row)
    db.flush()

    # Create Session row
    session_row = Session(
        scenario_id=scenario_row.scenario_id,
        start_time=datetime.utcnow(),
        status="In Progress"
    )
    db.add(session_row)
    db.flush()

    # Create Conversation row
    conversation_row = Conversation(
        session_id=session_row.session_id,
        intent=scenario_key,
        sentiment=request.initial_emotion,
        resolution_status="Unresolved",
        escalation_risk="Low",
        created_at=datetime.utcnow()
    )
    db.add(conversation_row)
    db.flush()

    # Build initial state
    start_state = initial_state(
        persona=request.persona,
        initial_emotion=request.initial_emotion,
        issue_severity=request.issue_severity,
        patience_level=request.patience_level
    )

    opening_message = scenario_data["opening_complaint"]

    # Customer's initial opening message
    customer_msg = Message(
        conversation_id=conversation_row.conversation_id,
        sender_type="Customer",
        message_text=opening_message,
        timestamp=datetime.utcnow(),
        message_type="Text"
    )
    db.add(customer_msg)

    # System state message to track current state without schema alterations
    system_state_msg = Message(
        conversation_id=conversation_row.conversation_id,
        sender_type="AI",
        message_text=json.dumps({
            "persona": request.persona,
            "scenario": scenario_key,
            "state": start_state
        }),
        timestamp=datetime.utcnow(),
        message_type="System"
    )
    db.add(system_state_msg)

    db.commit()

    return {
        "session_id": session_row.session_id,
        "conversation_id": conversation_row.conversation_id,
        "customer_message": opening_message,
        "state": start_state,
        "turn": 1
    }


# --------------------------------------------------
# Endpoint 2: Next Customer Turn
# --------------------------------------------------

@router.post("/message")
def send_simulator_message(

    request: SimulatorMessageRequest,

    db: DBSession = Depends(get_db)

):
    # Lookup Session
    session_row = (
        db.query(Session)
        .filter(Session.session_id == request.session_id)
        .first()
    )

    if not session_row:
        raise HTTPException(
            status_code=404,
            detail="Simulator session not found"
        )

    # Lookup Conversation
    conversation_row = (
        db.query(Conversation)
        .filter(Conversation.session_id == session_row.session_id)
        .first()
    )

    if not conversation_row:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found for session"
        )

    scenario_row = (
        db.query(Scenario)
        .filter(Scenario.scenario_id == session_row.scenario_id)
        .first()
    )

    # Fetch ordered messages
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

    # Filter dialogue history for prompt
    dialogue_history = [
        {
            "sender_type": m.sender_type,
            "message_text": m.message_text
        }
        for m in all_messages
        if m.message_type != "System"
    ]

    # Persist agent's response
    agent_msg = Message(
        conversation_id=conversation_row.conversation_id,
        sender_type="Support Agent",
        message_text=request.agent_response,
        timestamp=datetime.utcnow(),
        message_type="Text"
    )
    db.add(agent_msg)
    db.flush()

    # Generate customer turn
    turn_result = generate_customer_turn(
        persona=persona,
        scenario=scenario_key,
        state=current_state,
        conversation_history=dialogue_history,
        agent_response=request.agent_response
    )

    customer_message = turn_result["customer_message"]
    updated_state = turn_result["updated_state"]
    is_res = turn_result["is_resolved"]
    is_esc = turn_result["is_escalated"]

    # Persist customer message
    customer_msg_row = Message(
        conversation_id=conversation_row.conversation_id,
        sender_type="Customer",
        message_text=customer_message,
        timestamp=datetime.utcnow(),
        message_type="Text"
    )
    db.add(customer_msg_row)

    # Persist updated state in a System message row
    system_state_row = Message(
        conversation_id=conversation_row.conversation_id,
        sender_type="AI",
        message_text=json.dumps({
            "persona": persona,
            "scenario": scenario_key,
            "state": updated_state
        }),
        timestamp=datetime.utcnow(),
        message_type="System"
    )
    db.add(system_state_row)

    # Update session and conversation status if resolved or escalated
    if is_res:
        session_row.status = "Completed"
        session_row.end_time = datetime.utcnow()
        conversation_row.resolution_status = "Resolved"
    elif is_esc:
        session_row.status = "Completed"
        session_row.end_time = datetime.utcnow()
        conversation_row.escalation_risk = "High"

    # Calculate turn count
    customer_turns = sum(
        1 for m in dialogue_history if m["sender_type"] == "Customer"
    ) + 1

    db.commit()

    return {
        "session_id": session_row.session_id,
        "customer_message": customer_message,
        "state": updated_state,
        "turn": customer_turns,
        "is_resolved": is_res,
        "is_escalated": is_esc
    }


# --------------------------------------------------
# Endpoint 3: History
# --------------------------------------------------

@router.get("/{session_id}/history")
def get_simulator_history(

    session_id: int,

    db: DBSession = Depends(get_db)

):
    session_row = (
        db.query(Session)
        .filter(Session.session_id == session_id)
        .first()
    )

    if not session_row:
        raise HTTPException(
            status_code=404,
            detail="Simulator session not found"
        )

    conversation_row = (
        db.query(Conversation)
        .filter(Conversation.session_id == session_id)
        .first()
    )

    if not conversation_row:
        return {
            "session_id": session_id,
            "status": session_row.status,
            "messages": []
        }

    # Retrieve only dialogue messages (excluding internal System state rows)
    messages = (
        db.query(Message)
        .filter(
            Message.conversation_id == conversation_row.conversation_id,
            Message.message_type != "System"
        )
        .order_by(Message.message_id.asc())
        .all()
    )

    return {
        "session_id": session_id,
        "status": session_row.status,
        "messages": [
            {
                "message_id": message.message_id,
                "sender_type": message.sender_type,
                "message_text": message.message_text,
                "message_type": message.message_type,
                "timestamp": message.timestamp
            }
            for message in messages
        ]
    }
