"""
Part 1: Redis cache verification for rates-service.

Verifies that the second call to GET /internal/rates/rate?from=USD&to=EUR
is served from Redis cache and that the service logs a "Cache hit" message.

Why USD/EUR and not USD/UAH?
- USD/UAH is not supported by the Frankfurter API (used for integration tests).
  The Frankfurter API only covers EUR-based pairs and a limited set of majors.
- USD/EUR is a real pair that the service can fetch and cache, so this test
  exercises the full cache miss → fetch → store → cache hit cycle.

Run with:
    cd services/rates-service && python3 -m pytest tests/test_cache.py -v
"""

import json
import subprocess
from datetime import date

import httpx
import pytest

RATES_BASE_URL = "http://localhost:8006"
FROM_CURRENCY = "USD"
TO_CURRENCY = "EUR"
TODAY = date.today().isoformat()


def _fetch_rate(from_c: str, to_c: str, date_str: str | None = None) -> dict:
    """Call GET /internal/rates/rate and return the parsed JSON body."""
    params: dict[str, str] = {"from": from_c, "to": to_c}
    if date_str:
        params["date"] = date_str
    resp = httpx.get(f"{RATES_BASE_URL}/internal/rates/rate", params=params, timeout=15.0)
    resp.raise_for_status()
    return resp.json()


def _recent_service_logs(tail: int = 50) -> str:
    """Return the last `tail` lines of docker-compose logs for rates-service."""
    result = subprocess.run(
        ["docker-compose", "logs", "rates-service", f"--tail={tail}"],
        capture_output=True,
        text=True,
        cwd="/Users/yantsyferov/Desktop/Work/CoinYan",
    )
    return result.stdout + result.stderr


class TestRedisCacheHit:
    """Verify that the Redis cache layer is exercised on repeated rate requests."""

    def test_health_check(self):
        """Smoke test: service must be reachable before running cache tests."""
        resp = httpx.get(f"{RATES_BASE_URL}/health", timeout=5.0)
        assert resp.status_code == 200, f"rates-service health check failed: {resp.status_code}"

    def test_second_call_produces_cache_hit_log(self):
        """
        Call the rate endpoint twice for the same currency pair and date.

        Expected flow:
          1st call — cache miss → fetch from external API → store in Redis → return rate
          2nd call — cache hit → return from Redis, log "Cache hit for USD/EUR on <date>"

        The test asserts:
        - Both responses have HTTP 200.
        - Both responses include a non-null 'rate' field (pair is fetchable).
        - After the second call, the service logs contain a "Cache hit" message for the pair.

        Note: If the first call also produces a cache hit (because a prior test run
        already seeded the cache) the log assertion still holds — the important thing
        is that the second call hits cache.
        """
        # ── First call ────────────────────────────────────────────────────────
        body1 = _fetch_rate(FROM_CURRENCY, TO_CURRENCY, TODAY)
        assert body1.get("from") == FROM_CURRENCY
        assert body1.get("to") == TO_CURRENCY
        assert body1.get("rate") is not None, (
            "First call returned null rate — external API may be unreachable. "
            "The USD/EUR pair must be fetchable for this test to exercise the cache."
        )
        assert body1.get("stale") is False, (
            f"First call returned stale=True; rate={body1.get('rate')}. "
            "External API must be available for this test."
        )

        # ── Second call — must hit cache ──────────────────────────────────────
        body2 = _fetch_rate(FROM_CURRENCY, TO_CURRENCY, TODAY)
        assert body2.get("rate") is not None
        assert body2.get("stale") is False
        # The rate should be identical on a cache hit for the same date
        assert body1["rate"] == body2["rate"], (
            f"Rate changed between calls ({body1['rate']} vs {body2['rate']}), "
            "which is unexpected for a cached response."
        )

        # ── Check service logs for the cache hit message ──────────────────────
        logs = _recent_service_logs(tail=60)
        expected_message = f"Cache hit for {FROM_CURRENCY}/{TO_CURRENCY} on {TODAY}"
        assert expected_message in logs, (
            f"Expected log message '{expected_message}' not found in rates-service logs.\n"
            f"Captured logs:\n{logs}"
        )

    def test_stale_fallback_returns_rate_and_stale_true_for_unsupported_pair(self):
        """
        USD/UAH is not supported by the Frankfurter API.

        When the external fetch fails and no cached value exists, the service
        must return stale=True (with rate=None or a stale value).

        This test verifies the stale code path without requiring a real cached
        entry — it simply confirms the contract: on API failure, stale=True.
        """
        body = _fetch_rate("USD", "UAH", TODAY)
        assert body.get("from") == "USD"
        assert body.get("to") == "UAH"
        assert body.get("stale") is True, (
            "Expected stale=True for USD/UAH when external API cannot provide the rate."
        )

    def test_response_schema(self):
        """Rate response must contain the documented fields: from, to, date, rate, stale."""
        body = _fetch_rate(FROM_CURRENCY, TO_CURRENCY, TODAY)
        for field in ("from", "to", "date", "rate", "stale"):
            assert field in body, f"Response missing field '{field}': {body}"
        assert isinstance(body["stale"], bool), f"'stale' must be bool, got {type(body['stale'])}"
        assert body["date"] == TODAY, f"Date mismatch: expected {TODAY}, got {body['date']}"
