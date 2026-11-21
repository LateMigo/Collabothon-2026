"""FastAPI entry point: `uvicorn app.main:app --reload --port 8000` (run from backend/)."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.config import get_settings
from app.services.ai_service import AIService
from app.services.data_loader import load_game_data
from app.services.game_engine import GameEngine, GameError
from app.services.recommender import DefaultScenarioRecommender
from app.services.session_store import InMemorySessionStore

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("cosmicash")

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    repo = load_game_data(settings.game_data_path)  # fails fast on an invalid scenario
    store = InMemorySessionStore(ttl_minutes=settings.session_ttl_minutes, max_sessions=settings.max_sessions)
    ai = AIService(settings, repo)
    app.state.engine = GameEngine(repo, store, ai)
    app.state.recommender = DefaultScenarioRecommender(repo)
    logger.info(
        "CosmiCash ready: scenario '%s', %d weeks, AI mode = %s%s",
        repo.scenario.title,
        repo.scenario.total_weeks,
        ai.mode.value,
        f" ({ai.model_name})" if ai.model_name else " (no GEMINI_API_KEY - offline fallback)",
    )
    yield


app = FastAPI(
    title="CosmiCash API",
    version="0.1.0",
    description="Turn-based investing game with a delayed-effects market engine and an AI coach.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(GameError)
async def game_error_handler(_: Request, exc: GameError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message, "code": exc.code})


app.include_router(router)


@app.get("/", include_in_schema=False)
async def root() -> dict:
    return {"name": "CosmiCash API", "docs": "/docs", "health": "/api/health"}
