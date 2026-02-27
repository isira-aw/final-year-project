import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

Base = declarative_base()

# Engine is built lazily so that load_dotenv() in main.py runs first.
# Never read DATABASE_URL at module import time.
_engine = None
_SessionLocal = None


def _get_engine():
    global _engine
    if _engine is None:
        url = os.getenv(
            "DATABASE_URL",
            "postgresql://postgres:password@localhost:5432/telecom_iot",
        )
        _engine = create_engine(url)
    return _engine


def _get_session_factory():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_get_engine())
    return _SessionLocal


# Provide module-level `engine` and `Base` used in main.py / models.py.
# `engine` is a proxy that resolves on first access.
class _EngineProxy:
    """Thin proxy so that `from database import engine` still works."""

    def __getattr__(self, name):
        return getattr(_get_engine(), name)

    def __repr__(self):
        return repr(_get_engine())


engine = _EngineProxy()


def get_db():
    db = _get_session_factory()()
    try:
        yield db
    finally:
        db.close()
