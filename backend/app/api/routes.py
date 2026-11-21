"""REST endpoints. Thin layer: validation by Pydantic, logic in GameEngine."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from app.models.schemas import (
    AdvisorResponse,
    AIPrefs,
    BudgetPlan,
    BudgetRequest,
    CEODecisionRequest,
    ChallengeEntry,
    CompanyResearchRequest,
    CompanyResearchResponse,
    CreateSessionRequest,
    FinalAnalysisResponse,
    FixedIncomeRequest,
    FixedIncomeResponse,
    GameStateResponse,
    GlossaryAnswer,
    GlossaryQuestion,
    WhatIfResponse,
    KpiEvent,
    KpiFunnel,
    NextWeekResponse,
    SavingsRequest,
    SavingsResponse,
    ScenarioInfo,
    TradeRequest,
    TradeResponse,
)
from app.services.bank_bridge import challenges, tracker
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


@router.post("/glossary/ask", response_model=GlossaryAnswer, tags=["game"])
async def ask_glossary(payload: GlossaryQuestion, engine: GameEngine = Depends(get_engine)) -> GlossaryAnswer:
    tracker.record("glossary_question")
    return await engine.ai.explain_term(payload.question, AIPrefs(level=payload.level, language=payload.language))


@router.get("/sessions/{session_id}/what-if", response_model=WhatIfResponse, tags=["game"])
async def what_if(
    session_id: str,
    level: str = Query(default="normal", pattern="^(simple|normal|detailed)$"),
    language: str = Query(default="en", pattern="^(en|de|pl)$"),
    engine: GameEngine = Depends(get_engine),
) -> WhatIfResponse:
    """Replays the finished season with two simple strategies and explains the difference."""
    result = await engine.what_if(session_id, AIPrefs(level=level, language=language))
    tracker.record("what_if_viewed", session_id)
    return result


@router.post("/budget-plan", response_model=BudgetPlan, tags=["game"])
async def budget_plan(payload: BudgetRequest, engine: GameEngine = Depends(get_engine)) -> BudgetPlan:
    """Berg turns the player's real monthly numbers into a simple plan. Nothing is stored."""
    return await engine.budget_plan(payload)


@router.post("/kpi/event", status_code=204, tags=["kpi"])
async def kpi_event(payload: KpiEvent) -> None:
    """Front-end events for the bank's funnel: quiz answers, lessons, offer clicks, challenge links."""
    tracker.record(payload.event, payload.session_id, payload.detail)


@router.get("/kpi", response_model=KpiFunnel, tags=["kpi"])
async def kpi() -> KpiFunnel:
    """Live funnel for the demo: players -> finished season -> saw Commerzbank offers -> clicked one."""
    return tracker.funnel()


@router.get("/challenge/{seed}", response_model=list[ChallengeEntry], tags=["game"])
async def challenge_board(seed: int) -> list[ChallengeEntry]:
    """Everyone who finished the season with this seed, best net worth first."""
    return challenges.board(seed)


@router.post("/sessions/{session_id}/research", response_model=CompanyResearchResponse, tags=["game"])
async def research(
    session_id: str, payload: CompanyResearchRequest, engine: GameEngine = Depends(get_engine)
) -> CompanyResearchResponse:
    return await engine.research_company(
        session_id, payload.company_id, AIPrefs(level=payload.level, language=payload.language)
    )


@router.post("/sessions/{session_id}/next-week", response_model=NextWeekResponse, tags=["game"])
async def next_week(
    session_id: str, payload: AIPrefs | None = None, engine: GameEngine = Depends(get_engine)
) -> NextWeekResponse:
    """Optional body {level, language}: how the coach should write this week's lesson."""
    return await engine.next_week(session_id, payload)


@router.get("/sessions/{session_id}/final-analysis", response_model=FinalAnalysisResponse, tags=["game"])
async def final_analysis(
    session_id: str,
    level: str = Query(default="normal", pattern="^(simple|normal|detailed)$"),
    language: str = Query(default="en", pattern="^(en|de|pl)$"),
    engine: GameEngine = Depends(get_engine),
) -> FinalAnalysisResponse:
    return await engine.final_analysis(session_id, AIPrefs(level=level, language=language))


@router.post("/sessions/{session_id}/ceo/decision", tags=["day-2"])
async def ceo_decision(
    session_id: str, payload: CEODecisionRequest, engine: GameEngine = Depends(get_engine)
) -> GameStateResponse:
    return await engine.apply_ceo_decision(session_id, payload)


@router.get("/recommendations/scenario", tags=["day-2"])
async def recommend_scenario(
    risk_score: float = Query(0.5, ge=0.0, le=1.0),
    past_roi: float | None = Query(None),
    recommender: ScenarioRecommender = Depends(get_recommender),
) -> dict:
    return {"scenario_id": recommender.recommend_scenario(risk_score, past_roi)}
