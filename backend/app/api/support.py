from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.analysis_service import analyze_customer_message


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


class AnalysisHistoryMessage(BaseModel):
    sender_type: str = Field(
        ...,
        description="Sender type, such as Customer or Support Agent."
    )

    message_text: str = Field(
        ...,
        min_length=1,
        description="Previous conversation message."
    )


class AnalysisRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        description="Current customer message to analyze.",
        examples=[
            "I have already explained this twice. Where is my refund?"
        ]
    )

    conversation_history: list[AnalysisHistoryMessage] = Field(
        default_factory=list,
        description="Previous conversation messages used for contextual analysis."
    )


class AnalysisResponse(BaseModel):
    intent: str = Field(
        ...,
        description="Detected customer intent."
    )

    emotion: str = Field(
        ...,
        description="Detected customer emotional state."
    )

    sentiment: str = Field(
        ...,
        description="Detected sentiment: Positive, Neutral, or Negative."
    )

    frustration_level: int = Field(
        ...,
        ge=0,
        le=10,
        description="Customer frustration level from 0 to 10."
    )

    satisfaction_trend: str = Field(
        ...,
        description="Customer satisfaction trend."
    )

    escalation_risk: str = Field(
        ...,
        description="Customer escalation risk."
    )

    confidence: float = Field(
        ...,
        ge=0,
        le=1,
        description="Classification confidence from 0 to 1."
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
    "/analyze",
    response_model=AnalysisResponse,
    summary="Analyze Customer Message",
    description="""
Analyze a customer message using the Task 4 Intent and Sentiment
Analysis Agent.

The analysis includes:

- Customer intent
- Emotional state
- Sentiment
- Frustration level
- Satisfaction trend
- Escalation risk
- Classification confidence

Previous customer messages can be supplied through
`conversation_history` so the analysis can use conversation context.
""",
    response_description="Customer message analysis returned successfully."
)
def analyze_support_message(request: AnalysisRequest):
    conversation_history: list[dict[str, Any]] = [
        {
            "sender_type": item.sender_type,
            "message_text": item.message_text,
        }
        for item in request.conversation_history
    ]

    return analyze_customer_message(
        message=request.message,
        conversation_history=conversation_history,
    )