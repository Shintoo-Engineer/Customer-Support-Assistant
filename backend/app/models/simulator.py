from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Float, ForeignKey

from app.models.database import Base


class Scenario(Base):

    __tablename__ = "scenarios"

    scenario_id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    title = Column(
        String,
        nullable=False
    )

    category = Column(
        String,
        nullable=False
    )

    difficulty = Column(
        String,
        nullable=False
    )

    objective = Column(
        Text,
        nullable=True
    )

    description = Column(
        Text,
        nullable=True
    )

    is_active = Column(
        Boolean,
        default=True,
        nullable=False
    )


class Session(Base):

    __tablename__ = "sessions"

    session_id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    agent_id = Column(
        Integer,
        nullable=True
    )

    scenario_id = Column(
        Integer,
        ForeignKey("scenarios.scenario_id"),
        nullable=False
    )

    start_time = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    end_time = Column(
        DateTime,
        nullable=True
    )

    overall_score = Column(
        Float,
        nullable=True
    )

    status = Column(
        String,
        default="In Progress",
        nullable=False
    )


class Conversation(Base):

    __tablename__ = "conversations"

    conversation_id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    session_id = Column(
        Integer,
        ForeignKey("sessions.session_id"),
        unique=True,
        nullable=False
    )

    intent = Column(
        String,
        nullable=True
    )

    sentiment = Column(
        String,
        nullable=True
    )

    resolution_status = Column(
        String,
        nullable=True
    )

    escalation_risk = Column(
        String,
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )


class Message(Base):

    __tablename__ = "messages"

    message_id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    conversation_id = Column(
        Integer,
        ForeignKey("conversations.conversation_id"),
        nullable=False
    )

    sender_type = Column(
        String,
        nullable=False
    )

    message_text = Column(
        Text,
        nullable=False
    )

    timestamp = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    message_type = Column(
        String,
        default="Text",
        nullable=False
    )
