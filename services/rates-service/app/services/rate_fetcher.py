from datetime import date, timezone, datetime
from typing import Optional

import httpx
from loguru import logger

from app.config import settings

_TIMEOUT = httpx.Timeout(5.0)
_OXR_LATEST_URL = "https://openexchangerates.org/api/latest.json"
_FRANKFURTER_LATEST_URL = "https://api.frankfurter.dev/v1/latest"
_FRANKFURTER_HISTORICAL_URL = "https://api.frankfurter.dev/v1/{date}"


def _today() -> date:
    return datetime.now(tz=timezone.utc).date()


def _is_historical(date_str: Optional[str]) -> bool:
    if date_str is None:
        return False
    try:
        return date.fromisoformat(date_str) < _today()
    except ValueError:
        return False


async def _fetch_frankfurter_historical(from_currency: str, to_currency: str, date_str: str) -> Optional[float]:
    url = _FRANKFURTER_HISTORICAL_URL.format(date=date_str)
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True) as client:
            resp = await client.get(url, params={"from": from_currency, "to": to_currency})
            resp.raise_for_status()
            data = resp.json()
            return float(data["rates"][to_currency])
    except Exception as exc:
        logger.warning(f"Frankfurter historical fetch failed for {from_currency}/{to_currency} on {date_str}: {exc}")
        return None


async def _fetch_frankfurter_latest(from_currency: str, to_currency: str) -> Optional[float]:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True) as client:
            resp = await client.get(_FRANKFURTER_LATEST_URL, params={"from": from_currency, "to": to_currency})
            resp.raise_for_status()
            data = resp.json()
            return float(data["rates"][to_currency])
    except Exception as exc:
        logger.warning(f"Frankfurter latest fetch failed for {from_currency}/{to_currency}: {exc}")
        return None


async def _fetch_oxr_latest(from_currency: str, to_currency: str) -> Optional[float]:
    if not settings.OPEN_EXCHANGE_RATES_APP_ID:
        return None

    symbols = to_currency if from_currency == "USD" else f"{from_currency},{to_currency}"
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT, follow_redirects=True) as client:
            resp = await client.get(
                _OXR_LATEST_URL,
                params={"app_id": settings.OPEN_EXCHANGE_RATES_APP_ID, "symbols": symbols},
            )
            resp.raise_for_status()
            data = resp.json()
            rates = data["rates"]
            if from_currency == "USD":
                return float(rates[to_currency])
            # Both from and to are non-USD; cross-rate via USD base
            return float(rates[to_currency]) / float(rates[from_currency])
    except Exception as exc:
        logger.warning(f"OXR latest fetch failed for {from_currency}/{to_currency}: {exc}")
        return None


async def fetch_rate(
    from_currency: str,
    to_currency: str,
    date_str: Optional[str],
) -> tuple[Optional[float], bool]:
    """Return (rate, stale).

    stale=True means the rate could not be fetched from any source.
    stale=False means the rate is fresh (or exact 1.0 for same-currency).
    """
    if from_currency == to_currency:
        return 1.0, False

    if _is_historical(date_str):
        rate = await _fetch_frankfurter_historical(from_currency, to_currency, date_str)
        if rate is None:
            return None, True
        return rate, False

    # Current rate: try OXR first, fall back to Frankfurter
    rate = await _fetch_oxr_latest(from_currency, to_currency)
    if rate is not None:
        return rate, False

    rate = await _fetch_frankfurter_latest(from_currency, to_currency)
    if rate is not None:
        return rate, False

    return None, True
