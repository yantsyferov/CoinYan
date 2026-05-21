import asyncio
import sys
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor

import sentry_sdk
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from loguru import logger

from app.config import settings
from app.routers import health, transactions

logger.remove()
logger.add(sys.stdout, serialize=True, level="INFO")

if settings.SENTRY_DSN:
    sentry_sdk.init(dsn=settings.SENTRY_DSN, traces_sample_rate=0.1, enable_tracing=True)


def _run_migrations() -> None:
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    loop = asyncio.get_running_loop()
    with ThreadPoolExecutor(max_workers=1) as pool:
        await loop.run_in_executor(pool, _run_migrations)
    yield


app = FastAPI(
    title="transactions-service",
    version="0.1.0",
    description="CoinYan transactions microservice",
    lifespan=lifespan,
)

app.include_router(health.router)
app.include_router(transactions.router)
