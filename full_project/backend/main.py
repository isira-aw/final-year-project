import logging
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Load .env BEFORE any module that reads os.getenv() at import time
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import _get_engine, _get_session_factory, Base
import models  # noqa: F401 - ensure models are registered
import auth as auth_module
import ml_model
import mqtt_client
from routers import auth, dashboard, admin

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def _ensure_admin_user() -> None:
    """Create the admin user from env vars if it doesn't already exist."""
    admin_device_id = os.getenv("ADMIN_DEVICE_ID", "admin")
    admin_password = os.getenv("ADMIN_PASSWORD", "")

    if not admin_password:
        logger.warning(
            "ADMIN_PASSWORD env var not set — skipping admin user creation. "
            "Set ADMIN_PASSWORD in your .env to enable the admin account."
        )
        return

    db = _get_session_factory()()
    try:
        existing = db.query(models.User).filter(models.User.device_id == admin_device_id).first()
        if existing is None:
            admin_user = models.User(
                device_id=admin_device_id,
                password_hash=auth_module.hash_password(admin_password),
                role="admin",
            )
            db.add(admin_user)
            db.commit()
            logger.info(f"Admin user '{admin_device_id}' created.")
        else:
            # Keep role in sync in case the row pre-dates the role column
            if existing.role != "admin":
                existing.role = "admin"
                db.commit()
            logger.info(f"Admin user '{admin_device_id}' already exists.")
    except Exception as exc:
        logger.error(f"Failed to ensure admin user: {exc}")
        db.rollback()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=_get_engine())
    logger.info("Database tables ready.")

    logger.info("Ensuring admin user exists...")
    _ensure_admin_user()

    logger.info("Loading ML model...")
    ml_model.get_model()
    logger.info("ML model ready.")

    logger.info("Starting MQTT subscriber...")
    mqtt_client.start_mqtt_client()
    logger.info("MQTT subscriber started.")

    yield

    # Shutdown
    logger.info("Shutting down MQTT client...")
    mqtt_client.stop_mqtt_client()
    logger.info("Shutdown complete.")


app = FastAPI(
    title="Telecom Tower Fault Detection API",
    description="AI-Powered Fault Detection & Predictive Maintenance System for Telecom Towers",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:8080,http://127.0.0.1:3000",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(admin.router)


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": "Telecom Fault Detection API", "version": "1.0.0"}


@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}
