from sqlalchemy.orm import Session

from app.models.chat import ChatMessage
from app.services.rag_service import generate_rag_answer


def process_chat_message(
    db: Session,
    session_id: str,
    message: str,
    number_of_results: int = 3
):

    # --------------------------------------------------
    # 1. Get previous conversation
    # --------------------------------------------------

    previous_messages = (
        db.query(ChatMessage)
        .filter(
            ChatMessage.session_id == session_id
        )
        .order_by(
            ChatMessage.created_at.asc()
        )
        .limit(10)
        .all()
    )


    # --------------------------------------------------
    # 2. Build conversation context
    # --------------------------------------------------

    conversation_context = ""

    for chat in previous_messages:

        conversation_context += (
            f"Customer: {chat.user_message}\n"
            f"Assistant: {chat.assistant_message}\n\n"
        )


    # --------------------------------------------------
    # 3. Make question context-aware
    # --------------------------------------------------

    if conversation_context:

        rag_question = f"""
Previous conversation:

{conversation_context}

Current customer message:

{message}

Answer the current customer message using the
support knowledge base. Use the previous conversation
only to understand what the customer is referring to.
"""

    else:

        rag_question = message


    # --------------------------------------------------
    # 4. Send to existing RAG
    # --------------------------------------------------

    rag_result = generate_rag_answer(
        question=rag_question,
        number_of_results=number_of_results
    )


    # --------------------------------------------------
    # 5. Save conversation
    # --------------------------------------------------

    chat_message = ChatMessage(
        session_id=session_id,
        user_message=message,
        assistant_message=rag_result["answer"]
    )

    db.add(chat_message)
    db.commit()
    db.refresh(chat_message)


    # --------------------------------------------------
    # 6. Return result
    # --------------------------------------------------

    return {
        "session_id": session_id,
        "user_message": message,
        "assistant_message": rag_result["answer"],
        "sources": rag_result["sources"]
    }