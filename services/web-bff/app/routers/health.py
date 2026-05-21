from fastapi import APIRouter, status

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    status_code=status.HTTP_200_OK,
    description="Liveness and readiness probe",
    summary="Health Check",
)
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
