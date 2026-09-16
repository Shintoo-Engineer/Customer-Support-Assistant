from sqlalchemy import Column, Integer, String, Text, DateTime
from datetime import datetime

from app.models.database import Base


class ChatMessage(Base):

    __tablename__ = "chat_messages"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    session_id = Column(
        String,
        index=True,
        nullable=False
    )

    user_message = Column(
        Text,
        nullable=False
    )

    assistant_message = Column(
        Text,
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )