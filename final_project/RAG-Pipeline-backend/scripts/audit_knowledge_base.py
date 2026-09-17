"""
Audit script to inspect actual knowledge base across ChromaDB, SQLite, and filesystem.
"""
import sys
import os
import glob

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import chromadb
from app.models.database import SessionLocal
from app.models.document import Document
from app.services.embedding_service import MODEL_NAME

def audit_kb():
    print("=" * 80)
    print("KNOWLEDGE BASE AUDIT")
    print("=" * 80)

    # 1. Embedding Model
    print(f"Embedding Model: {MODEL_NAME}")

    # 2. ChromaDB Inspection
    client = chromadb.PersistentClient(path="data/chroma_db")
    cols = client.list_collections()
    col_names = [c.name for c in cols]
    print(f"ChromaDB Collections ({len(cols)}): {col_names}")

    active_col_name = "support_knowledge_base"
    if active_col_name in col_names:
        col = client.get_collection(active_col_name)
        data = col.get(include=["documents", "metadatas"])
        ids = data["ids"]
        metas = data["metadatas"]
        print(f"\nActive Collection: '{active_col_name}'")
        print(f"Total Chunks in ChromaDB: {len(ids)}")
        
        doc_counts = {}
        meta_keys = set()
        for m in metas:
            if m:
                meta_keys.update(m.keys())
                name = m.get("document_name") or m.get("source") or "Unknown"
                doc_counts[name] = doc_counts.get(name, 0) + 1

        print(f"Metadata Fields Present: {sorted(list(meta_keys))}")
        print(f"Unique Indexed Document Names in ChromaDB ({len(doc_counts)}):")
        for name, count in sorted(doc_counts.items()):
            print(f"  - '{name}': {count} chunks")
    else:
        print(f"WARNING: Active collection '{active_col_name}' not found!")

    # 3. SQLite Database Documents Table
    db = SessionLocal()
    try:
        db_docs = db.query(Document).all()
        print(f"\nSQLite Documents Table: {len(db_docs)} total document rows")
        active_db_docs = [d for d in db_docs if d.status.lower() == "active"]
        print(f"Active SQLite Documents: {len(active_db_docs)} rows")
        for d in db_docs:
            print(f"  - ID: {d.id}, Filename: '{d.filename}', DocName: '{d.document_name}', Type: {d.document_type}, Version: {d.version}, Status: {d.status}")
    finally:
        db.close()

    # 4. Filesystem PDF / Document files
    print("\nFilesystem Document Files:")
    for ext in ["*.pdf", "*.txt", "*.md"]:
        for root, dirs, files in os.walk("data"):
            for f in files:
                if f.endswith(ext.replace("*", "")):
                    fpath = os.path.join(root, f)
                    print(f"  - {fpath} ({os.path.getsize(fpath)} bytes)")

    print("=" * 80)

if __name__ == "__main__":
    audit_kb()
