import sys
import os
from pathlib import Path

# --------------------------------------------------
# Add backend root to Python path
# --------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent

sys.path.insert(
    0,
    str(PROJECT_ROOT)
)


# --------------------------------------------------
# Imports
# --------------------------------------------------

from app.models.database import SessionLocal
from app.models.document import Document

from app.services.ingestion_service import ingest_document

import chromadb


# --------------------------------------------------
# ChromaDB configuration
# --------------------------------------------------

CHROMA_DB_PATH = "data/chroma_db"

COLLECTION_NAME = "support_knowledge_base"


# --------------------------------------------------
# Get active documents from SQLite
# --------------------------------------------------

def get_active_documents():

    db = SessionLocal()

    try:

        documents = (
            db.query(Document)
            .filter(
                Document.status == "active"
            )
            .order_by(
                Document.document_name
            )
            .all()
        )

        return documents

    finally:

        db.close()


# --------------------------------------------------
# Main rebuild function
# --------------------------------------------------

def rebuild_active_knowledge_base():

    print("=" * 70)
    print("REBUILDING ACTIVE KNOWLEDGE BASE")
    print("=" * 70)


    # --------------------------------------------------
    # 1. Get active documents
    # --------------------------------------------------

    documents = get_active_documents()

    print(
        f"\nActive documents found in SQLite: "
        f"{len(documents)}"
    )


    if not documents:

        print(
            "\nNo active documents found."
        )

        return


    for document in documents:

        print(
            f"  ID={document.id} | "
            f"{document.document_name} | "
            f"Version={document.version} | "
            f"{document.filename}"
        )


    # --------------------------------------------------
    # 2. Verify files exist
    # --------------------------------------------------

    print("\nChecking document files...")

    valid_documents = []

    for document in documents:

        file_path = (
            PROJECT_ROOT
            / "data"
            / "documents"
            / document.filename
        )

        if not file_path.exists():

            print(
                f"  ERROR: File not found: "
                f"{document.filename}"
            )

            continue


        print(
            f"  OK: {document.filename}"
        )

        valid_documents.append(
            (
                document,
                file_path
            )
        )


    if not valid_documents:

        print(
            "\nNo valid document files found."
        )

        return


    # --------------------------------------------------
    # 3. Connect to EXISTING ChromaDB
    # --------------------------------------------------

    print(
        "\nConnecting to existing ChromaDB..."
    )

    client = chromadb.PersistentClient(
        path=str(
            PROJECT_ROOT / CHROMA_DB_PATH
        )
    )


    # --------------------------------------------------
    # 4. Get existing collection
    # --------------------------------------------------

    try:

        collection = client.get_collection(
            name=COLLECTION_NAME
        )

    except Exception:

        print(
            "\nCollection does not exist."
        )

        print(
            f"Expected collection: "
            f"{COLLECTION_NAME}"
        )

        print(
            "\nPlease start the application once "
            "so the collection is created."
        )

        return


    print(
        f"Using existing collection: "
        f"{COLLECTION_NAME}"
    )


    # --------------------------------------------------
    # 5. Show current ChromaDB count
    # --------------------------------------------------

    current_count = collection.count()

    print(
        f"Current ChromaDB chunks: "
        f"{current_count}"
    )


    # --------------------------------------------------
    # 6. Ingest active documents
    # --------------------------------------------------

    print(
        "\nStarting document ingestion..."
    )


    processed_documents = 0
    total_chunks = 0


    for document, file_path in valid_documents:

        print("\n" + "-" * 70)

        print(
            f"Document: "
            f"{document.document_name}"
        )

        print(
            f"Version: "
            f"{document.version}"
        )

        print(
            f"Database ID: "
            f"{document.id}"
        )

        print(
            f"File: "
            f"{document.filename}"
        )

        print("-" * 70)


        try:

            result = ingest_document(

                file_path=str(
                    file_path
                ),

                document_id=document.id,

                document_name=(
                    document.document_name
                ),

                document_type=(
                    document.document_type
                ),

                version=document.version,

                uploaded_by=(
                    document.uploaded_by
                )

            )


            processed_documents += 1

            chunks_created = result.get(
                "total_chunks",
                0
            )

            total_chunks += chunks_created


            print(
                f"SUCCESS: "
                f"{chunks_created} chunks created"
            )


        except Exception as error:

            print(
                f"ERROR ingesting "
                f"{document.document_name}: "
                f"{error}"
            )


    # --------------------------------------------------
    # 7. Verify ChromaDB
    # --------------------------------------------------

    print("\n" + "=" * 70)

    print(
        "VERIFYING CHROMADB"
    )

    print("=" * 70)


    final_count = collection.count()


    print(
        f"\nChromaDB collection: "
        f"{COLLECTION_NAME}"
    )

    print(
        f"Previous chunks: "
        f"{current_count}"
    )

    print(
        f"Current chunks: "
        f"{final_count}"
    )

    print(
        f"Documents processed: "
        f"{processed_documents}"
    )

    print(
        f"Chunks generated: "
        f"{total_chunks}"
    )


    # --------------------------------------------------
    # 8. Final status
    # --------------------------------------------------

    if final_count > 0:

        print("\n" + "=" * 70)

        print(
            "ACTIVE KNOWLEDGE BASE REBUILD COMPLETED"
        )

        print("=" * 70)

    else:

        print("\n" + "=" * 70)

        print(
            "WARNING: CHROMADB IS STILL EMPTY"
        )

        print("=" * 70)


# --------------------------------------------------
# Run script
# --------------------------------------------------

if __name__ == "__main__":

    rebuild_active_knowledge_base()