from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.chat import router as chat_router
from app.api.documents import router as documents_router
from app.api.document_management import router as document_management_router
from app.api.knowledge import router as knowledge_router
from app.api.rag import router as rag_router
from app.api.search import router as search_router
from app.api.simulator import router as simulator_router
from app.api.support import router as support_router
from app.api.manual import router as manual_router
from app.api.user_management import router as user_management_router
from app.api.coaching import router as coaching_router
from app.api.escalation import router as escalation_router
from app.api.analytics import router as analytics_router


app = FastAPI(
    title="AI Coaching Agent",
    description="Customer Support Assistant API",
    version="1.0.0",
)


# --------------------------------------------------
# CORS Configuration
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# API Routers
# --------------------------------------------------

app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(documents_router)
app.include_router(document_management_router)
app.include_router(knowledge_router)
app.include_router(rag_router)
app.include_router(search_router)
app.include_router(simulator_router)
app.include_router(support_router)
app.include_router(manual_router)
app.include_router(user_management_router)
app.include_router(coaching_router)
app.include_router(escalation_router)
app.include_router(analytics_router)


# --------------------------------------------------
# Root
# --------------------------------------------------

@app.get("/")
def root():
    return {
        "status": "success",
        "message": "AI Coaching Agent API is running",
    }