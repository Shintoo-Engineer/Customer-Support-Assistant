import sys
from pathlib import Path

# Add the backend root directory to Python's import path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.models.database import Base, engine
from app.models.chat import ChatMessage
from app.models.user import User


print("Creating database tables...")

Base.metadata.create_all(bind=engine)

print("Database tables created successfully.")