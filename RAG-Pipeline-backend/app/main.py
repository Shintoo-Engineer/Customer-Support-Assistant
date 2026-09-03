from fastapi import FastAPI

from app.api.documents import router as documents_router
from app.api.search import router as search_router
from app.api.rag import router as rag_router
from app.api.document_management import router as document_management_router
from app.api.chat import router as chat_router
from app.api.support import router as support_router
from app.api.simulator import router as simulator_router


app = FastAPI(
    title="AI Coaching Agent",
    description="Support Knowledge Base and RAG Pipeline",
    version="1.0.0"
)


# Document upload API
app.include_router(documents_router)

# Semantic search API
app.include_router(search_router)
app.include_router(rag_router)
app.include_router(document_management_router)
app.include_router(chat_router)
app.include_router(support_router)
app.include_router(simulator_router)


@app.get("/")
def root():
    return {
        "message": "AI Coaching Agent API is running"
    }

