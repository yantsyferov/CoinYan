from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    AUTH_SERVICE_URL: str = "http://auth-service:8000"
    ACCOUNTS_SERVICE_URL: str = "http://accounts-service:8002"
    CATEGORIES_SERVICE_URL: str = "http://categories-service:8003"
    TRANSACTIONS_SERVICE_URL: str = "http://transactions-service:8004"
    BUDGETS_SERVICE_URL: str = "http://budgets-service:8005"
    RATES_SERVICE_URL: str = "http://rates-service:8006"
    REDIS_URL: str = "redis://redis:6379/0"
    SENTRY_DSN: str = ""


settings = Settings()
