"""
Inspect ChromaDB Knowledge Base Documents and Chunks in detail
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.vector_service import collection

def inspect_details():
    data = collection.get(include=["documents", "metadatas"])
    ids = data["ids"]
    docs = data["documents"]
    metadatas = data["metadatas"]

    seen = set()
    for chunk_id, text, meta in zip(ids, docs, metadatas):
        doc_name = meta.get("document_name") or meta.get("source") or "Unknown"
        page = meta.get("page", "?")
        key = (doc_name, page)
        if key not in seen:
            seen.add(key)
            print(f"--- DOC: {doc_name} (Page: {page}, Chunk: {chunk_id}) ---")
            lines = [l.strip() for l in text.split("\n") if l.strip()]
            for l in lines[:6]:
                print("  ", l)
            print()

if __name__ == "__main__":
    inspect_details()
