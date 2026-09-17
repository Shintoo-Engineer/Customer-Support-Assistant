from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.rag_service import generate_rag_answer


router = APIRouter(
    prefix="/rag",
    tags=["RAG"]
)


class RAGRequest(BaseModel):
    question: str
    number_of_results: int = 3


@router.post("/ask")
async def ask_question(request: RAGRequest):

    if not request.question.strip():
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty."
        )

    try:

        result = generate_rag_answer(
            question=request.question,
            number_of_results=request.number_of_results
        )

        return {
            "question": request.question,
            "answer": result["answer"],
            "sources": result["sources"]
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=f"RAG processing failed: {str(e)}"
        )

