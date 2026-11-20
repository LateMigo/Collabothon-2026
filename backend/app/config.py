"""Application settings, loaded once from environment variables / backend/.env."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str | None
    gemini_model: str
    gemini_fallback_model: str | None
    ai_timeout_seconds: float
    ai_final_timeout_seconds: float
    ai_cooldown_seconds: float
    gemini_disable_thinking: bool
    cors_origins: list[str]
    game_data_path: Path
    session_ttl_minutes: int
    max_sessions: int


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    api_key = (os.getenv("GEMINI_API_KEY") or "").strip() or None
    origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    data_path = os.getenv("GAME_DATA_PATH") or str(BACKEND_DIR / "data" / "game_data.json")
    return Settings(
        gemini_api_key=api_key,
        gemini_model=(os.getenv("GEMINI_MODEL") or "gemini-3.5-flash-lite").strip(),
        gemini_fallback_model=(os.getenv("GEMINI_FALLBACK_MODEL") or "").strip() or None,
        ai_timeout_seconds=_env_float("AI_TIMEOUT_SECONDS", 25.0),
        ai_final_timeout_seconds=_env_float("AI_FINAL_TIMEOUT_SECONDS", 45.0),
        ai_cooldown_seconds=_env_float("AI_COOLDOWN_SECONDS", 60.0),
        gemini_disable_thinking=_env_bool("GEMINI_DISABLE_THINKING", True),
        cors_origins=[o.strip() for o in origins.split(",") if o.strip()],
        game_data_path=Path(data_path),
        session_ttl_minutes=_env_int("SESSION_TTL_MINUTES", 240),
        max_sessions=_env_int("MAX_SESSIONS", 500),
    )
