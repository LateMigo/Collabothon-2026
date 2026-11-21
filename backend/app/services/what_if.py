"""'What if?' - replays the player's exact season (same seed, same news, same surprise bills) with two simple
textbook strategies and compares them with what the player really did.

The replays run on a private, offline copy of the engine (no Gemini calls, nothing saved, no KPI events), so a
comparison takes well under a second. Only the short explanation at the end may come from Gemini.
"""

from __future__ import annotations

import dataclasses

from app.models.schemas import (
    AIPrefs,
    CreateSessionRequest,
    GameSession,
    NetWorthPoint,
    SavingsAction,
    SavingsRequest,
    TradeAction,
    TradeRequest,
    WhatIfLine,
    WhatIfResponse,
)
from app.services.ai_service import AIService
from app.services.bank_bridge import kpi_muted
from app.services.session_store import InMemorySessionStore

NEW_LISTING_BUY = 250.0


def bills_cushion(engine) -> float:
    """Money for the whole season's rent (plus a margin for rent rises) and a few surprise bills."""
    s = engine.repo.scenario
    rents = s.total_weeks // max(s.rent_period_weeks, 1)
    return round(s.initial_monthly_rent * rents * 1.25 + 300, -2)

STRATEGIES = {
    "saver": (
        "Only savings",
        "Every dollar in the Commerzbank savings account from Week 1: no risk, small steady interest.",
    ),
    "spread": (
        "Spread + bills covered",
        "Keep the season's rent and bill money in savings, split the rest over all companies and simply hold.",
    ),
}


def _history(state) -> list[NetWorthPoint]:
    return [NetWorthPoint(week=p.week, label=p.label, net_worth=p.net_worth) for p in state.net_worth_history]


async def _replay(engine, session: GameSession, key: str):
    from app.services.game_engine import GameEngine

    offline_ai = AIService(dataclasses.replace(engine.ai._settings, gemini_api_key=None), engine.repo)
    sim = GameEngine(engine.repo, InMemorySessionStore(), offline_ai)
    state = await sim.create_session(
        CreateSessionRequest(game_mode=session.game_mode, modifiers=session.modifiers, seed=session.seed)
    )
    sid = state.session_id
    owned: set[str] = set()
    while not state.is_game_over:
        week = state.current_week
        if key == "saver" and state.cash > 0:
            state = (await sim.move_savings(sid, SavingsRequest(action=SavingsAction.DEPOSIT, amount=state.cash))).state
        elif key == "spread":
            listed = [c for c in state.companies if not c.is_bankrupt and c.id not in owned]
            if week == 1:
                state = (
                    await sim.move_savings(
                        sid, SavingsRequest(action=SavingsAction.DEPOSIT, amount=bills_cushion(engine))
                    )
                ).state
                budget = max(0.0, state.cash - 50.0)
                per_company = budget / max(len(listed), 1)
            else:
                per_company = NEW_LISTING_BUY if state.cash >= NEW_LISTING_BUY + 50 else 0.0
            for company in listed:
                shares = int(per_company // company.price) if company.price > 0 else 0
                if shares > 0:
                    state = (
                        await sim.trade(
                            sid, TradeRequest(company_id=company.id, action=TradeAction.BUY, shares=shares)
                        )
                    ).state
                    owned.add(company.id)
        state = (await sim.next_week(sid)).state
    return state


async def build_what_if(engine, session: GameSession, prefs: AIPrefs | None) -> WhatIfResponse:
    player_history = [NetWorthPoint(week=0, label="Start", net_worth=session.starting_cash)] + [
        NetWorthPoint(week=s.week, label=f"W{s.week}", net_worth=s.net_worth) for s in session.weekly_snapshots
    ]
    start = session.starting_cash
    living = session.total_rent_paid + session.total_expenses
    lines = [
        WhatIfLine(
            key="you",
            label="What you did",
            description="Your real season.",
            final_net_worth=round(player_history[-1].net_worth, 2),
            roi_pct=round((player_history[-1].net_worth + living - start) / start * 100, 2),
            end_reason=session.end_reason.value if session.end_reason else "completed",
            weeks_played=len(session.weekly_snapshots),
            history=player_history,
        )
    ]
    with kpi_muted():
        for key, (label, description) in STRATEGIES.items():
            final = await _replay(engine, session, key)
            lines.append(
                WhatIfLine(
                    key=key,
                    label=label,
                    description=description,
                    final_net_worth=final.net_worth,
                    roi_pct=final.roi_pct,
                    end_reason=final.end_reason.value if final.end_reason else "completed",
                    weeks_played=len(final.net_worth_history) - 1,
                    history=_history(final),
                )
            )
    story = await engine.ai.explain_what_if(lines, prefs)
    return WhatIfResponse(lines=lines, **story.model_dump())
