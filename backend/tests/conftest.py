import os
import pytest
import tempfile
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Import the module that defines SessionLocal and Base
from app.models import database as db_module

# Create a temporary file‑based SQLite database that can be shared across multiple connections.
# Using StaticPool ensures the same connection is reused, avoiding "database is locked" errors.
_temp_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
TEST_DATABASE_URL = f"sqlite:///{_temp_file.name}"
engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Create tables in the temporary SQLite DB and patch SessionLocal.
    This fixture runs once per test session and ensures that every
    FastAPI request uses the same isolated database engine.
    """
    # Create tables
    db_module.Base.metadata.create_all(bind=engine)
    # Preserve the original SessionLocal to restore later
    original_session_local = db_module.SessionLocal
    # Patch the module's SessionLocal to the test one
    db_module.SessionLocal = TestingSessionLocal
    yield
    # Restore original after the test run
    db_module.SessionLocal = original_session_local
    # Clean up the temporary file
    try:
        os.remove(_temp_file.name)
    except OSError:
        pass
