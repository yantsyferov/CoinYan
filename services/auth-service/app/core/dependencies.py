from collections.abc import AsyncGenerator

import redis.asyncio as aioredis
from fastapi import Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.core.security import decode_access_token

_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
)

_async_session_factory: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

_redis_pool = aioredis.ConnectionPool.from_url(
    settings.REDIS_URL,
    decode_responses=True,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with _async_session_factory() as session:
        yield session


async def get_redis() -> AsyncGenerator[aioredis.Redis, None]:
    client = aioredis.Redis(connection_pool=_redis_pool)
    try:
        yield client
    finally:
        await client.aclose()


async def get_current_user_id(authorization: str = Header(...)) -> str:
    """Extract and validate the Bearer token; return the ``sub`` claim (user_id).

    Raises HTTP 401 if the header is missing, malformed, or the token is
    invalid or expired.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header",
        )
    token = authorization.removeprefix("Bearer ")
    try:
        payload = decode_access_token(token)
        return payload["sub"]
    except (ValueError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
