'''Package initialization for model registration.

Import all model modules so that SQLAlchemy's Base metadata is aware of
each table definition when ``Base.metadata.create_all`` is called.
This ensures that test fixtures which create tables dynamically
(e.g., in ``backend/tests/conftest.py``) include all necessary tables.
'''

# Import model definitions to register them with Base metadata
from . import simulator  # noqa: F401
from . import document  # noqa: F401
from . import chat  # noqa: F401
from . import user  # noqa: F401
