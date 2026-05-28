import sys

from fastapi import FastAPI
from loguru import logger

from app.routers import rates

logger.remove()
logger.add(sys.stdout, serialize=True, level="INFO")

app = FastAPI(
    title="rates-service",
    version="0.1.0",
    description="CoinYan exchange rates microservice",
)


@app.get("/health", tags=["Health"], status_code=200, summary="Health Check")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(rates.router)
