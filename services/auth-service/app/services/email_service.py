import asyncio
import logging

import resend

from app.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    @staticmethod
    def _init() -> None:
        resend.api_key = settings.RESEND_API_KEY

    @staticmethod
    async def send_password_reset(to_email: str, reset_link: str) -> None:
        EmailService._init()
        params = {
            "from": settings.EMAIL_FROM,
            "to": [to_email],
            "subject": "Reset your CoinYan password",
            "html": (
                f"<p>Click the link below to reset your password. This link expires in 1 hour.</p>"
                f"<p><a href='{reset_link}'>Reset Password</a></p>"
                f"<p>If you did not request this, please ignore this email.</p>"
            ),
        }
        try:
            await asyncio.to_thread(resend.Emails.send, params)
        except Exception as e:
            logger.warning("Email send failed (password_reset): %s", e)

    @staticmethod
    async def send_email_change_confirmation(to_new_email: str, confirm_link: str) -> None:
        EmailService._init()
        params = {
            "from": settings.EMAIL_FROM,
            "to": [to_new_email],
            "subject": "Confirm your new email address for CoinYan",
            "html": (
                f"<p>Click the link below to confirm your new email address.</p>"
                f"<p><a href='{confirm_link}'>Confirm Email Change</a></p>"
                f"<p>This link expires in 24 hours.</p>"
            ),
        }
        try:
            await asyncio.to_thread(resend.Emails.send, params)
        except Exception as e:
            logger.warning("Email send failed (email_change_confirmation): %s", e)

    @staticmethod
    async def send_email_change_alert(to_old_email: str) -> None:
        EmailService._init()
        params = {
            "from": settings.EMAIL_FROM,
            "to": [to_old_email],
            "subject": "Your CoinYan email address was changed",
            "html": (
                "<p>A request was made to change the email address on your CoinYan account.</p>"
                "<p>If this wasn't you, please contact support immediately.</p>"
            ),
        }
        try:
            await asyncio.to_thread(resend.Emails.send, params)
        except Exception as e:
            logger.warning("Email send failed (email_change_alert): %s", e)
