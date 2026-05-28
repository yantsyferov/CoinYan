"""Async Redis helpers for exchange rate caching."""

import json
from datetime import date
from typing import Optional

import redis.asyncio as aioredis
from loguru import logger

from app.config import settings


def _cache_key(from_currency: str, to_currency: str, rate_date: str) -> str:
    return f"rate:{from_currency}:{to_currency}:{rate_date}"


def _ttl(rate_date: str) -> int:
    today = date.today().isoformat()
    # Historical rates are immutable — cache for 30 days.
    # Today's rate may change — cache for 1 hour.
    return 3600 if rate_date == today else 2592000


async def get_cached_rate(
    from_currency: str,
    to_currency: str,
    rate_date: str,
) -> Optional[float]:
    """Return the cached rate for the given pair and date, or None on cache miss."""
    key = _cache_key(from_currency, to_currency, rate_date)
    try:
        client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        async with client:
            value = await client.get(key)
            if value is not None:
                logger.info(
                    f"Cache hit for {from_currency}/{to_currency} on {rate_date}",
                    extra={"key": key},
                )
                return float(json.loads(value))
    except Exception as exc:
        logger.warning(f"Redis get failed for key {key}: {exc}")
    return None


async def set_cached_rate(
    from_currency: str,
    to_currency: str,
    rate_date: str,
    rate: float,
) -> None:
    """Store the rate in Redis with a TTL appropriate for the date."""
    key = _cache_key(from_currency, to_currency, rate_date)
    ttl = _ttl(rate_date)
    try:
        client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        async with client:
            await client.set(key, json.dumps(rate), ex=ttl)
            logger.info(
                f"Cached rate {rate} for {from_currency}/{to_currency} on {rate_date} (TTL={ttl}s)",
                extra={"key": key, "ttl": ttl},
            )
    except Exception as exc:
        logger.warning(f"Redis set failed for key {key}: {exc}")


async def get_stale_rate(
    from_currency: str,
    to_currency: str,
) -> Optional[float]:
    """Scan Redis for any cached rate for this currency pair (any date).

    Returns the value of the first matching key found, or None if nothing is
    cached for the pair at all.  The exact date does not matter here — this is
    a last-resort fallback when the external API is unreachable.
    """
    pattern = f"rate:{from_currency}:{to_currency}:*"
    try:
        client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        async with client:
            cursor = 0
            while True:
                cursor, keys = await client.scan(cursor, match=pattern, count=100)
                if keys:
                    value = await client.get(keys[0])
                    if value is not None:
                        logger.info(
                            f"Stale cache fallback: returning {keys[0]} for {from_currency}/{to_currency}",
                            extra={"key": keys[0]},
                        )
                        return float(json.loads(value))
                if cursor == 0:
                    break
    except Exception as exc:
        logger.warning(f"Redis scan failed for pattern {pattern}: {exc}")
    return None
