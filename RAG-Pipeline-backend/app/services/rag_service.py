import os
import time
import re

from dotenv import load_dotenv
from google import genai

from app.services.embedding_service import generate_embedding
from app.services.vector_service import search_documents

from app.models.database import SessionLocal
from app.models.document import Document


# --------------------------------------------------
# Load environment variables
# --------------------------------------------------

load_dotenv()


# --------------------------------------------------
# Gemini configuration
# --------------------------------------------------

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError(
        "GEMINI_API_KEY is not configured. "
        "Please add it to the .env file."
    )


client = genai.Client(api_key=api_key)


PRIMARY_MODEL = "gemini-3.5-flash-lite"
FALLBACK_MODEL = "gemini-2.5-flash-lite"


# --------------------------------------------------
# Gemini generation with retry + fallback
# --------------------------------------------------

def generate_with_gemini(prompt: str):

    # Try primary model
    for attempt in range(2):

        try:

            response = client.models.generate_content(
                model=PRIMARY_MODEL,
                contents=prompt
            )

            return response.text

        except Exception as e:

            error_message = str(e)

            print(
                f"Primary Gemini model failed "
                f"(attempt {attempt + 1}/2): {error_message}"
            )

            if (
                "503" in error_message
                or "UNAVAILABLE" in error_message
            ):

                if attempt == 0:
                    time.sleep(3)
                    continue

            break


    # Fallback model
    print(
        f"Trying fallback Gemini model: {FALLBACK_MODEL}"
    )

    response = client.models.generate_content(
        model=FALLBACK_MODEL,
        contents=prompt
    )

    return response.text


# --------------------------------------------------
# Normalize document name
# --------------------------------------------------

def normalize_document_name(name: str) -> str:
    """
    Normalize document names for comparison.

    Example:

    'Refund Policy'
    'refund_policy'
    ' REFUND POLICY '

    all become:

    'refund policy'
    """

    if not name:
        return ""

    name = name.lower()

    # Replace underscores and hyphens with spaces
    name = name.replace("_", " ")
    name = name.replace("-", " ")

    # Remove extra whitespace
    name = " ".join(name.split())

    return name.strip()


# --------------------------------------------------
# Get latest active document IDs
# --------------------------------------------------

def get_latest_active_document_ids():
    """
    Get the document ID of the latest active version
    for every logical document.

    Example:

    Refund Policy:
        V1 -> archived
        V2 -> archived
        V3 -> active

    Result:

        {13}
    """

    db = SessionLocal()

    try:

        documents = (
            db.query(Document)
            .filter(Document.status == "active")
            .all()
        )

        latest_documents = {}

        for document in documents:

            normalized_name = normalize_document_name(
                document.document_name
            )

            if not normalized_name:
                continue

            current_document = latest_documents.get(
                normalized_name
            )

            if (
                current_document is None
                or document.version > current_document.version
            ):
                latest_documents[normalized_name] = document

        return {
            document.id
            for document in latest_documents.values()
        }

    finally:

        db.close()


# --------------------------------------------------
# Normalize customer question
# --------------------------------------------------

def normalize_question(question: str) -> str:
    """
    Normalize the question before generating the embedding.

    This helps reduce differences caused by:
    - capitalization
    - repeated punctuation
    - extra spaces
    """

    if not question:
        return ""

    question = question.lower()

    # Replace punctuation with spaces
    question = re.sub(r"[^\w\s]", " ", question)

    # Remove repeated spaces
    question = " ".join(question.split())

    return question.strip()


# --------------------------------------------------
# Main RAG function
# --------------------------------------------------

def generate_rag_answer(
    question: str,
    number_of_results: int = 3
):

    # --------------------------------------------------
    # 1. Normalize question
    # --------------------------------------------------

    normalized_question = normalize_question(question)

    if not normalized_question:

        return {
            "answer": "Please provide a valid question.",
            "sources": []
        }


    # --------------------------------------------------
    # 2. Generate embedding
    # --------------------------------------------------

    query_embedding = generate_embedding(
        normalized_question
    )


    # --------------------------------------------------
    # 3. Get latest active document IDs
    # --------------------------------------------------

    active_document_ids = (
        get_latest_active_document_ids()
    )

    if not active_document_ids:

        return {
            "answer": (
                "I could not find any active documents "
                "in the support knowledge base."
            ),
            "sources": []
        }


    # --------------------------------------------------
    # 4. Retrieve many candidates from ChromaDB
    # --------------------------------------------------
    #
    # We retrieve more candidates than requested because
    # ChromaDB does semantic ranking, while we also need
    # to apply our active-version filter.
    #
    # This prevents the correct active chunk from being
    # lost because archived/irrelevant chunks appeared
    # higher in the initial ranking.
    # --------------------------------------------------

    retrieval_count = max(
        number_of_results * 10,
        30
    )

    results = search_documents(
        query_embedding=query_embedding,
        number_of_results=retrieval_count
    )


    # --------------------------------------------------
    # 5. Extract ChromaDB results
    # --------------------------------------------------

    ids = results.get("ids", [[]])[0]
    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]


    # --------------------------------------------------
    # 6. Filter only latest active versions
    # --------------------------------------------------

    filtered_results = []

    for i in range(len(ids)):

        metadata = metadatas[i] or {}

        document_id = metadata.get(
            "document_id"
        )

        try:

            document_id = int(document_id)

        except (TypeError, ValueError):

            continue


        # Only latest active documents
        if document_id not in active_document_ids:
            continue


        filtered_results.append({
            "chunk_id": ids[i],
            "text": documents[i],
            "metadata": metadata,
            "distance": distances[i]
        })


    # --------------------------------------------------
    # 7. Sort filtered results by semantic distance
    # --------------------------------------------------

    filtered_results.sort(
        key=lambda item: item["distance"]
    )


    # Keep requested number of results
    filtered_results = filtered_results[
        :number_of_results
    ]


    # --------------------------------------------------
    # 8. No relevant active document found
    # --------------------------------------------------

    if not filtered_results:

        return {
            "answer": (
                "I could not find relevant information "
                "in the active support knowledge base."
            ),
            "sources": []
        }


    # --------------------------------------------------
    # 9. Build context
    # --------------------------------------------------

    context_parts = []
    sources = []


    for i, result in enumerate(
        filtered_results,
        start=1
    ):

        metadata = result["metadata"]

        context_parts.append(
            f"""
Source {i}

Document Name: {metadata.get("document_name")}
Document Type: {metadata.get("document_type")}
Version: {metadata.get("version")}
Page Number: {metadata.get("page_number")}

Content:
{result["text"]}
"""
        )


        sources.append({
            "chunk_id": result["chunk_id"],
            "document_name": metadata.get(
                "document_name"
            ),
            "document_type": metadata.get(
                "document_type"
            ),
            "version": metadata.get(
                "version"
            ),
            "page_number": metadata.get(
                "page_number"
            ),
            "distance": result["distance"]
        })


    context = "\n".join(context_parts)


    # --------------------------------------------------
    # 10. RAG prompt
    # --------------------------------------------------

    prompt = f"""
You are a customer support AI assistant.

Answer the customer's question using ONLY the
retrieved active support documents below.

IMPORTANT RULES:

1. Use only information explicitly present
   in the retrieved context.

2. Do not invent policies, dates, prices,
   conditions, or procedures.

3. The retrieved documents are the current
   active support documents.

4. Ignore information from outside the context.

5. If the answer cannot be found in the
   retrieved context, say:
   "The information is not available in the
   support knowledge base."

6. Keep the answer concise and customer-friendly.

7. Do not mention embeddings, ChromaDB, RAG,
   vector databases, models, or internal
   implementation details.

8. Pay close attention to numbers, dates,
   eligibility rules, and policy conditions.

9. If the context directly answers the question,
   give that answer directly.

Retrieved Active Support Documents:

{context}


Customer Question:

{question}


Provide the best answer for the customer.
"""


    # --------------------------------------------------
    # 11. Generate answer using Gemini
    # --------------------------------------------------

    answer = generate_with_gemini(prompt)


    # --------------------------------------------------
    # 12. Return answer + sources
    # --------------------------------------------------

    return {
        "answer": answer,
        "sources": sources
    }