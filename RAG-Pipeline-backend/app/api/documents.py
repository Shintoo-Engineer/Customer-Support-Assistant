from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from pathlib import Path
import shutil

from sqlalchemy.orm import Session

from app.api.dependencies import require_admin
from app.models.database import SessionLocal
from app.models.document import Document
from app.models.user import User
from app.services.ingestion_service import ingest_document


router = APIRouter(
    prefix="/documents",
    tags=["Documents"]
)


# --------------------------------------------------
# Uploaded PDF directory
# --------------------------------------------------

UPLOAD_DIR = Path("data/documents")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


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
# Upload Document
# --------------------------------------------------

@router.post("/upload")
async def upload_document(

    file: UploadFile = File(...),

    document_name: str = Form(...),

    document_type: str = Form(...),

    db: Session = Depends(get_db),

    current_user: User = Depends(require_admin)

):

    # --------------------------------------------------
    # 1. Validate PDF
    # --------------------------------------------------

    if file.content_type != "application/pdf":

        raise HTTPException(
            status_code=400,
            detail="Only PDF files are allowed."
        )


    # --------------------------------------------------
    # 2. Normalize document name and type
    # --------------------------------------------------

    document_name = document_name.strip()

    document_type = document_type.strip().lower()


    # --------------------------------------------------
    # 3. Validate document name
    # --------------------------------------------------

    if not document_name:

        raise HTTPException(
            status_code=400,
            detail="Document name cannot be empty."
        )


    # --------------------------------------------------
    # 4. Validate document type
    # --------------------------------------------------

    allowed_document_types = {
        "policy",
        "faq",
        "support"
    }

    if document_type not in allowed_document_types:

        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid document type. "
                "Allowed types are: policy, faq, support."
            )
        )


    # --------------------------------------------------
    # 5. Admin authorization
    # --------------------------------------------------

    # Authorization is determined from the authenticated
    # user's JWT and database role.
    #
    # The frontend cannot choose or override the role.

    if current_user.role != "admin":

        raise HTTPException(
            status_code=403,
            detail="Only admin users can upload documents."
        )


    # --------------------------------------------------
    # 6. Find latest version
    # --------------------------------------------------

    previous_document = (

        db.query(Document)

        .filter(
            Document.document_name == document_name
        )

        .order_by(
            Document.version.desc()
        )

        .first()
    )


    # --------------------------------------------------
    # 7. Determine new version
    # --------------------------------------------------

    if previous_document:

        new_version = previous_document.version + 1

        # Archive old version

        previous_document.status = "archived"

    else:

        new_version = 1


    # --------------------------------------------------
    # 8. Create filename
    # --------------------------------------------------

    safe_document_name = (
        document_name.replace(" ", "_")
    )

    filename = (
        f"{safe_document_name}"
        f"_v{new_version}.pdf"
    )

    file_path = UPLOAD_DIR / filename


    # --------------------------------------------------
    # 9. Save PDF
    # --------------------------------------------------

    try:

        with file_path.open("wb") as buffer:

            shutil.copyfileobj(
                file.file,
                buffer
            )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Failed to save document: {str(e)}"
            )
        )


    # --------------------------------------------------
    # 10. Create database record
    # --------------------------------------------------

    document = Document(

        filename=filename,

        document_name=document_name,

        document_type=document_type,

        version=new_version,

        uploaded_by=current_user.email,

        status="active"

    )

    db.add(document)

    db.commit()

    db.refresh(document)


    # --------------------------------------------------
    # 11. Run ingestion pipeline
    # --------------------------------------------------

    try:

        ingestion_result = ingest_document(

            file_path=str(file_path),

            document_id=document.id,

            document_name=document.document_name,

            document_type=document.document_type,

            version=document.version,

            uploaded_by=document.uploaded_by

        )

    except Exception as e:

        raise HTTPException(

            status_code=500,

            detail=(
                "Document uploaded but "
                f"ingestion failed: {str(e)}"
            )

        )


    # --------------------------------------------------
    # 12. Return response
    # --------------------------------------------------

    return {

        "message": (
            "Document uploaded and "
            "processed successfully"
        ),

        "document": {

            "document_id": document.id,

            "document_name": document.document_name,

            "document_type": document.document_type,

            "version": document.version,

            "status": document.status,

            "filename": document.filename,

            "uploaded_by": document.uploaded_by

        },

        "ingestion": ingestion_result

    }