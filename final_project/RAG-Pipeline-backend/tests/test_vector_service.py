from app.services.embedding_service import generate_embedding
from app.services.vector_service import add_document_chunk, search_documents


# Sample support knowledge
text = """
Customers may request a refund within 15 calendar days
of the original purchase date.
"""


# Generate embedding
embedding = generate_embedding(text)


# Store the chunk
add_document_chunk(
    chunk_id="test_refund_chunk_1",
    text=text,
    embedding=embedding,
    metadata={
        "document_id": 1,
        "document_name": "Refund Policy",
        "document_type": "policy",
        "version": 1,
        "page_number": 1,
        "uploaded_by": "admin"
    }
)


print("Document chunk stored successfully.")


# Create a query
query = "How many days do I have to request a refund?"

query_embedding = generate_embedding(query)


# Search ChromaDB
results = search_documents(
    query_embedding=query_embedding,
    number_of_results=1
)


print("\nSEARCH RESULT:")
print(results)