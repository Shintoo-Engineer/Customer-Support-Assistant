from app.models.database import Base, engine
from app.models.chat import ChatMessage


print("Creating chat_messages table...")

Base.metadata.create_all(bind=engine)

print("Chat table created successfully.")