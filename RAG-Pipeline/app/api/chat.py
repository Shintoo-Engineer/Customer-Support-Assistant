from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.database import SessionLocal
from app.models.chat import ChatMessage
from app.services.chat_service import process_chat_message


router = APIRouter(
    prefix="/chat",
    tags=["Chat"]
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
# Chat request model
# --------------------------------------------------

class ChatRequest(BaseModel):

    session_id: str

    message: str

    number_of_results: int = 3


# --------------------------------------------------
# Send chat message
# --------------------------------------------------

@router.post("/message")
def send_chat_message(

    request: ChatRequest,

    db: Session = Depends(get_db)

):

    result = process_chat_message(

        db=db,

        session_id=request.session_id,

        message=request.message,

        number_of_results=request.number_of_results

    )

    return result


# --------------------------------------------------
# Get conversation history
# --------------------------------------------------

@router.get("/{session_id}/history")
def get_chat_history(

    session_id: str,

    db: Session = Depends(get_db)

):

    messages = (

        db.query(ChatMessage)

        .filter(
            ChatMessage.session_id == session_id
        )

        .order_by(
            ChatMessage.created_at.asc()
        )

        .all()

    )


    return {

        "session_id": session_id,

        "messages": [

            {

                "id": message.id,

                "user_message": message.user_message,

                "assistant_message": message.assistant_message,

                "created_at": message.created_at

            }

            for message in messages

        ]

    }