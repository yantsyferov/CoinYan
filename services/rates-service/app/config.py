from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    OPEN_EXCHANGE_RATES_APP_ID: str = ""
    REDIS_URL: str = "redis://localhost:6379"
    PORT: int = 8006


settings = Settings()
