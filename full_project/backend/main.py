import logging
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Load .env BEFORE any module that reads os.getenv() at import time
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import _get_engine, Base
import models  # noqa: F401 - ensure models are registered
import ml_model
import mqtt_client
from routers import auth, dashboard, admin

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Creating database tables...")
    Base.metadata.create_all(bind=_get_engine())
    logger.info("Database tables ready.")

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
