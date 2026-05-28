from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from app.services.rate_cache import get_cached_rate, get_stale_rate, set_cached_rate
from app.services.rate_fetcher import fetch_rate

router = APIRouter(prefix="/internal/rates", tags=["Rates"], redirect_slashes=False)


class RateResponse(BaseModel):
    from_currency: str = Field(alias="from", serialization_alias="from")
    to_currency: str = Field(alias="to", serialization_alias="to")
    date: str
    rate: Optional[float]
    stale: bool

    model_config = {"populate_by_name": True}


def _resolved_date(date_str: Optional[str]) -> str:
    if date_str:
        return date_str
    return datetime.now(tz=timezone.utc).date().isoformat()


@router.get(
    "/rate",
    response_model=RateResponse,
    response_model_by_alias=True,
    status_code=200,
    summary="Get exchange rate between two currencies",
)
async def get_rate(
    from_currency: str = Query(..., alias="from"),
    to_currency: str = Query(..., alias="to"),
    date: Optional[str] = Query(None),
) -> RateResponse:
    resolved_date = _resolved_date(date)

    # 1. Cache hit — return immediately.
    cached = await get_cached_rate(from_currency, to_currency, resolved_date)
    if cached is not None:
        return RateResponse(
            from_currency=from_currency,
            to_currency=to_currency,
            date=resolved_date,
            rate=cached,
            stale=False,
        )

    # 2. Cache miss — call external API.
    rate, stale = await fetch_rate(from_currency, to_currency, resolved_date)

    if rate is not None:
        # Store in cache; fire-and-forget failures are acceptable (logged inside).
        await set_cached_rate(from_currency, to_currency, resolved_date, rate)
        return RateResponse(
            from_currency=from_currency,
            to_currency=to_currency,
            date=resolved_date,
            rate=rate,
            stale=False,
        )

    # 3. API failure — attempt stale fallback from Redis.
    stale_rate = await get_stale_rate(from_currency, to_currency)
    return RateResponse(
        from_currency=from_currency,
        to_currency=to_currency,
        date=resolved_date,
        rate=stale_rate,
        stale=True,
    )
