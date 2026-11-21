"""REST endpoints. Thin layer: validation by Pydantic, logic in GameEngine."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from app.models.schemas import (
    AdvisorResponse,
    CEODecisionRequest,
    CreateSessionRequest,
    FinalAnalysisResponse,
    FixedIncomeRequest,
    FixedIncomeResponse,
    GameStateResponse,
    NextWeekResponse,
    SavingsRequest,
    SavingsResponse,
    ScenarioInfo,
    TradeRequest,
    TradeResponse,
)
from app.services.game_engine import GameEngine
from app.services.recommender import ScenarioRecommender

router = APIRouter(prefix="/api")


def get_engine(request: Request) -> GameEngine:
    return request.app.state.engine


def get_recommender(request: Request) -> ScenarioRecommender:
    return request.app.state.recommender


@router.get("/health", tags=["system"])
async def health(engine: GameEngine = Depends(get_engine)) -> dict:
    return {
        "status": "ok",
        "ai_mode": engine.ai.mode.value,
        "ai_model": engine.ai.model_name,
        "active_sessions": await engine.store.count(),
    }


@router.get("/scenario", response_model=ScenarioInfo, tags=["game"])
async def scenario(engine: GameEngine = Depends(get_engine)) -> ScenarioInfo:
    return engine.scenario_info()


@router.post("/sessions", response_model=GameStateResponse, status_code=201, tags=["game"])
async def create_session(payload: CreateSessionRequest, engine: GameEngine = Depends(get_engine)) -> GameStateResponse:
    return await engine.create_session(payload)


@router.get("/sessions/{session_id}", response_model=GameStateResponse, tags=["game"])
async def get_session(session_id: str, engine: GameEngine = Depends(get_engine)) -> GameStateResponse:
    return await engine.get_state(session_id)


@router.post("/sessions/{session_id}/trade", response_model=TradeResponse, tags=["game"])
async def trade(session_id: str, payload: TradeRequest, engine: GameEngine = Depends(get_engine)) -> TradeResponse:
    return await engine.trade(session_id, payload)


@router.post("/sessions/{session_id}/savings", response_model=SavingsResponse, tags=["game"])
async def savings(session_id: str, payload: SavingsRequest, engine: GameEngine = Depends(get_engine)) -> SavingsResponse:
    return await engine.move_savings(session_id, payload)


@router.post("/sessions/{session_id}/fixed-income", response_model=FixedIncomeResponse, tags=["game"])
async def fixed_income(
    session_id: str, payload: FixedIncomeRequest, engine: GameEngine = Depends(get_engine)
) -> FixedIncomeResponse:
    return await engine.fixed_income(session_id, payload)


@router.post("/sessions/{session_id}/advisor", response_model=AdvisorResponse, tags=["game"])
async def advisor(session_id: str, engine: GameEngine = Depends(get_engine)) -> AdvisorResponse:
    return await engine.use_advisor(session_id)


@router.post("/sessions/{session_id}/next-week", response_model=NextWeekResponse, tags=["game"])
async def next_week(session_id: str, engine: GameEngine = Depends(get_engine)) -> NextWeekResponse:
    return await engine.next_week(session_id)


@router.get("/sessions/{session_id}/final-analysis", response_model=FinalAnalysisResponse, tags=["game"])
async def final_analysis(session_id: str, engine: GameEngine = Depends(get_engine)) -> FinalAnalysisResponse:
    return await engine.final_analysis(session_id)


# ----------------------------------------------------------------------------
# DAY-2 HOOKS
# ----------------------------------------------------------------------------


@router.post("/sessions/{session_id}/ceo/decision", tags=["day-2"])
async def ceo_decision(
    session_id: str, payload: CEODecisionRequest, engine: GameEngine = Depends(get_engine)
) -> GameStateResponse:
    # DAY-2 HOOK: CEO mode. Currently answers 501 "coming_soon".
    return await engine.apply_ceo_decision(session_id, payload)


@router.get("/recommendations/scenario", tags=["day-2"])
async def recommend_scenario(
    risk_score: float = Query(0.5, ge=0.0, le=1.0),
    past_roi: float | None = Query(None),
    recommender: ScenarioRecommender = Depends(get_recommender),
) -> dict:
    # DAY-2 HOOK: returns the default scenario in the MVP.
    return {"scenario_id": recommender.recommend_scenario(risk_score, past_roi)}
