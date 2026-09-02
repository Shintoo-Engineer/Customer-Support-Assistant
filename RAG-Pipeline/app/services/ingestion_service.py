from pathlib import Path

from app.services.pdf_service import extract_text_from_pdf
from app.services.text_service import clean_text, create_chunks
from app.services.embedding_service import generate_embedding
from app.services.vector_service import add_document_chunk


def ingest_document(
    file_path: str,
    document_id: int,
    document_name: str,
    document_type: str,
    version: int,
    uploaded_by: str
):
    """
    Complete document ingestion pipeline.

    PDF
    → Text Extraction
    → Cleaning
    → Chunking
    → Embeddings
    → ChromaDB
    """

    # Step 1: Extract text page by page
    pages = extract_text_from_pdf(file_path)

    total_chunks = 0

    # Process every page
    for page in pages:

        page_number = page["page_number"]
        page_text = page["text"]

        # Step 2: Clean text
        cleaned_text = clean_text(page_text)

        # Skip empty pages
        if not cleaned_text:
            continue

        # Step 3: Create chunks
        chunks = create_chunks(cleaned_text)

        # Process every chunk
        for chunk_index, chunk in enumerate(chunks, start=1):

            # Step 4: Generate embedding
            embedding = generate_embedding(chunk)

            # Unique ID for ChromaDB
            chunk_id = (
                f"doc_{document_id}"
                f"_v{version}"
                f"_p{page_number}"
                f"_c{chunk_index}"
            )

            # Step 5: Store in ChromaDB
            add_document_chunk(
                chunk_id=chunk_id,
                text=chunk,
                embedding=embedding,
                metadata={
                    "document_id": document_id,
                    "document_name": document_name,
                    "document_type": document_type,
                    "version": version,
                    "page_number": page_number,
                    "uploaded_by": uploaded_by
                }
            )

            total_chunks += 1

    return {
        "document_id": document_id,
        "document_name": document_name,
        "version": version,
        "total_pages": len(pages),
        "total_chunks": total_chunks
    }