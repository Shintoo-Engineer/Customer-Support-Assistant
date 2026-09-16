from app.models.database import Base, engine
from app.models.simulator import Scenario, Session, Conversation, Message


print("Creating simulator tables...")

Base.metadata.create_all(bind=engine)

print("Simulator tables created successfully.")
