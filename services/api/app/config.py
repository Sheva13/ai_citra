import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[3]


def _load_env():
    env_path = REPO_ROOT / ".env"
    if env_path.exists():
        load_dotenv(env_path, override=False)


def _resolve_path(value: str | None, default_relative: str) -> Path:
    raw = (value or "").strip() or default_relative
    path = Path(raw)
    if path.is_absolute() and path.drive:
        return path
    if raw.startswith("/") and not os.path.exists(raw):
        raw = raw.lstrip("/")
        path = Path(raw)
    return (REPO_ROOT / path).resolve()


@dataclass
class Settings:
    app_env: str
    database_url: str
    jwt_secret: str
    jwt_expire_minutes: int
    cors_origins: list[str]
    storage_dir: Path
    vision_base_url: str
    snapshot_retention_days: int

    @classmethod
    def from_env(cls) -> "Settings":
        _load_env()
        origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
        return cls(
            app_env=os.environ.get("APP_ENV", "development"),
            database_url=os.environ.get(
                "DATABASE_URL",
                "postgresql+psycopg://postgres:123@localhost:5432/helmet_monitoring",
            ),
            jwt_secret=os.environ.get("JWT_SECRET", "dev-secret-change-me"),
            jwt_expire_minutes=int(os.environ.get("JWT_EXPIRE_MINUTES", "60")),
            cors_origins=[origin.strip() for origin in origins.split(",") if origin.strip()],
            storage_dir=_resolve_path(os.environ.get("STORAGE_DIR"), "storage"),
            vision_base_url=os.environ.get("VISION_BASE_URL", "http://127.0.0.1:8100").rstrip("/"),
            snapshot_retention_days=int(os.environ.get("SNAPSHOT_RETENTION_DAYS", "30")),
        )


settings = Settings.from_env()
