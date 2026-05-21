from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://coinyan:coinyan@transactions-db:5432/transactions_db"
    SENTRY_DSN: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
