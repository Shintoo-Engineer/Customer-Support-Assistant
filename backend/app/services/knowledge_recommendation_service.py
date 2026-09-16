from app.services.embedding_service import generate_embedding
from app.services.vector_service import search_documents
from app.services.rag_service import get_latest_active_document_ids


DEFAULT_RECOMMENDATION_COUNT = 3
MAX_RECOMMENDATION_COUNT = 5
CANDIDATE_MULTIPLIER = 10
MIN_CANDIDATES = 30


def _normalize_text(text: str) -> str:
    """
    Normalize text for building a consistent recommendation query.
    """
    return " ".join(text.lower().strip().split())


def _build_recommendation_query(
    message: str,
    conversation_history: list[dict] | None = None
) -> str:
    """
    Combine the current customer message with relevant previous
    customer conversation context.
    """

    current_message = _normalize_text(message)

    if not conversation_history:
        return current_message

    previous_customer_messages = []

    for item in conversation_history:
        sender_type = str(item.get("sender_type", "")).lower()
        message_text = str(item.get("message_text", "")).strip()

        if (
            sender_type == "customer"
            and message_text
            and _normalize_text(message_text) != current_message
        ):
            previous_customer_messages.append(message_text)

    # Keep the most recent customer context so the query does not
    # become unnecessarily large.
    previous_customer_messages = previous_customer_messages[-3:]

    if not previous_customer_messages:
        return current_message

    context = " ".join(previous_customer_messages)

    return f"{context} {message}".strip()


def _get_document_id(metadata: dict) -> str | None:
    """
    Get the document ID from ChromaDB metadata.
    """

    document_id = metadata.get("document_id")

    if document_id is None:
        return None

    return str(document_id)


def _filter_latest_active_documents(
    ids: list,
    documents: list,
    metadatas: list,
    distances: list
) -> list[dict]:
    """
    Keep only chunks belonging to the latest active document versions.

    This reuses the same version-selection logic already used by
    the existing RAG service.
    """

    latest_active_ids = get_latest_active_document_ids()

    candidates = []

    for index in range(len(ids)):
        metadata = metadatas[index] or {}
        document_id = _get_document_id(metadata)

        if document_id is None:
            continue

        if document_id not in latest_active_ids:
            continue

        candidates.append(
            {
                "chunk_id": ids[index],
                "text": documents[index],
                "metadata": metadata,
                "distance": distances[index],
            }
        )

    return candidates


def _build_recommendation(candidate: dict) -> dict:
    """
    Convert an internal ChromaDB result into the public
    recommendation structure.
    """

    metadata = candidate["metadata"]

    return {
        "chunk_id": candidate["chunk_id"],
        "title": metadata.get("document_name", "Support Knowledge"),
        "document_name": metadata.get(
            "document_name",
            "Unknown document"
        ),
        "document_type": metadata.get(
            "document_type",
            "Unknown"
        ),
        "version": metadata.get(
            "version"
        ),
        "page_number": metadata.get(
            "page_number"
        ),
        "reference": {
            "document_name": metadata.get(
                "document_name",
                "Unknown document"
            ),
            "document_type": metadata.get(
                "document_type",
                "Unknown"
            ),
            "version": metadata.get(
                "version"
            ),
            "page_number": metadata.get(
                "page_number"
            ),
            "chunk_id": candidate["chunk_id"],
        },
        "relevance_distance": candidate["distance"],
        "content": candidate["text"],
    }


def recommend_knowledge(
    message: str,
    conversation_history: list[dict] | None = None,
    number_of_recommendations: int = DEFAULT_RECOMMENDATION_COUNT,
) -> dict:
    """
    Retrieve contextually relevant knowledge recommendations
    for a customer-support conversation turn.

    The function reuses the existing embedding and ChromaDB
    retrieval pipeline instead of creating a separate RAG system.
    """

    if not message or not message.strip():
        return {
            "query": "",
            "recommendations": [],
            "message": "No customer message was provided.",
        }

    if number_of_recommendations < 1:
        number_of_recommendations = DEFAULT_RECOMMENDATION_COUNT

    number_of_recommendations = min(
        number_of_recommendations,
        MAX_RECOMMENDATION_COUNT,
    )

    recommendation_query = _build_recommendation_query(
        message=message,
        conversation_history=conversation_history,
    )

    query_embedding = generate_embedding(recommendation_query)

    candidate_count = max(
        number_of_recommendations * CANDIDATE_MULTIPLIER,
        MIN_CANDIDATES,
    )

    results = search_documents(
        query_embedding=query_embedding,
        number_of_results=candidate_count,
    )

    ids = results.get("ids", [[]])[0]
    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    if not ids:
        return {
            "query": recommendation_query,
            "recommendations": [],
            "message": (
                "No relevant support knowledge was found."
            ),
        }

    candidates = _filter_latest_active_documents(
        ids=ids,
        documents=documents,
        metadatas=metadatas,
        distances=distances,
    )

    if not candidates:
        return {
            "query": recommendation_query,
            "recommendations": [],
            "message": (
                "No relevant active support knowledge was found."
            ),
        }

    # ChromaDB distance is lower for more semantically similar results.
    candidates.sort(
        key=lambda item: item["distance"]
    )

    selected_candidates = candidates[
        :number_of_recommendations
    ]

    recommendations = [
        _build_recommendation(candidate)
        for candidate in selected_candidates
    ]

    return {
        "query": recommendation_query,
        "recommendations": recommendations,
        "message": (
            "Relevant support knowledge recommendations found."
        ),
    }