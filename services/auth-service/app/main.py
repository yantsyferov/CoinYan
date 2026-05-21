import sys

import sentry_sdk
from fastapi import FastAPI
from loguru import logger

from app.config import settings
from app.routers import auth, health

logger.remove()
logger.add(sys.stdout, serialize=True, level="INFO")

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=0.1,
        enable_tracing=True,
    )

app = FastAPI(
    title="auth-service",
    version="0.1.0",
    description="CoinYan authentication microservice",
)

app.include_router(health.router)
app.include_router(auth.router)
