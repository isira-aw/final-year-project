import logging
import os
from pathlib import Path
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# ── Load .env ─────────────────────────────────────────────────────────────────
# Always resolve relative to THIS FILE so the location is independent of
# which directory uvicorn is started from.
_ENV_FILE = Path(__file__).resolve().parent / ".env"
_loaded = load_dotenv(dotenv_path=_ENV_FILE, verbose=False)

# Bootstrap logging early so env-load status is visible in the console
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

if _loaded:
    logger.info(f".env loaded from: {_ENV_FILE}")
else:
    logger.warning(
        f".env NOT found at {_ENV_FILE} — "
        "copy .env.example → .env and set DATABASE_URL / ADMIN_PASSWORD."
    )

# ── App imports (after dotenv so os.getenv() picks up values) ─────────────────
from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from database import _get_engine, _get_session_factory, Base  # noqa: E402
import models  # noqa: F401,E402  — registers ORM models with Base
import auth as auth_module  # noqa: E402
import ml_model  # noqa: E402
import mqtt_client  # noqa: E402
from routers import auth, dashboard, admin  # noqa: E402


# ── Admin bootstrap ───────────────────────────────────────────────────────────

def _ensure_admin_user() -> None:
    """Create the admin user from env vars if it doesn't already exist."""
    admin_device_id = os.getenv("ADMIN_DEVICE_ID", "admin")
    admin_password = os.getenv("ADMIN_PASSWORD", "")

    if not admin_password:
        logger.warning(
            "ADMIN_PASSWORD not set — skipping admin user creation. "
            "Set ADMIN_PASSWORD in your .env to enable the admin account."
        )
        return

    db = _get_session_factory()()
    try:
        existing = db.query(models.User).filter(
            models.User.device_id == admin_device_id
        ).first()

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
            if existing.role != "admin":
                existing.role = "admin"
                db.commit()
            logger.info(f"Admin user '{admin_device_id}' already exists.")

    except Exception as exc:
        logger.error(f"Failed to ensure admin user: {exc}")
        db.rollback()
    finally:
        db.close()


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
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

    logger.info("Shutting down MQTT client...")
    mqtt_client.stop_mqtt_client()
    logger.info("Shutdown complete.")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Telecom Tower Fault Detection API",
    description="AI-Powered Fault Detection & Predictive Maintenance System for Telecom Towers",
    version="1.0.0",
    lifespan=lifespan,
)

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

app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(admin.router)


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "service": "Telecom Fault Detection API", "version": "1.0.0"}


@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}
