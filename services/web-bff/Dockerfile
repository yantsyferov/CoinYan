FROM python:3.12-slim AS builder

WORKDIR /build

COPY pyproject.toml ./

RUN pip install --upgrade pip \
    && pip install --no-cache-dir --prefix=/install .


FROM python:3.12-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app

COPY --from=builder /install /usr/local

WORKDIR /app

COPY app/ ./app/

RUN addgroup --system appgroup \
    && adduser --system --ingroup appgroup --no-create-home appuser \
    && chown -R appuser:appgroup /app

USER appuser

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
