import sys
from pathlib import Path
backend_dir = Path(r"c:\Users\shrushti\Customer-Support-Assistant-New\backend")
sys.path.insert(0, str(backend_dir))

from app.services.rag_service import get_latest_active_document_ids
from app.models.database import SessionLocal
from app.models.document import Document
import chromadb

ids = get_latest_active_document_ids()
print("Latest active document IDs:", ids)
db = SessionLocal()
for doc in db.query(Document).filter(Document.id.in_(ids)).all():
    print(f"ID {doc.id}: {doc.document_name} v{doc.version} ({doc.filename})")
db.close()

client = chromadb.PersistentClient(path="data/chroma_db")
col = client.get_or_create_collection(name="support_knowledge_base")
print("ChromaDB count:", col.count())
if col.count() > 0:
    sample = col.peek(limit=2)
    print("Sample metadata:", sample["metadatas"])
