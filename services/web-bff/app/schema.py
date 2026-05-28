import asyncio
import base64
import json
from datetime import datetime, timezone
from enum import Enum
from typing import Annotated

import strawberry
import httpx
from strawberry.types import Info

from app.config import settings


def _extract_user_id(authorization: str) -> str | None:
    """Decode the JWT payload and return the 'sub' claim (user UUID)."""
    try:
        token = authorization.removeprefix("Bearer ").strip()
        # JWT format: header.payload.signature
        payload_b64 = token.split(".")[1]
        # Add padding so base64 decodes correctly
        padding = 4 - len(payload_b64) % 4
        payload_b64 += "=" * (padding % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        return payload.get("sub")
    except Exception:
        return None


@strawberry.type
class User:
    id: strawberry.ID
    display_name: str
    email: str
    pending_email: str | None
    created_at: str


@strawberry.type
class AuthPayload:
    access_token: str
    user: User


@strawberry.type
class RefreshPayload:
    access_token: str


@strawberry.type
class Account:
    id: strawberry.ID
    name: str
    icon: str
    currency: str
    current_balance: float
    status: str
    deleted_at: str | None
    created_at: str


@strawberry.type
class Category:
    id: strawberry.ID
    name: str
    icon: str
    currency: str
    created_at: str
    total: float | None = None
    monthly_limit: float | None = None
    budget_percent: float | None = None


@strawberry.input
class SignUpInput:
    display_name: str
    email: str
    password: str


@strawberry.input
class SignInInput:
    email: str
    password: str


@strawberry.input
class ResetPasswordInput:
    token: str
    new_password: str


@strawberry.input
class UpdateProfileInput:
    display_name: str


@strawberry.input
class ChangePasswordInput:
    current_password: str
    new_password: str


@strawberry.input
class CreateAccountInput:
    name: str
    icon: str
    currency: str
    starting_balance: float | None = None


@strawberry.input
class UpdateAccountInput:
    name: str
    icon: str


@strawberry.input
class CreateCategoryInput:
    name: str
    icon: str
    currency: str = "USD"


@strawberry.input
class UpdateCategoryInput:
    name: str
    icon: str
    currency: str | None = None


@strawberry.type
class Transaction:
    id: strawberry.ID
    type: str
    amount: float
    account_amount: float
    account_currency: str
    exchange_rate: float
    account_id: strawberry.ID
    expense_category_id: strawberry.ID | None
    income_source_id: strawberry.ID | None
    note: str | None
    created_at: str
    to_account_id: strawberry.ID | None = None
    transfer_peer_id: strawberry.ID | None = None
    from_account_id: strawberry.ID | None = None
    transaction_date: str | None = None
    source_amount: float | None = None
    source_currency: str | None = None
    target_amount: float | None = None
    target_currency: str | None = None
    rate_is_custom: bool | None = None


@strawberry.input
class CreateExpenseTransactionInput:
    account_id: strawberry.ID
    expense_category_id: strawberry.ID
    amount: float
    account_amount: float
    account_currency: str = "USD"
    exchange_rate: float = 1.0
    note: str | None = None
    transaction_date: str | None = None
    source_currency: str | None = None
    target_currency: str | None = None
    rate_is_custom: bool | None = False


@strawberry.input
class CreateIncomeTransactionInput:
    income_source_id: strawberry.ID
    account_id: strawberry.ID
    amount: float
    account_amount: float
    account_currency: str = "USD"
    exchange_rate: float = 1.0
    note: str | None = None
    transaction_date: str | None = None
    source_currency: str | None = None
    target_currency: str | None = None
    rate_is_custom: bool | None = False


@strawberry.input
class CreateTransferTransactionInput:
    from_account_id: strawberry.ID
    to_account_id: strawberry.ID
    from_amount: float
    to_amount: float
    exchange_rate: float = 1.0
    from_currency: str = "USD"
    to_currency: str = "USD"
    note: str | None = None
    transaction_date: str | None = None


@strawberry.input
class UpdateTransactionInput:
    id: strawberry.ID
    amount: float
    note: str | None = None
    transaction_date: str | None = None
    exchange_rate: float | None = None
    account_amount: float | None = None
    rate_is_custom: bool | None = None


def _to_transaction(t: dict) -> "Transaction":
    return Transaction(
        id=t["id"],
        type=t["type"],
        amount=float(t["amount"]),
        account_amount=float(t["account_amount"]),
        account_currency=t["account_currency"],
        exchange_rate=float(t["exchange_rate"]),
        account_id=t["account_id"],
        expense_category_id=t.get("expense_category_id"),
        income_source_id=t.get("income_source_id"),
        note=t.get("note"),
        created_at=t["created_at"],
        to_account_id=t.get("transfer_to_account_id") or t.get("to_account_id"),
        transfer_peer_id=t.get("transfer_peer_id"),
        from_account_id=t.get("from_account_id"),
        transaction_date=t.get("transaction_date"),
        source_amount=float(t["amount"]),
        source_currency=t.get("source_currency"),
        target_amount=float(t["account_amount"]),
        target_currency=t.get("target_currency"),
        rate_is_custom=t.get("rate_is_custom", False),
    )


async def _adjust_balance(user_id: str, account_id: str, delta: float) -> None:
    async with httpx.AsyncClient() as client:
        await client.patch(
            f"{settings.ACCOUNTS_SERVICE_URL}/internal/accounts/{account_id}/balance",
            json={"delta": delta},
            headers={"X-User-Id": user_id},
        )


@strawberry.type
class DashboardCategoryItem:
    id: strawberry.ID
    name: str
    icon: str
    amount: float
    share: float
    monthly_limit: float | None
    budget_percent: float | None


@strawberry.type
class DashboardSummary:
    total_income: float
    total_expenses: float
    net_balance: float
    total_account_balance: float | None
    categories: list[DashboardCategoryItem]


@strawberry.enum
class DeleteAccountOption(Enum):
    KEEP_HISTORY = "keep_history"
    DELETE_ALL = "delete_all"


@strawberry.type
class Mutation:
    @strawberry.mutation
    async def sign_up(self, input: SignUpInput, info: Info) -> AuthPayload:
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(
                    f"{settings.AUTH_SERVICE_URL}/internal/auth/register",
                    json={
                        "display_name": input.display_name,
                        "email": input.email,
                        "password": input.password,
                    },
                )
                resp.raise_for_status()
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code == 409:
                    raise Exception("An account with this email already exists")
                raise Exception(f"Registration failed: {exc.response.status_code}")

        # Forward Set-Cookie header from auth-service to the browser
        if "set-cookie" in resp.headers:
            response = info.context["response"]
            response.headers.append("set-cookie", resp.headers["set-cookie"])

        data = resp.json()
        user_data = data["user"]
        return AuthPayload(
            access_token=data["access_token"],
            user=User(
                id=user_data["id"],
                display_name=user_data["display_name"],
                email=user_data["email"],
                pending_email=user_data.get("pending_email"),
                created_at=user_data["created_at"],
            ),
        )

    @strawberry.mutation
    async def sign_in(self, input: SignInInput, info: Info) -> AuthPayload:
        request = info.context["request"]
        response = info.context["response"]

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.AUTH_SERVICE_URL}/internal/auth/login",
                json={"email": input.email, "password": input.password},
                cookies=dict(request.cookies),
            )

        if resp.status_code == 401:
            raise Exception("Incorrect email or password")
        if resp.status_code == 423:
            raise Exception(
                "Account temporarily locked due to too many failed attempts. "
                "Please try again in 15 minutes."
            )
        if resp.status_code >= 400:
            raise Exception(f"Sign in failed: {resp.status_code}")

        if "set-cookie" in resp.headers:
            response.headers.append("set-cookie", resp.headers["set-cookie"])

        data = resp.json()
        user_data = data["user"]
        return AuthPayload(
            access_token=data["access_token"],
            user=User(
                id=user_data["id"],
                display_name=user_data["display_name"],
                email=user_data["email"],
                pending_email=user_data.get("pending_email"),
                created_at=user_data["created_at"],
            ),
        )

    @strawberry.mutation
    async def sign_out(self, info: Info) -> bool:
        request = info.context["request"]
        response = info.context["response"]

        headers = {}
        if "authorization" in request.headers:
            headers["authorization"] = request.headers["authorization"]

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.AUTH_SERVICE_URL}/internal/auth/logout",
                headers=headers,
                cookies=dict(request.cookies),
            )

        if "set-cookie" in resp.headers:
            response.headers.append("set-cookie", resp.headers["set-cookie"])

        return resp.status_code == 204

    @strawberry.mutation
    async def refresh(self, info: Info) -> RefreshPayload:
        request = info.context["request"]
        response = info.context["response"]

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.AUTH_SERVICE_URL}/internal/auth/refresh",
                cookies=dict(request.cookies),
            )

        if resp.status_code >= 400:
            raise Exception("Session expired")

        if "set-cookie" in resp.headers:
            response.headers.append("set-cookie", resp.headers["set-cookie"])

        return RefreshPayload(access_token=resp.json()["access_token"])

    @strawberry.mutation
    async def forgot_password(self, email: str, info: Info) -> bool:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{settings.AUTH_SERVICE_URL}/internal/auth/forgot-password",
                json={"email": email},
            )
        # Always return True — auth-service always responds 200 to avoid user enumeration
        return True

    @strawberry.mutation
    async def reset_password(self, input: ResetPasswordInput, info: Info) -> AuthPayload:
        response = info.context["response"]

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.AUTH_SERVICE_URL}/internal/auth/reset-password",
                json={"token": input.token, "new_password": input.new_password},
            )

        if resp.status_code == 400:
            raise Exception("This reset link has expired or already been used. Please request a new one.")
        if resp.status_code >= 400:
            raise Exception(f"Password reset failed: {resp.status_code}")

        # Forward Set-Cookie (refresh token) to the browser
        if "set-cookie" in resp.headers:
            response.headers.append("set-cookie", resp.headers["set-cookie"])

        data = resp.json()
        user_data = data["user"]
        return AuthPayload(
            access_token=data["access_token"],
            user=User(
                id=user_data["id"],
                display_name=user_data["display_name"],
                email=user_data["email"],
                pending_email=user_data.get("pending_email"),
                created_at=user_data["created_at"],
            ),
        )

    @strawberry.mutation
    async def update_profile(self, input: UpdateProfileInput, info: Info) -> User:
        request = info.context["request"]
        auth_header = request.headers.get("authorization", "")
        async with httpx.AsyncClient() as client:
            resp = await client.patch(
                f"{settings.AUTH_SERVICE_URL}/internal/auth/me/profile",
                json={"display_name": input.display_name},
                headers={"authorization": auth_header},
            )
        if resp.status_code == 422:
            raise Exception("Display name must not be empty")
        if resp.status_code >= 400:
            raise Exception(f"Update failed: {resp.status_code}")
        data = resp.json()
        return User(
            id=data["id"],
            display_name=data["display_name"],
            email=data["email"],
            pending_email=data.get("pending_email"),
            created_at=data["created_at"],
        )

    @strawberry.mutation
    async def change_password(self, input: ChangePasswordInput, info: Info) -> bool:
        request = info.context["request"]
        auth_header = request.headers.get("authorization", "")
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.AUTH_SERVICE_URL}/internal/auth/me/change-password",
                json={"current_password": input.current_password, "new_password": input.new_password},
                headers={"authorization": auth_header},
            )
        if resp.status_code == 401:
            raise Exception("Current password is incorrect")
        if resp.status_code == 422:
            raise Exception("New password does not meet requirements")
        if resp.status_code >= 400:
            raise Exception(f"Change password failed: {resp.status_code}")
        return True

    @strawberry.mutation
    async def change_email(self, new_email: str, info: Info) -> bool:
        request = info.context["request"]
        auth_header = request.headers.get("authorization", "")
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.AUTH_SERVICE_URL}/internal/auth/me/change-email",
                json={"new_email": new_email},
                headers={"authorization": auth_header},
            )
        if resp.status_code == 409:
            raise Exception("This email address is already in use")
        if resp.status_code >= 400:
            raise Exception(f"Email change failed: {resp.status_code}")
        return True

    @strawberry.mutation
    async def confirm_email_change(self, token: str, info: Info) -> User:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.AUTH_SERVICE_URL}/internal/auth/confirm-email",
                params={"token": token},
            )
        if resp.status_code == 400:
            raise Exception("This confirmation link has expired or already been used.")
        if resp.status_code >= 400:
            raise Exception(f"Confirmation failed: {resp.status_code}")
        data = resp.json()
        return User(
            id=data["id"],
            display_name=data["display_name"],
            email=data["email"],
            pending_email=data.get("pending_email"),
            created_at=data["created_at"],
        )

    @strawberry.mutation
    async def update_account(self, id: strawberry.ID, input: UpdateAccountInput, info: Info) -> Account:
        request = info.context["request"]
        auth_header = request.headers.get("authorization", "")
        user_id = _extract_user_id(auth_header)
        if not user_id:
            raise Exception("Unauthorized")

        async with httpx.AsyncClient() as client:
            resp = await client.patch(
                f"{settings.ACCOUNTS_SERVICE_URL}/internal/accounts/{id}",
                json={"name": input.name, "icon": input.icon},
                headers={"X-User-Id": user_id},
            )

        if resp.status_code == 404:
            raise Exception("Account not found")
        if resp.status_code == 422:
            detail = resp.json().get("detail", [])
            msg = detail[0].get("msg", "Validation error") if detail else "Validation error"
            raise Exception(msg)
        if resp.status_code >= 400:
            raise Exception(f"Failed to update account: {resp.status_code}")

        a = resp.json()
        return Account(
            id=a["id"],
            name=a["name"],
            icon=a["icon"],
            currency=a["currency"],
            current_balance=float(a["current_balance"]),
            status=a["status"],
            deleted_at=a.get("deleted_at"),
            created_at=a["created_at"],
        )

    @strawberry.mutation
    async def create_account(self, input: CreateAccountInput, info: Info) -> Account:
        request = info.context["request"]
        auth_header = request.headers.get("authorization", "")
        user_id = _extract_user_id(auth_header)
        if not user_id:
            raise Exception("Unauthorized")

        payload = {
            "name": input.name,
            "icon": input.icon,
            "currency": input.currency,
        }
        if input.starting_balance is not None:
            payload["starting_balance"] = input.starting_balance

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.ACCOUNTS_SERVICE_URL}/internal/accounts",
                json=payload,
                headers={"X-User-Id": user_id},
            )

        if resp.status_code == 422:
            detail = resp.json().get("detail", [])
            if detail:
                msg = detail[0].get("msg", "Validation error")
                raise Exception(msg)
            raise Exception("Validation error")
        if resp.status_code >= 400:
            raise Exception(f"Failed to create account: {resp.status_code}")

        a = resp.json()
        account_id = a["id"]
        account_currency = a["currency"]

        if input.starting_balance is not None and input.starting_balance > 0:
            async with httpx.AsyncClient() as client:
                txn_resp = await client.post(
                    f"{settings.TRANSACTIONS_SERVICE_URL}/internal/transactions",
                    json={
                        "type": "income",
                        "amount": input.starting_balance,
                        "account_amount": input.starting_balance,
                        "account_currency": account_currency,
                        "exchange_rate": 1.0,
                        "account_id": account_id,
                        "income_source_id": None,
                        "note": "Initial balance",
                    },
                    headers={"X-User-Id": user_id},
                )
            if txn_resp.status_code >= 400:
                raise Exception(f"Failed to create initial balance transaction: {txn_resp.status_code}")
            await _adjust_balance(user_id, account_id, input.starting_balance)
            current_balance = input.starting_balance
        else:
            current_balance = float(a["current_balance"])

        return Account(
            id=account_id,
            name=a["name"],
            icon=a["icon"],
            currency=account_currency,
            current_balance=current_balance,
            status=a["status"],
            deleted_at=a.get("deleted_at"),
            created_at=a["created_at"],
        )

    @strawberry.mutation
    async def archive_account(self, id: strawberry.ID, info: Info) -> bool:
        request = info.context["request"]
        user_id = _extract_user_id(request.headers.get("authorization", ""))
        if not user_id:
            raise Exception("Unauthorized")
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.ACCOUNTS_SERVICE_URL}/internal/accounts/{id}/archive",
                headers={"X-User-Id": user_id},
            )
        if resp.status_code == 404:
            raise Exception("Account not found")
        return resp.status_code == 204

    @strawberry.mutation
    async def delete_account(self, id: strawberry.ID, option: DeleteAccountOption, info: Info) -> bool:
        request = info.context["request"]
        user_id = _extract_user_id(request.headers.get("authorization", ""))
        if not user_id:
            raise Exception("Unauthorized")
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.ACCOUNTS_SERVICE_URL}/internal/accounts/{id}/delete",
                json={"option": option.value},
                headers={"X-User-Id": user_id},
            )
        if resp.status_code == 404:
            raise Exception("Account not found")
        return resp.status_code == 204

    @strawberry.mutation
    async def restore_account(self, id: strawberry.ID, info: Info) -> Account:
        request = info.context["request"]
        user_id = _extract_user_id(request.headers.get("authorization", ""))
        if not user_id:
            raise Exception("Unauthorized")
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.ACCOUNTS_SERVICE_URL}/internal/accounts/{id}/restore",
                headers={"X-User-Id": user_id},
            )
        if resp.status_code == 404:
            raise Exception("Account not found")
        if resp.status_code == 409:
            raise Exception("Recovery window has expired")
        if resp.status_code >= 400:
            raise Exception(f"Restore failed: {resp.status_code}")
        a = resp.json()
        return Account(
            id=a["id"],
            name=a["name"],
            icon=a["icon"],
            currency=a["currency"],
            current_balance=float(a["current_balance"]),
            status=a["status"],
            deleted_at=a.get("deleted_at"),
            created_at=a["created_at"],
        )

    @strawberry.mutation
    async def create_expense_category(self, input: CreateCategoryInput, info: Info) -> Category:
        request = info.context["request"]
        user_id = _extract_user_id(request.headers.get("authorization", ""))
        if not user_id:
            raise Exception("Unauthorized")
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.CATEGORIES_SERVICE_URL}/internal/expense-categories",
                json={"name": input.name, "icon": input.icon, "currency": input.currency},
                headers={"X-User-Id": user_id},
            )
        if resp.status_code == 409:
            raise Exception("A category with this name already exists")
        if resp.status_code == 422:
            detail = resp.json().get("detail", [])
            raise Exception(detail[0].get("msg", "Validation error") if detail else "Validation error")
        if resp.status_code >= 400:
            raise Exception(f"Failed to create expense category: {resp.status_code}")
        c = resp.json()
        return Category(id=c["id"], name=c["name"], icon=c["icon"], currency=c.get("currency", "USD"), created_at=c["created_at"])

    @strawberry.mutation
    async def create_income_source(self, input: CreateCategoryInput, info: Info) -> Category:
        request = info.context["request"]
        user_id = _extract_user_id(request.headers.get("authorization", ""))
        if not user_id:
            raise Exception("Unauthorized")
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.CATEGORIES_SERVICE_URL}/internal/income-sources",
                json={"name": input.name, "icon": input.icon, "currency": input.currency},
                headers={"X-User-Id": user_id},
            )
        if resp.status_code == 409:
            raise Exception("An income source with this name already exists")
        if resp.status_code == 422:
            detail = resp.json().get("detail", [])
            raise Exception(detail[0].get("msg", "Validation error") if detail else "Validation error")
        if resp.status_code >= 400:
            raise Exception(f"Failed to create income source: {resp.status_code}")
        c = resp.json()
        return Category(id=c["id"], name=c["name"], icon=c["icon"], currency=c.get("currency", "USD"), created_at=c["created_at"])

    @strawberry.mutation
    async def update_expense_category(self, id: strawberry.ID, input: UpdateCategoryInput, info: Info) -> Category:
        request = info.context["request"]
        user_id = _extract_user_id(request.headers.get("authorization", ""))
        if not user_id:
            raise Exception("Unauthorized")
        payload: dict = {"name": input.name, "icon": input.icon}
        if input.currency is not None:
            payload["currency"] = input.currency
        async with httpx.AsyncClient() as client:
            resp = await client.patch(
                f"{settings.CATEGORIES_SERVICE_URL}/internal/expense-categories/{id}",
                json=payload,
                headers={"X-User-Id": user_id},
            )
        if resp.status_code == 404:
            raise Exception("Expense category not found")
        if resp.status_code == 409:
            raise Exception("A category with this name already exists")
        if resp.status_code >= 400:
            raise Exception(f"Failed to update expense category: {resp.status_code}")
        c = resp.json()
        return Category(id=c["id"], name=c["name"], icon=c["icon"], currency=c.get("currency", "USD"), created_at=c["created_at"])

    @strawberry.mutation
    async def update_income_source(self, id: strawberry.ID, input: UpdateCategoryInput, info: Info) -> Category:
        request = info.context["request"]
        user_id = _extract_user_id(request.headers.get("authorization", ""))
        if not user_id:
            raise Exception("Unauthorized")
        payload: dict = {"name": input.name, "icon": input.icon}
        if input.currency is not None:
            payload["currency"] = input.currency
        async with httpx.AsyncClient() as client:
            resp = await client.patch(
                f"{settings.CATEGORIES_SERVICE_URL}/internal/income-sources/{id}",
                json=payload,
                headers={"X-User-Id": user_id},
            )
        if resp.status_code == 404:
            raise Exception("Income source not found")
        if resp.status_code == 409:
            raise Exception("An income source with this name already exists")
        if resp.status_code >= 400:
            raise Exception(f"Failed to update income source: {resp.status_code}")
        c = resp.json()
        return Category(id=c["id"], name=c["name"], icon=c["icon"], currency=c.get("currency", "USD"), created_at=c["created_at"])

    @strawberry.mutation
    async def delete_expense_category(self, id: strawberry.ID, info: Info) -> bool:
        request = info.context["request"]
        user_id = _extract_user_id(request.headers.get("authorization", ""))
        if not user_id:
            raise Exception("Unauthorized")
        async with httpx.AsyncClient() as client:
            resp = await client.delete(
                f"{settings.CATEGORIES_SERVICE_URL}/internal/expense-categories/{id}",
                headers={"X-User-Id": user_id},
            )
        if resp.status_code == 404:
            raise Exception("Expense category not found")
        return resp.status_code == 204

    @strawberry.mutation
    async def delete_income_source(self, id: strawberry.ID, info: Info) -> bool:
        request = info.context["request"]
        user_id = _extract_user_id(request.headers.get("authorization", ""))
        if not user_id:
            raise Exception("Unauthorized")
        async with httpx.AsyncClient() as client:
            resp = await client.delete(
                f"{settings.CATEGORIES_SERVICE_URL}/internal/income-sources/{id}",
                headers={"X-User-Id": user_id},
            )
        if resp.status_code == 404:
            raise Exception("Income source not found")
        return resp.status_code == 204

    @strawberry.mutation
    async def set_expense_category_limit(
        self, id: strawberry.ID, monthly_limit: float | None, info: Info
    ) -> list[Category]:
        request = info.context["request"]
        user_id = _extract_user_id(request.headers.get("authorization", ""))
        if not user_id:
            raise Exception("Unauthorized")

        async with httpx.AsyncClient() as client:
            if monthly_limit is None or monthly_limit <= 0:
                resp = await client.delete(
                    f"{settings.BUDGETS_SERVICE_URL}/internal/budget-limits/{id}",
                    headers={"X-User-Id": user_id},
                )
                # 404 is acceptable — limit was already absent
                if resp.status_code >= 400 and resp.status_code != 404:
                    raise Exception(f"Failed to remove budget limit: {resp.status_code}")
            else:
                resp = await client.put(
                    f"{settings.BUDGETS_SERVICE_URL}/internal/budget-limits/{id}",
                    json={"amount": monthly_limit},
                    headers={"X-User-Id": user_id},
                )
                if resp.status_code >= 400:
                    raise Exception(f"Failed to set budget limit: {resp.status_code}")

        # Re-fetch all three sources to return a fully refreshed list
        async with httpx.AsyncClient() as client:
            cats_resp, totals_resp, budgets_resp = await asyncio.gather(
                client.get(
                    f"{settings.CATEGORIES_SERVICE_URL}/internal/expense-categories",
                    headers={"X-User-Id": user_id},
                ),
                client.get(
                    f"{settings.TRANSACTIONS_SERVICE_URL}/internal/transactions/totals",
                    headers={"X-User-Id": user_id},
                ),
                client.get(
                    f"{settings.BUDGETS_SERVICE_URL}/internal/budget-limits",
                    headers={"X-User-Id": user_id},
                ),
            )
        if cats_resp.status_code >= 400:
            raise Exception(f"Failed to fetch expense categories: {cats_resp.status_code}")
        totals: dict = {}
        if totals_resp.status_code == 200:
            totals = totals_resp.json().get("expense_categories", {})
        budgets: dict[str, float] = {}
        if budgets_resp.status_code == 200:
            for entry in budgets_resp.json():
                budgets[entry["expense_category_id"]] = float(entry["amount"])
        return [
            Category(
                id=c["id"],
                name=c["name"],
                icon=c["icon"],
                currency=c.get("currency", "USD"),
                created_at=c["created_at"],
                total=totals.get(c["id"]),
                monthly_limit=budgets.get(c["id"]),
                budget_percent=(
                    (totals.get(c["id"], 0) / budgets.get(c["id"]) * 100)
                    if budgets.get(c["id"])
                    else None
                ),
            )
            for c in cats_resp.json()
        ]

    @strawberry.mutation
    async def create_expense_transaction(
        self, input: CreateExpenseTransactionInput, info: Info
    ) -> Transaction:
        request = info.context["request"]
        user_id = _extract_user_id(request.headers.get("authorization", ""))
        if not user_id:
            raise Exception("Unauthorized")
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.TRANSACTIONS_SERVICE_URL}/internal/transactions",
                json={
                    "type": "expense",
                    "amount": input.amount,
                    "account_amount": input.account_amount,
                    "account_currency": input.account_currency,
                    "exchange_rate": input.exchange_rate,
                    "account_id": str(input.account_id),
                    "expense_category_id": str(input.expense_category_id),
                    "note": input.note,
                    "transaction_date": input.transaction_date,
                    "source_currency": input.source_currency or "USD",
                    "target_currency": input.target_currency or "USD",
                    "rate_is_custom": input.rate_is_custom or False,
                },
                headers={"X-User-Id": user_id},
            )
        if resp.status_code >= 400:
            raise Exception(f"Failed to create transaction: {resp.status_code}")
        t = resp.json()
        await _adjust_balance(user_id, str(input.account_id), -input.account_amount)
        return _to_transaction(t)

    @strawberry.mutation
    async def create_income_transaction(
        self, input: CreateIncomeTransactionInput, info: Info
    ) -> Transaction:
        request = info.context["request"]
        user_id = _extract_user_id(request.headers.get("authorization", ""))
        if not user_id:
            raise Exception("Unauthorized")
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.TRANSACTIONS_SERVICE_URL}/internal/transactions",
                json={
                    "type": "income",
                    "amount": input.amount,
                    "account_amount": input.account_amount,
                    "account_currency": input.account_currency,
                    "exchange_rate": input.exchange_rate,
                    "account_id": str(input.account_id),
                    "income_source_id": str(input.income_source_id),
                    "note": input.note,
                    "transaction_date": input.transaction_date,
                    "source_currency": input.source_currency or "USD",
                    "target_currency": input.target_currency or "USD",
                    "rate_is_custom": input.rate_is_custom or False,
                },
                headers={"X-User-Id": user_id},
            )
        if resp.status_code >= 400:
            raise Exception(f"Failed to create transaction: {resp.status_code}")
        t = resp.json()
        await _adjust_balance(user_id, str(input.account_id), input.account_amount)
        return _to_transaction(t)

    @strawberry.mutation
    async def cancel_transaction(self, id: strawberry.ID, info: Info) -> bool:
        request = info.context["request"]
        user_id = _extract_user_id(request.headers.get("authorization", ""))
        if not user_id:
            raise Exception("Unauthorized")

        async with httpx.AsyncClient() as client:
            resp = await client.delete(
                f"{settings.TRANSACTIONS_SERVICE_URL}/internal/transactions/{id}",
                headers={"X-User-Id": user_id},
            )

        if resp.status_code == 404:
            raise Exception("Transaction not found")
        if resp.status_code >= 400:
            raise Exception(f"Failed to cancel transaction: {resp.status_code}")

        data = resp.json()
        if "from_account_id" in data:
            await asyncio.gather(
                _adjust_balance(user_id, data["from_account_id"], data["from_amount"]),
                _adjust_balance(user_id, data["to_account_id"], -data["to_amount"]),
            )
        elif "account_id" in data:
            await _adjust_balance(user_id, data["account_id"], data["delta"])

        return True

    @strawberry.mutation
    async def update_transaction(
        self, input: UpdateTransactionInput, info: Info
    ) -> Transaction:
        request = info.context["request"]
        user_id = _extract_user_id(request.headers.get("authorization", ""))
        if not user_id:
            raise Exception("Unauthorized")

        patch_payload: dict = {
            "amount": input.amount,
            "note": input.note,
            "transaction_date": input.transaction_date,
        }
        if input.exchange_rate is not None:
            patch_payload["exchange_rate"] = input.exchange_rate
        if input.account_amount is not None:
            patch_payload["account_amount"] = input.account_amount
        if input.rate_is_custom is not None:
            patch_payload["rate_is_custom"] = input.rate_is_custom

        async with httpx.AsyncClient() as client:
            resp = await client.patch(
                f"{settings.TRANSACTIONS_SERVICE_URL}/internal/transactions/{input.id}",
                json=patch_payload,
                headers={"X-User-Id": user_id},
            )

        if resp.status_code == 404:
            raise Exception("Transaction not found")
        if resp.status_code >= 400:
            raise Exception(f"Failed to update transaction: {resp.status_code}")

        data = resp.json()
        transaction = data["transaction"]
        old_account_amount = float(data["old_account_amount"])
        new_account_amount = float(transaction["account_amount"])

        txn_type = transaction["type"]
        if txn_type == "expense":
            delta = -(new_account_amount - old_account_amount)
            await _adjust_balance(user_id, transaction["account_id"], delta)
        elif txn_type == "income":
            delta = new_account_amount - old_account_amount
            await _adjust_balance(user_id, transaction["account_id"], delta)
        elif txn_type == "transfer":
            peer_transaction = data.get("peer_transaction")
            old_peer_account_amount = float(data["old_peer_account_amount"]) if data.get("old_peer_account_amount") is not None else old_account_amount
            new_peer_account_amount = float(peer_transaction["account_amount"]) if peer_transaction else new_account_amount

            # Determine which leg is debit (from) and which is credit (to)
            # The debit leg has from_account_id set; the credit leg has transfer_to_account_id set
            if transaction.get("from_account_id"):
                # transaction is the debit (from) leg
                from_delta = -(new_account_amount - old_account_amount)
                to_delta = new_peer_account_amount - old_peer_account_amount
                await asyncio.gather(
                    _adjust_balance(user_id, transaction["from_account_id"], from_delta),
                    _adjust_balance(user_id, transaction["transfer_to_account_id"], to_delta),
                )
            else:
                # transaction is the credit (to) leg; peer is the debit leg
                to_delta = new_account_amount - old_account_amount
                from_delta = -(new_peer_account_amount - old_peer_account_amount)
                from_account_id = peer_transaction["from_account_id"] if peer_transaction else transaction["account_id"]
                await asyncio.gather(
                    _adjust_balance(user_id, from_account_id, from_delta),
                    _adjust_balance(user_id, transaction["account_id"], to_delta),
                )

        return _to_transaction(transaction)

    @strawberry.mutation
    async def create_transfer_transaction(
        self, input: CreateTransferTransactionInput, info: Info
    ) -> Transaction:
        request = info.context["request"]
        user_id = _extract_user_id(request.headers.get("authorization", ""))
        if not user_id:
            raise Exception("Unauthorized")

        # Step 1: create the two linked transaction rows in transactions-service
        transfer_payload: dict = {
            "from_account_id": str(input.from_account_id),
            "to_account_id": str(input.to_account_id),
            "from_amount": input.from_amount,
            "to_amount": input.to_amount,
            "from_currency": input.from_currency,
            "to_currency": input.to_currency,
            "exchange_rate": input.exchange_rate,
            "note": input.note,
        }
        if input.transaction_date is not None:
            transfer_payload["transaction_date"] = input.transaction_date
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.TRANSACTIONS_SERVICE_URL}/internal/transactions/transfer",
                json=transfer_payload,
                headers={"X-User-Id": user_id},
            )
        if resp.status_code >= 400:
            raise Exception(f"Failed to create transfer transaction: {resp.status_code}")

        data = resp.json()
        # transactions-service returns [debit_leg, credit_leg]
        debit_leg = data[0]

        # Step 2: concurrently adjust both account balances
        await asyncio.gather(
            _adjust_balance(user_id, str(input.from_account_id), -input.from_amount),
            _adjust_balance(user_id, str(input.to_account_id), input.to_amount),
        )

        return _to_transaction(debit_leg)


@strawberry.type
class CurrencyTotal:
    currency: str
    amount: float


@strawberry.type
class ExchangeRateResult:
    from_currency: str = strawberry.field(name="from")
    to_currency: str = strawberry.field(name="to")
    date: str
    rate: float | None
    stale: bool


@strawberry.type
class Query:
    @strawberry.field
    def health(self) -> str:
        return "ok"

    @strawberry.field
    async def me(self, info: Info) -> User | None:
        request = info.context["request"]
        auth_header = request.headers.get("authorization", "")
        if not auth_header:
            return None

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.AUTH_SERVICE_URL}/internal/auth/me",
                headers={"authorization": auth_header},
            )

        if resp.status_code != 200:
            return None

        data = resp.json()
        return User(
            id=data["id"],
            display_name=data["display_name"],
            email=data["email"],
            pending_email=data.get("pending_email"),
            created_at=data["created_at"],
        )

    @strawberry.field
    async def accounts(self, info: Info) -> list[Account]:
        request = info.context["request"]
        auth_header = request.headers.get("authorization", "")
        user_id = _extract_user_id(auth_header)
        if not user_id:
            raise Exception("Unauthorized")

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.ACCOUNTS_SERVICE_URL}/internal/accounts",
                headers={"X-User-Id": user_id},
            )

        if resp.status_code >= 400:
            raise Exception(f"Failed to fetch accounts: {resp.status_code}")

        return [
            Account(
                id=a["id"],
                name=a["name"],
                icon=a["icon"],
                currency=a["currency"],
                current_balance=float(a["current_balance"]),
                status=a["status"],
                deleted_at=a.get("deleted_at"),
                created_at=a["created_at"],
            )
            for a in resp.json()
        ]

    @strawberry.field
    async def archived_accounts(self, info: Info) -> list[Account]:
        request = info.context["request"]
        user_id = _extract_user_id(request.headers.get("authorization", ""))
        if not user_id:
            raise Exception("Unauthorized")
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.ACCOUNTS_SERVICE_URL}/internal/accounts/archived",
                headers={"X-User-Id": user_id},
            )
        if resp.status_code >= 400:
            raise Exception(f"Failed to fetch archived accounts: {resp.status_code}")
        return [
            Account(
                id=a["id"],
                name=a["name"],
                icon=a["icon"],
                currency=a["currency"],
                current_balance=float(a["current_balance"]),
                status=a["status"],
                deleted_at=a.get("deleted_at"),
                created_at=a["created_at"],
            )
            for a in resp.json()
        ]

    @strawberry.field
    async def expense_categories(self, info: Info) -> list[Category]:
        request = info.context["request"]
        user_id = _extract_user_id(request.headers.get("authorization", ""))
        if not user_id:
            raise Exception("Unauthorized")
        async with httpx.AsyncClient() as client:
            cats_resp, totals_resp, budgets_resp = await asyncio.gather(
                client.get(
                    f"{settings.CATEGORIES_SERVICE_URL}/internal/expense-categories",
                    headers={"X-User-Id": user_id},
                ),
                client.get(
                    f"{settings.TRANSACTIONS_SERVICE_URL}/internal/transactions/totals",
                    headers={"X-User-Id": user_id},
                ),
                client.get(
                    f"{settings.BUDGETS_SERVICE_URL}/internal/budget-limits",
                    headers={"X-User-Id": user_id},
                ),
            )
        if cats_resp.status_code >= 400:
            raise Exception(f"Failed to fetch expense categories: {cats_resp.status_code}")
        totals: dict = {}
        if totals_resp.status_code == 200:
            totals = totals_resp.json().get("expense_categories", {})
        budgets: dict[str, float] = {}
        if budgets_resp.status_code == 200:
            for entry in budgets_resp.json():
                budgets[entry["expense_category_id"]] = float(entry["amount"])
        return [
            Category(
                id=c["id"],
                name=c["name"],
                icon=c["icon"],
                currency=c.get("currency", "USD"),
                created_at=c["created_at"],
                total=totals.get(c["id"]),
                monthly_limit=budgets.get(c["id"]),
                budget_percent=(
                    (totals.get(c["id"], 0) / budgets.get(c["id"]) * 100)
                    if budgets.get(c["id"])
                    else None
                ),
            )
            for c in cats_resp.json()
        ]

    @strawberry.field
    async def income_sources(self, info: Info) -> list[Category]:
        request = info.context["request"]
        user_id = _extract_user_id(request.headers.get("authorization", ""))
        if not user_id:
            raise Exception("Unauthorized")
        async with httpx.AsyncClient() as client:
            srcs_resp, totals_resp = await asyncio.gather(
                client.get(
                    f"{settings.CATEGORIES_SERVICE_URL}/internal/income-sources",
                    headers={"X-User-Id": user_id},
                ),
                client.get(
                    f"{settings.TRANSACTIONS_SERVICE_URL}/internal/transactions/totals",
                    headers={"X-User-Id": user_id},
                ),
            )
        if srcs_resp.status_code >= 400:
            raise Exception(f"Failed to fetch income sources: {srcs_resp.status_code}")
        totals: dict = {}
        if totals_resp.status_code == 200:
            totals = totals_resp.json().get("income_sources", {})
        return [
            Category(id=c["id"], name=c["name"], icon=c["icon"], currency=c.get("currency", "USD"), created_at=c["created_at"], total=totals.get(c["id"]))
            for c in srcs_resp.json()
        ]

    @strawberry.field
    async def account_transactions(self, account_id: strawberry.ID, info: Info, limit: int = 50, offset: int = 0) -> list[Transaction]:
        request = info.context["request"]
        user_id = _extract_user_id(request.headers.get("authorization", ""))
        if not user_id:
            raise Exception("Unauthorized")
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.TRANSACTIONS_SERVICE_URL}/internal/transactions",
                params={"account_id": str(account_id), "limit": limit, "offset": offset},
                headers={"X-User-Id": user_id},
            )
        if resp.status_code >= 400:
            raise Exception(f"Failed to fetch transactions: {resp.status_code}")
        return [_to_transaction(t) for t in resp.json()]

    @strawberry.field
    async def expense_category_transactions(
        self, category_id: strawberry.ID, info: Info, limit: int = 50, offset: int = 0
    ) -> list[Transaction]:
        request = info.context["request"]
        user_id = _extract_user_id(request.headers.get("authorization", ""))
        if not user_id:
            raise Exception("Unauthorized")
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.TRANSACTIONS_SERVICE_URL}/internal/transactions",
                params={"expense_category_id": str(category_id), "limit": limit, "offset": offset},
                headers={"X-User-Id": user_id},
            )
        if resp.status_code >= 400:
            raise Exception(f"Failed to fetch transactions: {resp.status_code}")
        return [_to_transaction(t) for t in resp.json()]

    @strawberry.field
    async def income_source_transactions(
        self, source_id: strawberry.ID, info: Info, limit: int = 50, offset: int = 0
    ) -> list[Transaction]:
        request = info.context["request"]
        user_id = _extract_user_id(request.headers.get("authorization", ""))
        if not user_id:
            raise Exception("Unauthorized")
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.TRANSACTIONS_SERVICE_URL}/internal/transactions",
                params={"income_source_id": str(source_id), "limit": limit, "offset": offset},
                headers={"X-User-Id": user_id},
            )
        if resp.status_code >= 400:
            raise Exception(f"Failed to fetch transactions: {resp.status_code}")
        return [_to_transaction(t) for t in resp.json()]

    @strawberry.field
    async def dashboard(
        self, info: Info, year: int | None = None, month: int | None = None
    ) -> DashboardSummary:
        request = info.context["request"]
        user_id = _extract_user_id(request.headers.get("authorization", ""))
        if not user_id:
            raise Exception("Unauthorized")

        totals_params: dict = {}
        if year is not None:
            totals_params["year"] = year
        if month is not None:
            totals_params["month"] = month

        # Compute the cutoff datetime for the balance endpoint
        now = datetime.now(timezone.utc)
        _year = year if year is not None else now.year
        _month = month if month is not None else now.month
        if (_year, _month) == (now.year, now.month):
            cutoff = now
        else:
            # Use midnight at the start of the next month as the exclusive upper bound
            if _month == 12:
                cutoff = datetime(_year + 1, 1, 1, tzinfo=timezone.utc)
            else:
                cutoff = datetime(_year, _month + 1, 1, tzinfo=timezone.utc)

        async with httpx.AsyncClient() as client:
            totals_resp, balance_resp, budgets_resp, cats_resp = await asyncio.gather(
                client.get(
                    f"{settings.TRANSACTIONS_SERVICE_URL}/internal/transactions/totals",
                    params=totals_params,
                    headers={"X-User-Id": user_id},
                ),
                client.get(
                    f"{settings.TRANSACTIONS_SERVICE_URL}/internal/transactions/balance",
                    params={"date_to": cutoff.isoformat()},
                    headers={"X-User-Id": user_id},
                ),
                client.get(
                    f"{settings.BUDGETS_SERVICE_URL}/internal/budget-limits",
                    headers={"X-User-Id": user_id},
                ),
                client.get(
                    f"{settings.CATEGORIES_SERVICE_URL}/internal/expense-categories",
                    headers={"X-User-Id": user_id},
                ),
            )

        # Critical service — return zeroed summary on failure
        if totals_resp.status_code >= 400:
            return DashboardSummary(
                total_income=0.0,
                total_expenses=0.0,
                net_balance=0.0,
                total_account_balance=None,
                categories=[],
            )

        totals_data = totals_resp.json()
        expense_totals: dict[str, float] = {
            k: float(v) for k, v in totals_data.get("expense_categories", {}).items()
        }
        income_totals: dict[str, float] = {
            k: float(v) for k, v in totals_data.get("income_sources", {}).items()
        }

        total_income = sum(income_totals.values())
        total_expenses = sum(expense_totals.values())
        net_balance = total_income - total_expenses

        # Cumulative balance from the transactions-service balance endpoint
        total_account_balance: float | None = None
        if balance_resp.status_code == 200:
            total_account_balance = balance_resp.json().get("cumulative_balance")

        # Non-critical services — degrade gracefully on failure
        budgets: dict[str, float] = {}
        if budgets_resp.status_code == 200:
            for entry in budgets_resp.json():
                budgets[entry["expense_category_id"]] = float(entry["amount"])

        cats_by_id: dict[str, dict] = {}
        if cats_resp.status_code == 200:
            for c in cats_resp.json():
                cats_by_id[c["id"]] = c

        category_items: list[DashboardCategoryItem] = []
        for cat_id, amount in expense_totals.items():
            if amount <= 0:
                continue
            cat = cats_by_id.get(cat_id)
            if cat is None:
                continue
            share = (amount / total_expenses * 100) if total_expenses > 0 else 0.0
            budget_amount = budgets.get(cat_id)
            budget_percent = (amount / budget_amount * 100) if budget_amount else None
            category_items.append(
                DashboardCategoryItem(
                    id=cat_id,
                    name=cat["name"],
                    icon=cat["icon"],
                    amount=amount,
                    share=share,
                    monthly_limit=budget_amount,
                    budget_percent=budget_percent,
                )
            )

        category_items.sort(key=lambda x: x.amount, reverse=True)

        return DashboardSummary(
            total_income=total_income,
            total_expenses=total_expenses,
            net_balance=net_balance,
            total_account_balance=total_account_balance,
            categories=category_items,
        )

    @strawberry.field
    async def category_totals_by_currency(
        self, info: Info, category_id: strawberry.ID, month: str
    ) -> list[CurrencyTotal]:
        request = info.context["request"]
        user_id = _extract_user_id(request.headers.get("authorization", ""))
        if not user_id:
            raise Exception("Unauthorized")
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.TRANSACTIONS_SERVICE_URL}/internal/transactions/totals-by-currency",
                params={"entity_type": "category", "entity_id": str(category_id), "month": month},
                headers={"X-User-Id": user_id},
            )
        if resp.status_code >= 400:
            raise Exception(f"Failed to fetch category totals by currency: {resp.status_code}")
        return [
            CurrencyTotal(currency=item["currency"], amount=float(item["amount"]))
            for item in resp.json().get("totals", [])
        ]

    @strawberry.field
    async def income_totals_by_currency(
        self, info: Info, income_source_id: strawberry.ID, month: str
    ) -> list[CurrencyTotal]:
        request = info.context["request"]
        user_id = _extract_user_id(request.headers.get("authorization", ""))
        if not user_id:
            raise Exception("Unauthorized")
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.TRANSACTIONS_SERVICE_URL}/internal/transactions/totals-by-currency",
                params={"entity_type": "income_source", "entity_id": str(income_source_id), "month": month},
                headers={"X-User-Id": user_id},
            )
        if resp.status_code >= 400:
            raise Exception(f"Failed to fetch income totals by currency: {resp.status_code}")
        return [
            CurrencyTotal(currency=item["currency"], amount=float(item["amount"]))
            for item in resp.json().get("totals", [])
        ]

    @strawberry.field
    async def exchange_rate(
        self,
        info: strawberry.types.Info,
        from_currency: Annotated[str, strawberry.argument(name="from")],
        to_currency: Annotated[str, strawberry.argument(name="to")],
        date: str | None = None,
    ) -> ExchangeRateResult | None:
        try:
            url = f"{settings.RATES_SERVICE_URL}/internal/rates/rate?from={from_currency}&to={to_currency}"
            if date is not None:
                url += f"&date={date}"
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            return ExchangeRateResult(
                from_currency=data["from"],
                to_currency=data["to"],
                date=data["date"],
                rate=float(data["rate"]) if data.get("rate") is not None else None,
                stale=bool(data.get("stale", False)),
            )
        except Exception:
            return None


schema = strawberry.Schema(query=Query, mutation=Mutation)
