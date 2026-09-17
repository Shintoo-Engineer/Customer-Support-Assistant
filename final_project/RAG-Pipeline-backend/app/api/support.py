from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as DBSession

from app.models.database import SessionLocal
from app.services.conversation_orchestration_service import process_support_turn


router = APIRouter(
    prefix="/support",
    tags=["Live Support"]
)


def get_db():
    """Yields an active database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class SupportTurnRequest(BaseModel):
    session_id: int = Field(
        ...,
        gt=0,
        description="Active simulator session ID.",
        examples=[1]
    )
    agent_response: str = Field(
        ...,
        min_length=1,
        description="Support agent's response message to the customer.",
        examples=["I can help you check your order status."]
    )


class SupportRequest(BaseModel):
    issue_type: str = Field(
        ...,
        description="Type of issue reported by the user.",
        examples=["Technical Issue"]
    )

    message: str = Field(
        ...,
        min_length=1,
        description="Description of the user's issue.",
        examples=["I am having trouble using the application."]
    )


class SupportResponse(BaseModel):
    status: str = Field(
        ...,
        description="Status of the support request."
    )

    issue_type: str = Field(
        ...,
        description="Issue category submitted by the user."
    )

    support_response: str = Field(
        ...,
        description="Response returned by the Live Support module."
    )


@router.post(
    "/",
    response_model=SupportResponse,
    summary="Submit a Live Support Request",
    description="""
Submit a support request and receive an immediate response.

### Supported Issue Types

- Technical Issue
- Document Upload
- Coaching Help
- Other

The Live Support module provides immediate assistance
for common user problems.
""",
    response_description="Support response returned successfully."
)
def live_support(request: SupportRequest):

    issue = request.issue_type.lower()

    if "technical" in issue:
        response = (
            "For technical issues, please check your internet "
            "connection and try again. If the problem continues, "
            "please contact support."
        )

    elif "document" in issue or "upload" in issue:
        response = (
            "For document upload problems, make sure the file format "
            "is supported and the file is not too large. "
            "Please try uploading it again."
        )

    elif "coaching" in issue:
        response = (
            "For coaching-related help, please describe your learning "
            "goal or the difficulty you are facing. "
            "Our AI Coaching system can guide you."
        )

    else:
        response = (
            "Thank you for contacting Live Support. "
            "Your request has been received. Please provide more "
            "details about your issue for further assistance."
        )
    return {
        "status": "success",
        "issue_type": request.issue_type,
        "support_response": response
    }


@router.post(
    "/turn",
    summary="Process Support Agent Turn (Full Conversation Flow)",
    description=(
        "Processes an agent response for an ongoing simulator session: generates the next customer message "
        "via Task 3, executes multidimensional analysis via Task 4, and retrieves context-aware knowledge "
        "recommendations via Task 5. Returns the complete integrated turn context."
    ),
    responses={
        200: {
            "description": "Turn processed successfully with recommendations and analysis.",
        },
        400: {
            "description": "Validation error or invalid request parameters.",
        },
        404: {
            "description": "Specified session_id not found.",
        },
    }
)
def submit_support_turn(
    request: SupportTurnRequest,
    db: DBSession = Depends(get_db)
):
    """Processes an agent turn through the integrated Task 3 -> Task 4 -> Task 5 loop."""
    try:
        return process_support_turn(
            session_id=request.session_id,
            agent_response=request.agent_response,
            db=db,
        )
    except ValueError as e:
        err_msg = str(e)
        if "not found" in err_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=err_msg
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg
        )