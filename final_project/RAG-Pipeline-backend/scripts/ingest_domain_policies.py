import os
import sys
from pathlib import Path

# Add backend root to Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.models.database import SessionLocal, Base, engine
from app.models.document import Document
from app.services.ingestion_service import ingest_document

POLICIES_TO_INGEST = [
    {
        "filename": "Payment_policy_v1.pdf",
        "doc_name": "Payment Policy",
        "doc_type": "policy",
        "version": 1,
    },
    {
        "filename": "Delivery_policy_v1.pdf",
        "doc_name": "Delivery Policy",
        "doc_type": "policy",
        "version": 1,
    },
    {
        "filename": "Cancel_policy_v1.pdf",
        "doc_name": "Cancellation Policy",
        "doc_type": "policy",
        "version": 1,
    },
    {
        "filename": "Return_policy_v1.pdf",
        "doc_name": "Return and Exchange Policy",
        "doc_type": "policy",
        "version": 1,
    },
    {
        "filename": "Fraud_policy_v1.pdf",
        "doc_name": "Fraud and Security Policy",
        "doc_type": "policy",
        "version": 1,
    },
    {
        "filename": "Order_policy_v1.pdf",
        "doc_name": "Order Management Policy",
        "doc_type": "policy",
        "version": 1,
    },
    {
        "filename": "FAQ__v1.pdf",
        "doc_name": "General Support FAQ",
        "doc_type": "faq",
        "version": 1,
    },
]

def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for item in POLICIES_TO_INGEST:
            file_path = os.path.join("data", "documents", item["filename"])
            if not os.path.exists(file_path):
                print(f"File not found: {file_path}")
                continue

            existing = db.query(Document).filter(Document.document_name == item["doc_name"]).first()
            if existing:
                print(f"Document already in DB: {item['doc_name']} (id={existing.id})")
                doc_id = existing.id
            else:
                doc = Document(
                    document_name=item["doc_name"],
                    filename=item["filename"],
                    document_type=item["doc_type"],
                    version=item["version"],
                    status="active",
                    uploaded_by="admin@company.com"
                )
                db.add(doc)
                db.commit()
                db.refresh(doc)
                doc_id = doc.id
                print(f"Created Document record: {item['doc_name']} (id={doc_id})")

            # Run ingestion
            res = ingest_document(
                file_path=file_path,
                document_id=doc_id,
                document_name=item["doc_name"],
                document_type=item["doc_type"],
                version=item["version"],
                uploaded_by="admin@company.com"
            )
            print(f"Ingested {item['doc_name']}: {res['total_pages']} pages, {res['total_chunks']} chunks")

    finally:
        db.close()

if __name__ == "__main__":
    run()
