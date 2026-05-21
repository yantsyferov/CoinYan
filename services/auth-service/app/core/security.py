from __future__ import annotations

import copy
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.config import settings


def hash_password(plain: str) -> str:
    """Return a bcrypt hash of *plain*."""
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    """Return True if *plain* matches *hashed* using a constant-time comparison."""
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(payload: dict) -> str:
    """Sign *payload* as a short-lived JWT and return the encoded token string.

    A fresh ``exp`` claim is always injected, overwriting any existing one in
    the caller-supplied payload so that the expiry is always exactly
    ``ACCESS_TOKEN_EXPIRE_MINUTES`` from the time of issuance.
    """
    data = copy.deepcopy(payload)
    expire = datetime.now(tz=timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    data["exp"] = expire
    return jwt.encode(data, settings.JWT_SECRET, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    """Decode and verify *token*; return the claims dict.

    Raises:
        ValueError: if the token is expired, has an invalid signature, or is
            otherwise malformed.
    """
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except JWTError as exc:
        raise ValueError("Invalid or expired token") from exc
