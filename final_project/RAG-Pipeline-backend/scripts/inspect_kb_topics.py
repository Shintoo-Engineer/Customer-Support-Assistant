"""
Print all pages and topics in ChromaDB
"""
import sys
import os
import re
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.vector_service import collection

def list_all_topics():
    data = collection.get(include=["documents", "metadatas"])
    
    docs_by_name = {}
    for chunk_id, text, meta in zip(data["ids"], data["documents"], data["metadatas"]):
        name = meta.get("document_name") or meta.get("source") or "Unknown"
        if name not in docs_by_name:
            docs_by_name[name] = []
        
        # Look for "Page X: Topic" pattern
        m = re.search(r"Page (\d+):\s*([^\.\n\?]+)", text)
        page_info = m.group(0) if m else "No page header"
        docs_by_name[name].append((chunk_id, page_info, text[:160].replace("\n", " ")))

    for name, chunks in sorted(docs_by_name.items()):
        print(f"==================================================")
        print(f"DOCUMENT: {name} ({len(chunks)} chunks)")
        print(f"==================================================")
        seen_pages = set()
        for cid, pinfo, snip in chunks:
            if pinfo not in seen_pages:
                seen_pages.add(pinfo)
                print(f"  * {pinfo} (sample id: {cid})")
                print(f"    Snippet: {snip}...")
        print()

if __name__ == "__main__":
    list_all_topics()
