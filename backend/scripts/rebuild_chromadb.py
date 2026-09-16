import sys
from pathlib import Path

# Add project root to Python path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from app.services.ingestion_service import ingest_document

# --------------------------------------------------
# Existing documents
# --------------------------------------------------
# These documents already exist in data/documents.
# We are NOT uploading them again.
#
# We are only rebuilding their vectors in the
# newly recreated ChromaDB.
# --------------------------------------------------

documents = [
    {
        "file_path": "data/documents/refund_policy_v1.pdf",
        "document_id": 11,
        "document_name": "Refund Policy",
        "document_type": "Policy",
        "version": 1,
        "uploaded_by": "admin"
    },
    {
        "file_path": "data/documents/refund_policy_v2.pdf",
        "document_id": 12,
        "document_name": "Refund Policy",
        "document_type": "Policy",
        "version": 2,
        "uploaded_by": "admin"
    },
    {
        "file_path": "data/documents/refund_policy_v3.pdf",
        "document_id": 13,
        "document_name": "Refund Policy",
        "document_type": "Policy",
        "version": 3,
        "uploaded_by": "admin"
    }
]


# --------------------------------------------------
# Rebuild ChromaDB
# --------------------------------------------------

for document in documents:

    print("\n" + "=" * 60)

    print(
        f"Ingesting {document['document_name']} "
        f"- Version {document['version']}"
    )

    print("=" * 60)

    result = ingest_document(
        file_path=document["file_path"],
        document_id=document["document_id"],
        document_name=document["document_name"],
        document_type=document["document_type"],
        version=document["version"],
        uploaded_by=document["uploaded_by"]
    )

    print("\nINGESTION RESULT:")
    print(result)


print("\n" + "=" * 60)
print("CHROMADB REBUILD COMPLETED")
print("=" * 60)