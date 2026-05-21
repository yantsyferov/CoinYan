from redis.asyncio import Redis


class RedisService:
    # ------------------------------------------------------------------ #
    # Login-attempt rate limiting / account lockout                       #
    # ------------------------------------------------------------------ #

    @staticmethod
    async def increment_login_attempts(redis: Redis, email: str) -> int:
        """Increment the failed-login counter for *email*.

        On the very first increment the key is given a 15-minute TTL so it
        expires automatically even if ``reset_login_attempts`` is never called.
        Returns the new counter value.
        """
        key = f"auth:login_attempts:{email.lower()}"
        count: int = await redis.incr(key)
        if count == 1:
            await redis.expire(key, 900)  # 15 min TTL set only on first failure
        return count

    @staticmethod
    async def reset_login_attempts(redis: Redis, email: str) -> None:
        """Delete the failed-login counter for *email* (call on successful login)."""
        key = f"auth:login_attempts:{email.lower()}"
        await redis.delete(key)

    @staticmethod
    async def is_locked(redis: Redis, email: str) -> bool:
        """Return ``True`` if the account-lockout flag exists for *email*."""
        key = f"auth:locked:{email.lower()}"
        result: int = await redis.exists(key)
        return result == 1

    @staticmethod
    async def lock_account(redis: Redis, email: str, ttl_seconds: int = 900) -> None:
        """Set the account-lockout flag for *email* with *ttl_seconds* TTL.

        Defaults to 900 seconds (15 minutes).  The router is responsible for
        deciding *when* to call this (e.g. after 5 consecutive failures).
        """
        key = f"auth:locked:{email.lower()}"
        await redis.set(key, "1", ex=ttl_seconds)

    # ------------------------------------------------------------------ #
    # Refresh-token registry                                               #
    # ------------------------------------------------------------------ #

    @staticmethod
    async def store_refresh_token(redis: Redis, user_id: str, jti: str, ttl: int) -> None:
        """Register a valid refresh token identified by *user_id* + *jti*.

        Two keys are written with the same *ttl* seconds expiry (typically 30 days):

        - ``auth:refresh:{user_id}:{jti}`` — forward lookup (used by logout and double-check)
        - ``auth:refresh_lookup:{jti}`` — reverse lookup (used by the refresh endpoint to
          resolve user_id without a valid access token)
        """
        await redis.set(f"auth:refresh:{user_id}:{jti}", "1", ex=ttl)
        await redis.set(f"auth:refresh_lookup:{jti}", user_id, ex=ttl)

    @staticmethod
    async def revoke_refresh_token(redis: Redis, user_id: str, jti: str) -> None:
        """Delete both refresh-token registry entries, effectively revoking the token."""
        await redis.delete(f"auth:refresh:{user_id}:{jti}")
        await redis.delete(f"auth:refresh_lookup:{jti}")

    @staticmethod
    async def refresh_token_exists(redis: Redis, user_id: str, jti: str) -> bool:
        """Return ``True`` if the refresh token key exists (i.e. has not been revoked)."""
        key = f"auth:refresh:{user_id}:{jti}"
        result: int = await redis.exists(key)
        return result == 1

    @staticmethod
    async def get_user_id_from_jti(redis: Redis, jti: str) -> str | None:
        """Return the ``user_id`` stored in the reverse JTI lookup, or ``None`` if absent."""
        return await redis.get(f"auth:refresh_lookup:{jti}")

    # ------------------------------------------------------------------ #
    # Password-reset token registry                                        #
    # ------------------------------------------------------------------ #

    @staticmethod
    async def store_pwd_reset_token(redis: Redis, token: str, user_id: str, ttl: int = 3600) -> None:
        """Store a password-reset *token* → *user_id* mapping with *ttl* seconds expiry.

        Defaults to 3600 seconds (1 hour).
        """
        await redis.set(f"auth:pwd_reset:{token}", user_id, ex=ttl)

    @staticmethod
    async def get_user_id_from_pwd_reset_token(redis: Redis, token: str) -> str | None:
        """Return the ``user_id`` associated with *token*, or ``None`` if absent/expired."""
        return await redis.get(f"auth:pwd_reset:{token}")

    @staticmethod
    async def delete_pwd_reset_token(redis: Redis, token: str) -> None:
        """Delete the password-reset token entry, invalidating it immediately."""
        await redis.delete(f"auth:pwd_reset:{token}")

    # ------------------------------------------------------------------ #
    # Email-change token registry                                          #
    # ------------------------------------------------------------------ #

    @staticmethod
    async def store_email_change_token(redis: Redis, token: str, user_id: str, new_email: str, ttl: int = 86400) -> None:
        """Store an email-change *token* → ``user_id:new_email`` mapping with *ttl* seconds expiry.

        Defaults to 86400 seconds (24 hours).
        """
        await redis.set(f"auth:email_change:{token}", f"{user_id}:{new_email}", ex=ttl)

    @staticmethod
    async def get_email_change_data(redis: Redis, token: str) -> tuple[str, str] | None:
        """Return ``(user_id, new_email)`` associated with *token*, or ``None`` if absent/expired."""
        value = await redis.get(f"auth:email_change:{token}")
        if not value:
            return None
        user_id, new_email = value.split(":", 1)
        return user_id, new_email

    @staticmethod
    async def delete_email_change_token(redis: Redis, token: str) -> None:
        """Delete the email-change token entry, invalidating it immediately (single-use enforcement)."""
        await redis.delete(f"auth:email_change:{token}")
