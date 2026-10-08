from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./adaptiq.db"
    cors_origins: list[str] = ["http://localhost:5173"]
    frontend_host: str | None = None
    auth_secret: str = "local-development-secret-not-for-production"
    cookie_secure: bool = False
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    session_cookie_name: str = "adaptiq_session"
    csrf_cookie_name: str = "adaptiq_csrf"
    session_ttl_seconds: int = 60 * 60 * 8

    @property
    def allowed_origins(self) -> list[str]:
        origins = list(self.cors_origins)
        if self.frontend_host:
            host = self.frontend_host.removeprefix("https://").rstrip("/")
            if "." not in host:
                host = f"{host}.onrender.com"
            frontend_origin = f"https://{host}"
            if frontend_origin not in origins:
                origins.append(frontend_origin)
        return origins

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
