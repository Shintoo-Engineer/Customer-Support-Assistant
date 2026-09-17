import chromadb


# Create persistent ChromaDB client
client = chromadb.PersistentClient(
    path="data/chroma_db"
)


# Create or load our knowledge base collection
collection = client.get_or_create_collection(
    name="support_knowledge_base"
)


def add_document_chunk(
    chunk_id: str,
    text: str,
    embedding: list,
    metadata: dict
):
    """
    Store a document chunk, its embedding,
    and metadata in ChromaDB.
    """

    collection.add(
        ids=[chunk_id],
        documents=[text],
        embeddings=[embedding],
        metadatas=[metadata]
    )


def search_documents(
    query_embedding: list,
    number_of_results: int = 3
):
    """
    Search for the most semantically relevant
    document chunks.
    """

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=number_of_results
    )

    return results