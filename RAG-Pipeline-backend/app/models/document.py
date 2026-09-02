from sqlalchemy import Column, Integer, String

from app.models.database import Base


class Document(Base):

    __tablename__ = "documents"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    filename = Column(
        String,
        nullable=False
    )

    document_name = Column(
        String,
        nullable=False
    )

    document_type = Column(
        String,
        nullable=False
    )

    version = Column(
        Integer,
        nullable=False,
        default=1
    )

    uploaded_by = Column(
        String,
        nullable=False,
        default="admin"
    )

    status = Column(
        String,
        nullable=False,
        default="active"
    )