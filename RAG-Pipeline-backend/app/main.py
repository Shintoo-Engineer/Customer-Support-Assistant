from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.documents import router as documents_router
from app.api.search import router as search_router
from app.api.rag import router as rag_router
from app.api.document_management import router as document_management_router
from app.api.chat import router as chat_router
from app.api.support import router as support_router
from app.api.simulator import router as simulator_router
from app.api.analysis import router as analysis_router
from app.api.auth import router as auth_router
from app.api.user_management import router as user_management_router


app = FastAPI(
    title="AI Coaching Agent",
    description="Support Knowledge Base and RAG Pipeline",
    version="1.0.0"
)


# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Authentication API
app.include_router(auth_router)

# Document upload API
app.include_router(documents_router)

# Semantic search API
app.include_router(search_router)

# RAG API
app.include_router(rag_router)

# Document management API
app.include_router(document_management_router)

# Chat API
app.include_router(chat_router)

# Customer support API
app.include_router(support_router)
app.include_router(simulator_router)

# Intent and Sentiment Analysis API (Task 4)
app.include_router(analysis_router)

# User management API
app.include_router(user_management_router)


@app.get("/")
def root():
    return {
        "message": "AI Coaching Agent API is running"
    }