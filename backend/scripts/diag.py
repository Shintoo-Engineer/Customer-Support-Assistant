import sys, os
from pathlib import Path
print("1: Starting diag", flush=True)

backend_dir = Path(r"c:\Users\shrushti\Customer-Support-Assistant-New\backend")
sys.path.insert(0, str(backend_dir))
print("2: Path added", flush=True)

from dotenv import load_dotenv
load_dotenv()
print("3: Dotenv loaded, GEMINI_API_KEY is:", bool(os.getenv("GEMINI_API_KEY")), flush=True)

print("4: Importing sentence_transformers...", flush=True)
from sentence_transformers import SentenceTransformer
print("5: sentence_transformers imported", flush=True)

print("6: Importing chromadb...", flush=True)
import chromadb
print("7: chromadb imported", flush=True)

print("8: Importing genai...", flush=True)
from google import genai
print("9: genai imported", flush=True)

api_key = os.getenv("GEMINI_API_KEY")
print("10: Creating genai.Client...", flush=True)
client = genai.Client(api_key=api_key)
print("11: genai.Client created successfully", flush=True)
