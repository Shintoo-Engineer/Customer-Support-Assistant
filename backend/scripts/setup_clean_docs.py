import sys
from pathlib import Path
backend_dir = Path(r"c:\Users\shrushti\Customer-Support-Assistant-New\backend")
sys.path.insert(0, str(backend_dir))

from app.models.database import SessionLocal, Base, engine
from app.models.document import Document
from app.services.ingestion_service import ingest_document

db = SessionLocal()

# We need to map real existing PDFs to active documents in DB
# Let's inspect the files in data/documents
docs_dir = backend_dir / "data" / "documents"
pdf_files = list(docs_dir.glob("*.pdf"))
print("Available PDF files:", [f.name for f in pdf_files])

# Clear all old documents in SQLite to have a clean, pristine set of documents
db.query(Document).delete()
db.commit()

# Clean document catalogue for the project requirements:
catalog = [
    {
        "filename": "Payment_policy_v1.pdf",
        "document_name": "Payment Policy",
        "document_type": "policy",
        "version": 1,
    },
    {
        "filename": "Delivery_policy_v1.pdf",
        "document_name": "Delivery Policy",
        "document_type": "policy",
        "version": 1,
    },
    {
        "filename": "refund_policy_v2.pdf",
        "document_name": "Refund Policy",
        "document_type": "policy",
        "version": 1,
    },
    {
        "filename": "Return_policy_v1.pdf",
        "document_name": "Return and Exchange Policy",
        "document_type": "policy",
        "version": 1,
    },
    {
        "filename": "replacement_policy_v1.pdf",
        "document_name": "Replacement Policy",
        "document_type": "policy",
        "version": 1,
    },
    {
        "filename": "Cancel_policy_v1.pdf",
        "document_name": "Cancellation Policy",
        "document_type": "policy",
        "version": 1,
    },
    {
        "filename": "Order_policy_v1.pdf",
        "document_name": "Order Policy",
        "document_type": "policy",
        "version": 1,
    },
    {
        "filename": "login_account_issue_v1.pdf",
        "document_name": "Account and Login Support FAQ",
        "document_type": "faq",
        "version": 1,
    },
    {
        "filename": "FaQ_v1.pdf",
        "document_name": "General Support FAQ",
        "document_type": "faq",
        "version": 1,
    }
]

created_docs = []
for item in catalog:
    file_path = docs_dir / item["filename"]
    if not file_path.exists():
        print(f"WARNING: {file_path} not found!")
        continue
    
    doc = Document(
        filename=item["filename"],
        document_name=item["document_name"],
        document_type=item["document_type"],
        version=item["version"],
        uploaded_by="admin",
        status="active"
    )
    db.add(doc)
    db.flush()
    created_docs.append((doc.id, doc.document_name, doc.document_type, doc.version, str(file_path)))

db.commit()
print(f"Created {len(created_docs)} active documents in DB:")
for d in created_docs:
    print(f"  ID {d[0]}: {d[1]} (type: {d[2]}, v{d[3]}) -> {d[4]}")

# Now ingest each document into ChromaDB!
print("\n--- Ingesting into ChromaDB ---")
for doc_id, doc_name, doc_type, version, file_path in created_docs:
    print(f"Ingesting ID {doc_id}: {doc_name}...")
    res = ingest_document(
        file_path=file_path,
        document_id=doc_id,
        document_name=doc_name,
        document_type=doc_type,
        version=version,
        uploaded_by="admin"
    )
    print(f"  -> Total pages: {res['total_pages']}, Chunks: {res['total_chunks']}")

db.close()
print("\nIngestion complete!")
