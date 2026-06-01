import secrets
from uuid import uuid4

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.dependencies import get_current_user_id, get_db, get_redis
from app.core.security import create_access_token, hash_password, verify_password
from app.repositories.user_repo import UserRepository
from app.schemas.auth import AuthResponse, ChangeEmailRequest, ChangePasswordRequest, ForgotPasswordRequest, LoginRequest, RefreshResponse, RegisterRequest, ResetPasswordRequest, UpdateProfileRequest, UserResponse
from app.services.email_service import EmailService
from app.services.redis_service import RedisService

router = APIRouter(prefix="/internal/auth", tags=["Auth"])


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
    description="Creates a new user, issues a JWT access token, and sets a refresh token cookie.",
)
async def register(
    body: RegisterRequest,
    response: Response,
    session: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> AuthResponse:
    existing = await UserRepository.get_by_email(session, body.email)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    password_hash = hash_password(body.password)
    user = await UserRepository.create_user(
        session,
        display_name=body.display_name,
        email=body.email,
        password_hash=password_hash,
        base_currency=body.base_currency,
    )

    access_token = create_access_token({"sub": str(user.id)})

    refresh_token = str(uuid4())
    ttl_seconds = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    await RedisService.store_refresh_token(redis, str(user.id), refresh_token, ttl_seconds)

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="strict",
        max_age=ttl_seconds,
        secure=False,
    )

    await session.commit()

    user_response = UserResponse(
        id=str(user.id),
        display_name=user.display_name,
        email=user.email,
        pending_email=user.pending_email,
        created_at=user.created_at.isoformat(),
        base_currency=user.base_currency,
    )

    return AuthResponse(user=user_response, access_token=access_token)


@router.post(
    "/login",
    response_model=AuthResponse,
    status_code=status.HTTP_200_OK,
    summary="Log in with email and password",
    description="Verifies credentials, issues a JWT access token, and sets a refresh token cookie.",
)
async def login(
    body: LoginRequest,
    response: Response,
    session: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> AuthResponse:
    email = body.email.lower()

    if await RedisService.is_locked(redis, email):
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Account temporarily locked due to too many failed attempts. Please try again in 15 minutes.",
        )

    user = await UserRepository.get_by_email(session, email)

    password_ok = user is not None and verify_password(body.password, user.password_hash)

    if not password_ok:
        if user is not None:
            count = await RedisService.increment_login_attempts(redis, email)
            if count >= 5:
                await RedisService.lock_account(redis, email, ttl_seconds=900)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    await RedisService.reset_login_attempts(redis, email)

    access_token = create_access_token({"sub": str(user.id)})

    refresh_token = str(uuid4())
    ttl_seconds = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    await RedisService.store_refresh_token(redis, str(user.id), refresh_token, ttl_seconds)

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="strict",
        max_age=ttl_seconds,
        secure=False,
    )

    user_response = UserResponse(
        id=str(user.id),
        display_name=user.display_name,
        email=user.email,
        pending_email=user.pending_email,
        created_at=user.created_at.isoformat(),
        base_currency=user.base_currency,
    )

    return AuthResponse(user=user_response, access_token=access_token)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Log out the current user",
    description=(
        "Revokes the refresh token stored in the HttpOnly cookie and clears it. "
        "Requires a valid Bearer access token in the Authorization header to identify "
        "the user. Idempotent — returns 204 even when no cookie is present."
    ),
)
async def logout(
    request: Request,
    response: Response,
    user_id: str = Depends(get_current_user_id),
    redis: aioredis.Redis = Depends(get_redis),
) -> None:
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        await RedisService.revoke_refresh_token(redis, user_id, refresh_token)
    response.delete_cookie(
        key="refresh_token",
        httponly=True,
        samesite="strict",
    )


@router.post(
    "/refresh",
    response_model=RefreshResponse,
    status_code=status.HTTP_200_OK,
    summary="Rotate refresh token and issue a new access token",
    description=(
        "Reads the HttpOnly refresh-token cookie, validates the JTI in Redis, "
        "issues a new access token, rotates the refresh token (deletes the old JTI "
        "and stores a new one), and sets the new refresh cookie. "
        "Does not require a valid Bearer access token."
    ),
)
async def refresh_token(
    request: Request,
    response: Response,
    redis: aioredis.Redis = Depends(get_redis),
) -> RefreshResponse:
    old_jti = request.cookies.get("refresh_token")
    if not old_jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token",
        )

    # Resolve user_id from the reverse lookup without needing an access token.
    user_id = await RedisService.get_user_id_from_jti(redis, old_jti)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # Double-check the forward key exists (guards against partial-write edge cases).
    exists = await RedisService.refresh_token_exists(redis, user_id, old_jti)
    if not exists:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # Atomically revoke the old token pair before issuing new ones.
    await RedisService.revoke_refresh_token(redis, user_id, old_jti)

    new_access_token = create_access_token({"sub": user_id})
    new_jti = str(uuid4())
    ttl_seconds = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    await RedisService.store_refresh_token(redis, user_id, new_jti, ttl_seconds)

    response.set_cookie(
        key="refresh_token",
        value=new_jti,
        httponly=True,
        samesite="strict",
        max_age=ttl_seconds,
        secure=False,
    )

    return RefreshResponse(access_token=new_access_token)


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get the authenticated user's profile",
    description="Returns the profile of the user identified by the Bearer token.",
)
async def get_me(
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
) -> UserResponse:
    user = await UserRepository.get_by_id(session, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserResponse(
        id=str(user.id),
        display_name=user.display_name,
        email=user.email,
        pending_email=user.pending_email,
        created_at=user.created_at.isoformat(),
        base_currency=user.base_currency,
    )


@router.post(
    "/forgot-password",
    status_code=status.HTTP_200_OK,
    summary="Request a password-reset email",
    description=(
        "If an account exists for the provided email address, a one-time password-reset "
        "link is sent and the token is stored in Redis with a 1-hour TTL. "
        "Always returns 200 to prevent email enumeration."
    ),
)
async def forgot_password(
    body: ForgotPasswordRequest,
    session: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> dict:
    email = body.email.lower()
    user = await UserRepository.get_by_email(session, email)

    if user is not None:
        token = secrets.token_urlsafe(32)
        await RedisService.store_pwd_reset_token(redis, token, str(user.id))
        reset_link = f"{settings.FRONTEND_BASE_URL}/reset-password?token={token}"
        await EmailService.send_password_reset(email, reset_link)

    # Always return the same response to prevent email enumeration.
    return {"message": "If an account exists for this email, a reset link has been sent."}


@router.post(
    "/reset-password",
    response_model=AuthResponse,
    status_code=status.HTTP_200_OK,
    summary="Reset password using a one-time token",
    description=(
        "Validates the password-reset token from Redis, deletes it immediately to enforce "
        "single-use semantics, hashes the new password, updates the user record, and issues "
        "a fresh access token + refresh token cookie — identical to the login response."
    ),
)
async def reset_password(
    body: ResetPasswordRequest,
    response: Response,
    session: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> AuthResponse:
    # Retrieve the user_id bound to this token.
    user_id = await RedisService.get_user_id_from_pwd_reset_token(redis, body.token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset link has expired or already been used.",
        )

    # Delete immediately — single-use enforcement before any further work.
    await RedisService.delete_pwd_reset_token(redis, body.token)

    # Load the user; a missing user after a valid token is an edge-case safeguard.
    user = await UserRepository.get_by_id(session, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found.",
        )

    # Persist the new password hash.
    new_hash = hash_password(body.new_password)
    await UserRepository.update_password(session, user, new_hash)

    # Issue a new token pair (same flow as login/register).
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = str(uuid4())
    ttl_seconds = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    await RedisService.store_refresh_token(redis, str(user.id), refresh_token, ttl_seconds)

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="strict",
        max_age=ttl_seconds,
        secure=False,
    )

    await session.commit()

    return AuthResponse(
        user=UserResponse(
            id=str(user.id),
            display_name=user.display_name,
            email=user.email,
            pending_email=user.pending_email,
            created_at=user.created_at.isoformat(),
            base_currency=user.base_currency,
        ),
        access_token=access_token,
    )


@router.patch(
    "/me/profile",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Update the authenticated user's display name",
    description="Updates the display_name field on the authenticated user's profile and returns the updated user.",
)
async def update_profile(
    body: UpdateProfileRequest,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
) -> UserResponse:
    user = await UserRepository.get_by_id(session, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if body.display_name is not None:
        user = await UserRepository.update_display_name(session, user, body.display_name)
    if body.base_currency is not None:
        user = await UserRepository.update_base_currency(session, user, body.base_currency)
    await session.commit()
    return UserResponse(
        id=str(user.id),
        display_name=user.display_name,
        email=user.email,
        pending_email=user.pending_email,
        created_at=user.created_at.isoformat(),
        base_currency=user.base_currency,
    )


@router.post(
    "/me/change-password",
    status_code=status.HTTP_200_OK,
    summary="Change the authenticated user's password",
    description=(
        "Verifies the current password, applies the new password hash, and returns 200. "
        "Existing sessions remain active — no tokens are revoked."
    ),
)
async def change_password(
    body: ChangePasswordRequest,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
) -> dict:
    user = await UserRepository.get_by_id(session, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect",
        )
    new_hash = hash_password(body.new_password)
    await UserRepository.update_password(session, user, new_hash)
    await session.commit()
    return {"message": "Password updated successfully"}


@router.post(
    "/me/change-email",
    status_code=status.HTTP_200_OK,
    summary="Request an email address change",
    description=(
        "Validates the new email for format and uniqueness, stores a single-use "
        "confirmation token in Redis with a 24-hour TTL, sets pending_email on the "
        "user record, and sends a confirmation link to the new address along with a "
        "security alert to the current address."
    ),
)
async def change_email(
    body: ChangeEmailRequest,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> dict:
    new_email = str(body.new_email).lower()

    existing = await UserRepository.get_by_email(session, new_email)
    if existing and str(existing.id) != user_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email address is already in use",
        )

    user = await UserRepository.get_by_id(session, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    token = secrets.token_urlsafe(32)
    await RedisService.store_email_change_token(redis, token, user_id, new_email)
    await UserRepository.set_pending_email(session, user, new_email)

    confirm_link = f"{settings.FRONTEND_BASE_URL}/confirm-email?token={token}"
    await EmailService.send_email_change_confirmation(new_email, confirm_link)
    await EmailService.send_email_change_alert(user.email)

    await session.commit()
    return {"message": "Confirmation link sent"}


@router.get(
    "/confirm-email",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Confirm an email address change",
    description=(
        "Publicly accessible endpoint. Validates the single-use token from Redis, "
        "deletes it immediately to prevent replay, applies the new email to the user "
        "record, clears pending_email, and returns the updated user profile."
    ),
)
async def confirm_email_change(
    token: str,
    session: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> UserResponse:
    data = await RedisService.get_email_change_data(redis, token)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This confirmation link has expired or already been used.",
        )

    user_id, new_email = data
    # Delete immediately — single-use enforcement before any further work.
    await RedisService.delete_email_change_token(redis, token)

    user = await UserRepository.get_by_id(session, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user = await UserRepository.update_email(session, user, new_email)
    await session.commit()

    return UserResponse(
        id=str(user.id),
        display_name=user.display_name,
        email=user.email,
        pending_email=user.pending_email,
        created_at=user.created_at.isoformat(),
        base_currency=user.base_currency,
    )
