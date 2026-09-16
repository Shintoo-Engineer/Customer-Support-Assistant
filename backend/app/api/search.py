
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.embedding_service import generate_embedding
from app.services.vector_service import search_documents


router = APIRouter(
    prefix="/search",
    tags=["Semantic Search"]
)


class SearchRequest(BaseModel):
    query: str
    number_of_results: int = 3


@router.post("/")
async def semantic_search(request: SearchRequest):

    # Validate query
    if not request.query.strip():
        raise HTTPException(
            status_code=400,
            detail="Search query cannot be empty."
        )

    # Generate embedding for user's question
    query_embedding = generate_embedding(request.query)

    # Search ChromaDB
    results = search_documents(
        query_embedding=query_embedding,
        number_of_results=request.number_of_results
    )

    # Format results
    search_results = []

    ids = results.get("ids", [[]])[0]
    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    for i in range(len(ids)):

        search_results.append({
            "chunk_id": ids[i],
            "text": documents[i],
            "metadata": metadatas[i],
            "distance": distances[i]
        })

    return {
        "query": request.query,
        "results": search_results
    }

