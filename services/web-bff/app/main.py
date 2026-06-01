import sys
from contextlib import asynccontextmanager
from typing import Any

import httpx
import redis.asyncio as aioredis
import sentry_sdk
from fastapi import FastAPI, HTTPException, Query, Request, Response
from strawberry.fastapi import GraphQLRouter
from loguru import logger

from app.config import settings
from app.routers import health
from app.schema import schema

logger.remove()
logger.add(sys.stdout, serialize=True, level="INFO")

if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        traces_sample_rate=0.1,
        enable_tracing=True,
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.redis = aioredis.from_url(settings.REDIS_URL, decode_responses=False)
    yield
    await app.state.redis.aclose()


app = FastAPI(
    title="web-bff",
    version="0.1.0",
    description="CoinYan Web Backend-for-Frontend (GraphQL gateway)",
    lifespan=lifespan,
)


async def get_context(request: Request, response: Response) -> dict[str, Any]:
    return {"request": request, "response": response, "redis": request.app.state.redis}


graphql_router = GraphQLRouter(schema, context_getter=get_context, graphql_ide="graphiql")

app.include_router(health.router)
app.include_router(graphql_router, prefix="/graphql")


@app.get("/exchange-rate")
async def exchange_rate(from_currency: str = Query(..., alias="from"), to: str = Query(...)):
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.frankfurter.app/latest",
            params={"from": from_currency, "to": to},
            headers={"User-Agent": "CoinYan/1.0"},
            timeout=5.0,
            follow_redirects=True,
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Exchange rate service unavailable")
    data = resp.json()
    rate = data["rates"].get(to)
    if rate is None:
        raise HTTPException(status_code=404, detail=f"Rate for {to} not found")
    return {"from": from_currency, "to": to, "rate": rate}
