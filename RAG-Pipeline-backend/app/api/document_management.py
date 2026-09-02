from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.models.database import SessionLocal
from app.models.document import Document


router = APIRouter(
    prefix="/documents",
    tags=["Documents"]
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
# Get all uploaded documents
# --------------------------------------------------

@router.get("/")
def get_all_documents(
    db: Session = Depends(get_db)
):

    documents = (
        db.query(Document)
        .order_by(
            Document.document_name,
            Document.version.desc()
        )
        .all()
    )

    return {
        "total_documents": len(documents),
        "documents": [
            {
                "document_id": document.id,
                "document_name": document.document_name,
                "document_type": document.document_type,
                "version": document.version,
                "status": document.status,
                "filename": document.filename,
                "uploaded_by": document.uploaded_by
            }
            for document in documents
        ]
    }


# --------------------------------------------------
# Get version history of a document
# --------------------------------------------------

@router.get("/history/{document_name}")
def get_document_history(
    document_name: str,
    db: Session = Depends(get_db)
):

    documents = (
        db.query(Document)
        .filter(
            Document.document_name == document_name
        )
        .order_by(
            Document.version.desc()
        )
        .all()
    )

    return {
        "document_name": document_name,
        "total_versions": len(documents),
        "versions": [
            {
                "document_id": document.id,
                "version": document.version,
                "status": document.status,
                "filename": document.filename,
                "document_type": document.document_type,
                "uploaded_by": document.uploaded_by
            }
            for document in documents
        ]
    }