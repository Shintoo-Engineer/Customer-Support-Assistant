from fastapi import APIRouter
from pydantic import BaseModel, Field


router = APIRouter(
    prefix="/support",
    tags=["Live Support"]
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