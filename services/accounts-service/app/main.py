import asyncio
import sys
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta

import sentry_sdk
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from loguru import logger

from app.config import settings
from app.routers import accounts, health

logger.remove()
logger.add(sys.stdout, serialize=True, level="INFO")

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=0.1,
        enable_tracing=True,
    )


def _run_migrations() -> None:
    """Run Alembic migrations synchronously in a worker thread.

    env.py calls asyncio.run() internally, which requires a thread without a
    running event loop — hence we execute this via run_in_executor.
    """
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")


async def _cleanup_expired_accounts() -> None:
    """Delete accounts whose 30-day recovery window has elapsed.

    Runs once per day in the background. Creates its own engine/session so it
    does not contend with the request-scoped session pool.
    """
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    from sqlalchemy import delete
    from app.models.account import Account

    while True:
        await asyncio.sleep(86400)  # run once per day
        try:
            engine = create_async_engine(settings.DATABASE_URL, echo=False)
            session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
            async with session_factory() as session:
                cutoff = datetime.now(timezone.utc) - timedelta(days=30)
                await session.execute(
                    delete(Account).where(
                        Account.status != "active",
                        Account.deleted_at < cutoff,
                    )
                )
                await session.commit()
            await engine.dispose()
        except Exception as exc:
            logger.error(f"Cleanup task error: {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    loop = asyncio.get_running_loop()
    with ThreadPoolExecutor(max_workers=1) as pool:
        await loop.run_in_executor(pool, _run_migrations)
    task = asyncio.create_task(_cleanup_expired_accounts())
    yield
    task.cancel()


app = FastAPI(
    title="accounts-service",
    version="0.1.0",
    description="CoinYan accounts microservice",
    lifespan=lifespan,
)

app.include_router(health.router)
app.include_router(accounts.router)
