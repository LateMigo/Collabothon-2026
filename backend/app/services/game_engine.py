"""CosmiCash simulation engine.

Turn model ("close the week"):
  * During Week N the player reads Week N's headlines (title + description only)
    and trades at current prices.
  * POST /next-week closes Week N: scheduled effects fire, Week N's news hits the
    market (immediately or into the delayed-effects queue), the month is settled,
    and the game moves on to Week N+1.

Nothing here knows about specific companies or events - all of that lives in
backend/data/game_data.json and is accessed via GameDataRepository.
"""

from __future__ import annotations

import math
import random
import uuid

from app.models.schemas import (
    ActionLogEntry,
    ActionType,
    AdvisorCompanyBrief,
    AdvisorContext,
    AdvisorProposal,
    AdvisorResponse,
    AdvisorSignal,
    AdvisorView,
    BankruptcyNotice,
    BankruptcyRecord,
    CEODecisionRequest,
    ChangeType,
    ChartCompany,
    CompanyImpact,
    CompanyState,
    CompanyView,
    ConsequenceView,
    CreateSessionRequest,
    DividendItem,
    EffectDefinition,
    EndReason,
    FinalAnalysisContext,
    FinalAnalysisResponse,
    FinalStats,
    GameMode,
    GameSession,
    GameStateResponse,
    InstrumentType,
    NetWorthPoint,
    NewsItem,
    NextWeekResponse,
    PendingEffect,
    PortfolioPosition,
    PriceChange,
    PricePoint,
    RentPayment,
    RentUpdate,
    RentView,
    RiskLevel,
    ScenarioInfo,
    ScenarioView,
    TargetType,
    TimelineEntry,
    TradeAction,
    TradeRequest,
    TradeResponse,
    TriggeredConsequence,
    UnmaskedNoise,
    WeekResult,
    WeeklySnapshot,
    WeekSummaryContext,
    WeekSummaryResponse,
)
from app.services.ai_service import AIService
from app.services.analytics import compute_player_metrics, money
from app.services.data_loader import GameDataRepository
from app.services.session_store import SessionStore

MIN_ACTIVE_PRICE = 0.5
ADVISOR_DISCLAIMER = "Remember: even experts make mistakes — advisor hints are not 100% guaranteed."


# =============================================================================
# Domain errors (mapped to HTTP responses in main.py)
# =============================================================================


class GameError(Exception):
    status_code = 400
    code = "game_error"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class SessionNotFoundError(GameError):
    status_code, code = 404, "session_not_found"


class CompanyNotFoundError(GameError):
    status_code, code = 404, "company_not_found"


class GameOverError(GameError):
    status_code, code = 409, "game_over"


class GameNotFinishedError(GameError):
    status_code, code = 409, "game_not_finished"


class TradingHaltedError(GameError):
    status_code, code = 409, "trading_halted"


class InvalidTradeError(GameError):
    status_code, code = 400, "invalid_trade"


class AdvisorUnavailableError(GameError):
    status_code, code = 409, "advisor_unavailable"


class FeatureNotAvailableError(GameError):
    status_code, code = 501, "coming_soon"


def r2(value: float) -> float:
    return round(value + 0.0, 2)


class GameEngine:
    def __init__(self, repo: GameDataRepository, store: SessionStore, ai: AIService) -> None:
        self.repo = repo
        self.store = store
        self.ai = ai

    # =====================================================================
    # Queries
    # =====================================================================
    def scenario_info(self) -> ScenarioInfo:
        s = self.repo.scenario
        return ScenarioInfo(
            id=s.id,
            title=s.title,
            tagline=s.tagline,
            description=s.description,
            total_weeks=s.total_weeks,
            starting_cash=s.starting_cash,
            initial_monthly_rent=s.initial_monthly_rent,
            rent_period_weeks=s.rent_period_weeks,
            companies_count=len(self.repo.companies),
            starting_companies=sum(1 for c in self.repo.companies if c.listed_week <= 1),
            listing_interval_weeks=self._listing_interval(),
            available_modes=[GameMode.SINGLE_INVESTOR],
            coming_soon_modes=[GameMode.CEO],
        )

    async def get_state(self, session_id: str) -> GameStateResponse:
        return self._build_state(await self._load(session_id))

    # =====================================================================
    # Commands
    # =====================================================================
    async def create_session(self, request: CreateSessionRequest) -> GameStateResponse:
        if request.game_mode != GameMode.SINGLE_INVESTOR:
            # DAY-2 HOOK: route GameMode.CEO to a CEO-specific session factory.
            raise FeatureNotAvailableError("CEO mode is coming soon (Phase 2). Please start a Single Investor game.")

        s = self.repo.scenario
        companies = {
            c.id: CompanyState(
                id=c.id,
                price=c.initial_price,
                previous_price=c.initial_price,
                dividend_per_share=c.dividend_per_share,
                previous_dividend=c.dividend_per_share,
                bankruptcy_risk=c.bankruptcy_risk,
                previous_risk=c.bankruptcy_risk,
            )
            for c in self.repo.companies
        }
        session = GameSession(
            session_id=uuid.uuid4().hex,
            scenario_id=s.id,
            game_mode=request.game_mode,
            modifiers=request.modifiers,
            seed=request.seed if request.seed is not None else random.SystemRandom().randrange(1, 2_000_000_000),
            starting_cash=s.starting_cash,
            cash=s.starting_cash,
            monthly_rent=s.initial_monthly_rent,
            previous_monthly_rent=s.initial_monthly_rent,
            companies=companies,
            price_history=[
                PricePoint(
                    week=0,
                    label="Start",
                    prices={cid: c.price for cid, c in companies.items() if self._is_listed(cid, 1)},
                )
            ],
            advisor_uses_left=s.advisor_uses_per_game,
        )
        await self.store.save(session)
        return self._build_state(session)

    # ------------------------------------------------------------------ trade
    async def trade(self, session_id: str, request: TradeRequest) -> TradeResponse:
        async with self.store.lock(session_id):
            session = await self._load(session_id)
            self._ensure_running(session)
            company = self.repo.company(request.company_id)
            state = session.companies.get(request.company_id)
            if company is None or state is None:
                raise CompanyNotFoundError(f"Unknown company '{request.company_id}'.")
            if state.is_bankrupt:
                raise TradingHaltedError(f"{company.name} is bankrupt - trading has been stopped.")
            if not self._is_listed(company.id, session.current_week):
                raise TradingHaltedError(f"{company.name} joins the exchange in Week {company.listed_week}.")

            position = session.portfolio.get(company.id) or PortfolioPosition(
                company_id=company.id, instrument_type=InstrumentType.STOCK
            )
            market_price = state.price
            # Selling is a bit worse than buying (spread/fee), like on a real exchange:
            # flipping a stock right after buying it always loses money.
            price = market_price if request.action == TradeAction.BUY else self._sell_price(market_price)

            # Server-side auto-clamping (mirrors the frontend clamp).
            if request.action == TradeAction.BUY:
                max_shares = self._max_affordable(session.cash, price)
            else:
                max_shares = position.shares
            executed = max(0, min(request.shares, max_shares))
            if executed == 0:
                if request.action == TradeAction.BUY:
                    raise InvalidTradeError(f"You don't have enough cash to buy {company.ticker} right now.")
                if position.shares == 0:
                    raise InvalidTradeError(f"You don't own any {company.ticker} shares to sell.")
                raise InvalidTradeError("Choose at least 1 share.")

            total = r2(executed * price)
            if request.action == TradeAction.BUY:
                new_shares = position.shares + executed
                position.avg_cost = r2((position.avg_cost * position.shares + total) / new_shares)
                position.shares = new_shares
                session.cash = r2(session.cash - total)
                verb = "Bought"
            else:
                position.shares -= executed
                if position.shares == 0:
                    position.avg_cost = 0.0
                session.cash = r2(session.cash + total)
                verb = "Sold"
            session.portfolio[company.id] = position

            was_clamped = executed != request.shares
            self._log(
                session,
                action_type=ActionType.BUY if request.action == TradeAction.BUY else ActionType.SELL,
                company_id=company.id,
                ticker=company.ticker,
                shares=executed,
                price=price,
                amount=total,
                note=f"{verb} {executed} {company.ticker} at {money(price)}",
                details={"requested_shares": request.shares, "was_clamped": was_clamped, "market_price": market_price},
            )
            await self.store.save(session)

            message = f"{verb} {executed} {company.ticker} share{'s' if executed != 1 else ''} for {money(total)}."
            if request.action == TradeAction.SELL and price < market_price:
                fee_pct = self.repo.scenario.sell_spread * 100
                message += f" (Market price {money(market_price)} minus the {fee_pct:g}% selling fee.)"
            if was_clamped:
                message += f" (Adjusted from {request.shares} to the maximum possible: {executed}.)"
            return TradeResponse(
                action=request.action,
                company_id=company.id,
                ticker=company.ticker,
                requested_shares=request.shares,
                executed_shares=executed,
                was_clamped=was_clamped,
                price=price,
                market_price=market_price,
                total=total,
                message=message,
                state=self._build_state(session),
            )

    # ---------------------------------------------------------------- advisor
    async def use_advisor(self, session_id: str) -> AdvisorResponse:
        async with self.store.lock(session_id):
            session = await self._load(session_id)
            self._ensure_running(session)
            s = self.repo.scenario
            if session.advisor_uses_left <= 0:
                raise AdvisorUnavailableError("You have used all your advisor hints for this game.")
            if session.advisor_used_weeks.count(session.current_week) >= s.advisor_max_per_week:
                raise AdvisorUnavailableError("The advisor is busy - you can ask again next week.")

            # Seeded draw: the same seed reproduces the same advisor luck (useful for demos).
            rng = random.Random(f"{session.seed}:advisor:{session.current_week}:{session.advisor_uses_left}")
            accurate = rng.random() < s.advisor_accuracy

            ctx = self._build_advisor_context(session, accurate)
            hint = await self.ai.generate_advisor_hint(ctx)

            session.advisor_uses_left -= 1
            session.advisor_used_weeks.append(session.current_week)
            focus = self.repo.company(hint.focus_company_id) if hint.focus_company_id else None
            self._log(
                session,
                action_type=ActionType.ADVISOR,
                company_id=focus.id if focus else None,
                ticker=focus.ticker if focus else None,
                note=hint.hint,
                details={
                    "accurate": accurate,
                    "focus_company_id": focus.id if focus else None,
                    "suggested_action": hint.suggested_action.value,
                    "ai_source": hint.ai_source.value,
                },
            )
            await self.store.save(session)
            return AdvisorResponse(
                week=session.current_week,
                hint=hint.hint,
                focus_company_id=focus.id if focus else None,
                focus_company_name=focus.name if focus else None,
                suggested_action=hint.suggested_action,
                ai_source=hint.ai_source,
                uses_left=session.advisor_uses_left,
                disclaimer=ADVISOR_DISCLAIMER,
                state=self._build_state(session),
            )

    # -------------------------------------------------------------- next week
    async def next_week(self, session_id: str) -> NextWeekResponse:
        async with self.store.lock(session_id):
            session = await self._load(session_id)
            self._ensure_running(session)
            s = self.repo.scenario
            week = session.current_week
            week_def = self.repo.week(week)
            if week_def is None:
                raise GameOverError("There is no scripted content for this week.")

            net_worth_before = self._net_worth(session)
            prices_before = {cid: c.price for cid, c in session.companies.items() if self._is_listed(cid, week)}
            holdings_before = {cid: p.shares for cid, p in session.portfolio.items()}
            rent_before = session.monthly_rent
            for company in session.companies.values():
                company.previous_price = company.price
                company.previous_dividend = company.dividend_per_share
                company.previous_risk = company.bankruptcy_risk

            triggered: list[TriggeredConsequence] = []

            # 1. Activate delayed effects scheduled for this week, then drop them from the queue.
            due = [p for p in session.pending_effects if p.trigger_week == week]
            session.pending_effects = [p for p in session.pending_effects if p.trigger_week != week]
            for pending in due:
                triggered.append(
                    self._apply_effect(
                        session,
                        pending.effect,
                        event_id=pending.event_id,
                        event_title=pending.source_event_title,
                        source_week=pending.source_week,
                        trigger_week=week,
                        is_delayed=True,
                    )
                )

            # 2. This week's news: immediate effects now, delayed effects into the queue.
            for event in week_def.events:
                for effect in event.effects:
                    if effect.delay_weeks == 0:
                        triggered.append(
                            self._apply_effect(
                                session,
                                effect,
                                event_id=event.id,
                                event_title=event.title,
                                source_week=week,
                                trigger_week=week,
                                is_delayed=False,
                            )
                        )
                    else:
                        session.pending_effects.append(
                            PendingEffect(
                                event_id=event.id,
                                source_event_title=event.title,
                                source_week=week,
                                trigger_week=week + effect.delay_weeks,
                                effect=effect,
                            )
                        )
            # 2b. Scripted everyday market wiggle (deterministic, from game_data.json).
            for company_id, drift in week_def.market_drift.items():
                company = session.companies.get(company_id)
                if company and not company.is_bankrupt and drift and self._is_listed(company_id, week):
                    company.price = r2(max(MIN_ACTIVE_PRICE, company.price * (1 + drift)))

            # 2c. Market mood: a falling share price raises a company's bankruptcy risk, a rising one lowers it.
            sensitivity = s.risk_sensitivity
            if sensitivity:
                for company_id, before in prices_before.items():
                    company = session.companies[company_id]
                    if company.is_bankrupt or before <= 0:
                        continue
                    change = (company.price - before) / before
                    company.bankruptcy_risk = round(
                        min(1.0, max(0.02, company.bankruptcy_risk - sensitivity * change)), 4
                    )

            # 3. Rent update: a "rent" effect changes monthly_rent right away (paid on the next due date).
            rent_changed = abs(session.monthly_rent - rent_before) > 1e-9
            rent_source_week = None
            if rent_changed:
                rent_source_week = next(
                    (c.source_week for c in reversed(triggered) if c.target_type == TargetType.RENT), week
                )
                session.previous_monthly_rent = rent_before
                session.rent_delta = r2(session.monthly_rent - rent_before)
                session.rent_changed_week = week
                session.rent_change_source_week = rent_source_week

            # 4a. Bankruptcy check.
            bankruptcies = self._check_bankruptcies(session, week)
            # 4b. Dividends.
            dividends = self._pay_dividends(session, week)
            dividends_total = r2(sum(d.amount for d in dividends))
            # 4c. Price history for the SVG chart.
            session.price_history.append(
                PricePoint(
                    week=week,
                    label=f"W{week}",
                    prices={cid: c.price for cid, c in session.companies.items() if self._is_listed(cid, week)},
                )
            )
            # 4d. Rent settlement every `rent_period_weeks` weeks.
            payment = self._settle_rent(session, week)
            # 4e. Weekly snapshot for the end-of-game analysis.
            stocks_value = self._stocks_value(session)
            session.weekly_snapshots.append(
                WeeklySnapshot(
                    week=week,
                    cash=session.cash,
                    stocks_value=stocks_value,
                    net_worth=r2(session.cash + stocks_value),
                    holdings={cid: p.shares for cid, p in session.portfolio.items() if p.shares > 0},
                    prices={cid: c.price for cid, c in session.companies.items() if self._is_listed(cid, week)},
                    dividends_received=dividends_total,
                    rent_paid=payment.amount if payment else 0.0,
                    monthly_rent=session.monthly_rent,
                    triggered_event_ids=sorted({c.event_id for c in triggered}),
                    news_event_ids=[e.id for e in week_def.events],
                    trades_this_week=sum(
                        1
                        for a in session.action_log
                        if a.week == week and a.action_type in (ActionType.BUY, ActionType.SELL)
                    ),
                )
            )
            session.consequence_log.extend(triggered)

            # Build the turn recap.
            consequence_views = [self._consequence_view(c) for c in triggered]
            price_changes = [
                PriceChange(
                    company_id=cid,
                    name=self.repo.company(cid).name,
                    ticker=self.repo.company(cid).ticker,
                    color=self.repo.company_color(cid),
                    old_price=prices_before[cid],
                    new_price=c.price,
                    change_pct=round((c.price - prices_before[cid]) / prices_before[cid] * 100, 2)
                    if prices_before[cid] > 0
                    else 0.0,
                    risk_before=round(c.previous_risk, 4),
                    risk_after=round(c.bankruptcy_risk, 4),
                    is_bankrupt=c.is_bankrupt,
                    shares_owned=holdings_before.get(cid, 0),
                )
                for cid, c in session.companies.items()
                if cid in prices_before
            ]
            unmasked = []
            for event in week_def.events:
                if event.is_noise:
                    insight = self.repo.noise_insight(event.id)
                    unmasked.append(
                        UnmaskedNoise(
                            event_id=event.id,
                            title=event.title,
                            explanation=insight.reveal
                            if insight
                            else "This headline sounded important, but it had no effect on any price.",
                            related_company_id=insight.related_company_id if insight else None,
                        )
                    )
            next_due = self._next_rent_due_after(session, week)
            rent_update = RentUpdate(
                enabled=session.modifiers.enable_living_costs,
                changed=rent_changed,
                old_rent=rent_before,
                new_rent=session.monthly_rent,
                delta=r2(session.monthly_rent - rent_before),
                source_week=rent_source_week,
                paid=payment is not None,
                amount_paid=payment.amount if payment else 0.0,
                cash_before_payment=payment.cash_before if payment else None,
                next_due_week=next_due,
            )
            net_worth_after = self._net_worth(session)

            # 5. AI micro-lesson about market lag (Gemini or fallback).
            lesson = await self.ai.generate_week_summary(
                WeekSummaryContext(
                    week=week,
                    total_weeks=s.total_weeks,
                    consequences=consequence_views,
                    price_changes=price_changes,
                    unmasked_noise=unmasked,
                    rent=rent_update,
                    dividends_total=dividends_total,
                    bankruptcies=bankruptcies,
                    net_worth_change=r2(net_worth_after - net_worth_before),
                )
            )

            # 6. Game over: last week finished or cash below zero after rent (liquidity loss).
            if session.cash < 0:
                session.is_game_over, session.end_reason = True, EndReason.LIQUIDITY
            elif week >= s.total_weeks:
                session.is_game_over, session.end_reason = True, EndReason.COMPLETED
            else:
                session.current_week = week + 1

            await self.store.save(session)

            summary = WeekSummaryResponse(
                week=week,
                theme=week_def.theme,
                triggered_consequences=consequence_views,
                price_changes=price_changes,
                dividends=dividends,
                dividends_total=dividends_total,
                rent=rent_update,
                bankruptcies=bankruptcies,
                unmasked_noise=unmasked,
                lesson=lesson,
                net_worth_before=net_worth_before,
                net_worth_after=net_worth_after,
                net_worth_change=r2(net_worth_after - net_worth_before),
                net_worth_change_pct=round((net_worth_after - net_worth_before) / net_worth_before * 100, 2)
                if net_worth_before > 0
                else 0.0,
                cash_after=session.cash,
                is_game_over=session.is_game_over,
                end_reason=session.end_reason,
            )
            return NextWeekResponse(summary=summary, state=self._build_state(session))

    # --------------------------------------------------------- final analysis
    async def final_analysis(self, session_id: str) -> FinalAnalysisResponse:
        async with self.store.lock(session_id):
            session = await self._load(session_id)
            if not session.is_game_over:
                raise GameNotFinishedError("The final analysis is available once the game is over.")
            if session.final_analysis is not None:
                return session.final_analysis

            metrics = compute_player_metrics(session, self.repo)
            stocks_value = self._stocks_value(session)
            stats = FinalStats(
                final_net_worth=self._net_worth(session),
                starting_cash=session.starting_cash,
                roi_pct=metrics.roi_pct,
                total_dividends=r2(session.total_dividends),
                total_rent_paid=r2(session.total_rent_paid),
                final_cash=session.cash,
                final_stocks_value=stocks_value,
                trades_count=metrics.trades_count,
                weeks_played=metrics.weeks_played,
                end_reason=session.end_reason,
            )
            timeline = self._market_timeline(session)
            companies = [
                ChartCompany(
                    id=c.id,
                    name=c.name,
                    ticker=c.ticker,
                    color=self.repo.company_color(c.id),
                    is_bankrupt=session.companies[c.id].is_bankrupt,
                )
                for c in self.repo.companies
                if self._is_listed(c.id, session.current_week)
            ]
            analysis = await self.ai.generate_final_analysis(
                FinalAnalysisContext(
                    metrics=metrics,
                    stats=stats,
                    action_log=session.action_log,
                    weekly_snapshots=session.weekly_snapshots,
                    market_timeline=timeline,
                    companies=companies,
                )
            )

            weekly_results = []
            previous = session.starting_cash
            for snap in session.weekly_snapshots:
                change = r2(snap.net_worth - previous)
                weekly_results.append(
                    WeekResult(
                        week=snap.week,
                        net_worth=snap.net_worth,
                        change=change,
                        change_pct=round(change / previous * 100, 2) if previous > 0 else 0.0,
                    )
                )
                previous = snap.net_worth

            response = FinalAnalysisResponse(
                session_id=session.session_id,
                stats=stats,
                analysis=analysis,
                weekly_results=weekly_results,
                trade_history=[
                    a for a in session.action_log if a.action_type in (ActionType.BUY, ActionType.SELL)
                ],
                price_history=session.price_history,
                companies=companies,
                market_timeline=timeline,
            )
            session.final_analysis = response
            await self.store.save(session)
            return response

    # =====================================================================
    # DAY-2 HOOKS (CEO mode) - architecture only
    # =====================================================================
    async def generate_ceo_proposals(self, session_id: str) -> list[AdvisorProposal]:
        """DAY-2 HOOK: ask the CFO and CTO advisors (AIService) for two competing proposals."""
        raise FeatureNotAvailableError("CEO mode is coming soon (Phase 2).")

    async def apply_ceo_decision(self, session_id: str, request: CEODecisionRequest) -> GameStateResponse:
        """DAY-2 HOOK: resolve invest_first / invest_second / invest_both / invest_none
        by turning the chosen proposals into EffectDefinitions pushed into pending_effects."""
        raise FeatureNotAvailableError("CEO mode is coming soon (Phase 2).")

    # =====================================================================
    # Internals - effects
    # =====================================================================
    def _apply_effect(
        self,
        session: GameSession,
        effect: EffectDefinition,
        *,
        event_id: str,
        event_title: str,
        source_week: int,
        trigger_week: int,
        is_delayed: bool,
    ) -> TriggeredConsequence:
        impacts: list[CompanyImpact] = []
        rent_before = rent_after = None

        if effect.target_type == TargetType.RENT:
            rent_before = session.monthly_rent
            session.monthly_rent = r2(max(0.0, self._changed(session.monthly_rent, effect)))
            rent_after = session.monthly_rent
        else:
            for company_id in self.repo.resolve_company_ids(effect.target_id):
                state = session.companies[company_id]
                if state.is_bankrupt or not self._is_listed(company_id, trigger_week):
                    continue
                if effect.target_type == TargetType.STOCK_PRICE:
                    before = state.price
                    state.price = r2(max(MIN_ACTIVE_PRICE, self._changed(state.price, effect)))
                    after = state.price
                elif effect.target_type == TargetType.DIVIDEND:
                    before = state.dividend_per_share
                    state.dividend_per_share = round(max(0.0, self._changed(state.dividend_per_share, effect)), 4)
                    after = state.dividend_per_share
                else:  # BANKRUPTCY_RISK
                    before = state.bankruptcy_risk
                    state.bankruptcy_risk = round(min(1.0, max(0.0, self._changed(state.bankruptcy_risk, effect))), 4)
                    after = state.bankruptcy_risk
                state.latest_note = effect.consequence_text
                state.latest_note_week = trigger_week
                position = session.portfolio.get(company_id)
                impacts.append(
                    CompanyImpact(
                        company_id=company_id,
                        ticker=self.repo.company(company_id).ticker,
                        before=before,
                        after=after,
                        player_shares=position.shares if position else 0,
                    )
                )

        return TriggeredConsequence(
            event_id=event_id,
            event_title=event_title,
            source_week=source_week,
            trigger_week=trigger_week,
            is_delayed=is_delayed,
            delay_weeks=trigger_week - source_week,
            target_type=effect.target_type,
            target_id=effect.target_id,
            target_label=self.repo.target_label(effect.target_type, effect.target_id),
            change_type=effect.change_type,
            value=effect.value,
            direction="up" if effect.value > 0 else "down" if effect.value < 0 else "neutral",
            impact_label=self._impact_label(effect),
            consequence_text=effect.consequence_text,
            company_impacts=impacts,
            rent_before=rent_before,
            rent_after=rent_after,
        )

    @staticmethod
    def _changed(old: float, effect: EffectDefinition) -> float:
        if effect.change_type == ChangeType.PERCENT:
            return old * (1 + effect.value)
        return old + effect.value

    @staticmethod
    def _impact_label(effect: EffectDefinition) -> str:
        v = effect.value
        sign = "+" if v >= 0 else "-"
        if effect.target_type == TargetType.BANKRUPTCY_RISK:
            amount = f"{abs(v) * 100:.0f}%" if effect.change_type == ChangeType.PERCENT else f"{abs(v) * 100:.0f} pts"
            return f"bankruptcy risk {sign}{amount}"
        if effect.change_type == ChangeType.PERCENT:
            amount = f"{sign}{abs(v) * 100:.0f}%"
        else:
            amount = f"{sign}${abs(v):,.2f}".replace(".00", "")
        noun = {
            TargetType.STOCK_PRICE: "share price",
            TargetType.DIVIDEND: "dividend per share",
            TargetType.RENT: "monthly rent",
        }[effect.target_type]
        return f"{noun} {amount}"

    # =====================================================================
    # Internals - settlements
    # =====================================================================
    def _check_bankruptcies(self, session: GameSession, week: int) -> list[BankruptcyNotice]:
        threshold = self.repo.scenario.bankruptcy_threshold
        notices = []
        for company_id, state in session.companies.items():
            if state.is_bankrupt or state.bankruptcy_risk < threshold or not self._is_listed(company_id, week):
                continue
            company = self.repo.company(company_id)
            last_price = state.price
            position = session.portfolio.get(company_id)
            shares = position.shares if position else 0
            state.is_bankrupt = True
            state.bankrupt_week = week
            state.price = 0.0
            state.dividend_per_share = 0.0
            state.latest_note = f"{company.name} went bankrupt in Week {week}. Its shares are worth $0."
            state.latest_note_week = week
            session.bankruptcies.append(
                BankruptcyRecord(
                    company_id=company_id, week=week, last_price=last_price, player_shares=shares, risk=state.bankruptcy_risk
                )
            )
            lost = r2(shares * last_price)
            message = f"{company.name} ({company.ticker}) went bankrupt. Its shares are now worth $0 and trading has stopped."
            if shares:
                message += f" You held {shares} shares - about {money(lost)} is gone."
            self._log(
                session,
                action_type=ActionType.BANKRUPTCY,
                company_id=company_id,
                ticker=company.ticker,
                shares=shares,
                price=0.0,
                amount=0.0,
                note=message,
                details={"lost_value": lost},
                week=week,
            )
            notices.append(
                BankruptcyNotice(
                    company_id=company_id,
                    name=company.name,
                    ticker=company.ticker,
                    message=message,
                    player_shares=shares,
                    lost_value=lost,
                )
            )
        return notices

    def _pay_dividends(self, session: GameSession, week: int) -> list[DividendItem]:
        if not session.modifiers.enable_dividends:
            return []
        items = []
        for company_id, position in session.portfolio.items():
            state = session.companies[company_id]
            if position.shares <= 0 or state.is_bankrupt or state.dividend_per_share <= 0:
                continue
            amount = r2(position.shares * state.dividend_per_share)
            if amount <= 0:
                continue
            session.cash = r2(session.cash + amount)
            session.total_dividends = r2(session.total_dividends + amount)
            ticker = self.repo.company(company_id).ticker
            items.append(
                DividendItem(
                    company_id=company_id,
                    ticker=ticker,
                    shares=position.shares,
                    per_share=state.dividend_per_share,
                    amount=amount,
                )
            )
            self._log(
                session,
                action_type=ActionType.DIVIDEND,
                company_id=company_id,
                ticker=ticker,
                shares=position.shares,
                price=state.dividend_per_share,
                amount=amount,
                note=f"Dividend from {ticker}: {position.shares} x {money(state.dividend_per_share)}",
                week=week,
            )
        return items

    def _settle_rent(self, session: GameSession, week: int) -> RentPayment | None:
        period = self.repo.scenario.rent_period_weeks
        if not session.modifiers.enable_living_costs or week % period != 0:
            return None
        cash_before = session.cash
        session.cash = r2(session.cash - session.monthly_rent)
        session.total_rent_paid = r2(session.total_rent_paid + session.monthly_rent)
        payment = RentPayment(week=week, amount=session.monthly_rent, cash_before=cash_before, cash_after=session.cash)
        session.rent_payments.append(payment)
        self._log(
            session,
            action_type=ActionType.RENT,
            amount=session.monthly_rent,
            note=f"Monthly rent paid: {money(session.monthly_rent)}",
            week=week,
        )
        return payment

    def _next_rent_due_after(self, session: GameSession, week: int) -> int | None:
        return self._next_rent_due_from(session, week + 1)

    def _next_rent_due_from(self, session: GameSession, week: int) -> int | None:
        if not session.modifiers.enable_living_costs:
            return None
        period = self.repo.scenario.rent_period_weeks
        due = math.ceil(week / period) * period
        return due if due <= self.repo.scenario.total_weeks else None

    # =====================================================================
    # Internals - advisor
    # =====================================================================
    def _build_advisor_context(self, session: GameSession, accurate: bool) -> AdvisorContext:
        week = session.current_week
        week_def = self.repo.week(week)
        companies = [
            AdvisorCompanyBrief(
                id=c.id,
                name=c.name,
                ticker=c.ticker,
                industry=self.repo.industry_label(c.industry),
                price=session.companies[c.id].price,
                risk_level=self._risk_level(session.companies[c.id].bankruptcy_risk),
                shares_owned=session.portfolio[c.id].shares if c.id in session.portfolio else 0,
            )
            for c in self.repo.companies
            if not session.companies[c.id].is_bankrupt and self._is_listed(c.id, week)
        ]

        real: list[tuple[float, AdvisorSignal]] = []

        def add_real(title: str, effect: EffectDefinition, weeks_until: int) -> None:
            if effect.value == 0:
                return
            direction = "up" if effect.value > 0 else "down"
            if effect.target_type == TargetType.RENT:
                importance = abs(effect.value) / max(session.monthly_rent, 1.0) * 0.5
                real.append(
                    (
                        importance / (1 + 0.5 * weeks_until),
                        AdvisorSignal(
                            event_title=title,
                            company_id=None,
                            company_name=None,
                            ticker=None,
                            target_type=effect.target_type,
                            direction=direction,
                            weeks_until_effect=weeks_until,
                        ),
                    )
                )
                return
            for company_id in self.repo.resolve_company_ids(effect.target_id):
                state = session.companies[company_id]
                if state.is_bankrupt or not self._is_listed(company_id, week):
                    continue
                company = self.repo.company(company_id)
                if effect.target_type == TargetType.STOCK_PRICE:
                    importance = abs(effect.value) if effect.change_type == ChangeType.PERCENT else abs(effect.value) / max(state.price, 1.0)
                elif effect.target_type == TargetType.BANKRUPTCY_RISK:
                    importance = abs(effect.value)
                else:
                    importance = 0.05
                real.append(
                    (
                        importance / (1 + 0.5 * weeks_until),
                        AdvisorSignal(
                            event_title=title,
                            company_id=company_id,
                            company_name=company.name,
                            ticker=company.ticker,
                            target_type=effect.target_type,
                            direction=direction,
                            weeks_until_effect=weeks_until,
                        ),
                    )
                )

        for pending in session.pending_effects:
            if pending.trigger_week >= week:
                add_real(pending.source_event_title, pending.effect, pending.trigger_week - week)
        if week_def:
            for event in week_def.events:
                for effect in event.effects:
                    add_real(event.title, effect, effect.delay_weeks)
        real.sort(key=lambda item: item[0], reverse=True)
        real_signals = [signal for _, signal in real]

        if accurate:
            signals = real_signals[:4]
        else:
            signals = []
            if week_def:
                for event in week_def.events:
                    insight = self.repo.noise_insight(event.id) if event.is_noise else None
                    if not insight or not insight.related_company_id:
                        continue
                    related = insight.related_company_id
                    if session.companies[related].is_bankrupt or not self._is_listed(related, week):
                        continue
                    company = self.repo.company(insight.related_company_id)
                    signals.append(
                        AdvisorSignal(
                            event_title=event.title,
                            company_id=company.id,
                            company_name=company.name,
                            ticker=company.ticker,
                            target_type=TargetType.STOCK_PRICE,
                            direction=insight.misleading_direction,
                            weeks_until_effect=0,
                            is_noise=True,
                        )
                    )
            if not signals:
                # No rumor available: misread a real signal by flipping its direction.
                company_signals = [sig for sig in real_signals if sig.company_id]
                if company_signals:
                    flipped = company_signals[0].model_copy(
                        update={"direction": "down" if company_signals[0].direction == "up" else "up"}
                    )
                    signals = [flipped]

        return AdvisorContext(
            week=week,
            total_weeks=self.repo.scenario.total_weeks,
            accurate=accurate,
            signals=signals,
            companies=companies,
            player_cash=session.cash,
            rent_due_week=self._next_rent_due_from(session, week),
            monthly_rent=session.monthly_rent,
        )

    # =====================================================================
    # Internals - views
    # =====================================================================
    async def _load(self, session_id: str) -> GameSession:
        session = await self.store.get(session_id)
        if session is None:
            raise SessionNotFoundError("Game session not found - it may have expired. Please start a new game.")
        return session

    @staticmethod
    def _ensure_running(session: GameSession) -> None:
        if session.is_game_over:
            raise GameOverError("This game is over. Start a new game to play again.")

    def _is_listed(self, company_id: str, week: int) -> bool:
        company = self.repo.company(company_id)
        return company is not None and company.listed_week <= week

    def _listing_interval(self) -> int | None:
        weeks = sorted({c.listed_week for c in self.repo.companies if c.listed_week > 1})
        if len(weeks) < 2:
            return None
        gaps = {b - a for a, b in zip(weeks, weeks[1:])}
        return gaps.pop() if len(gaps) == 1 else None

    def _sell_price(self, market_price: float) -> float:
        return r2(market_price * (1 - self.repo.scenario.sell_spread))

    @staticmethod
    def _max_affordable(cash: float, price: float) -> int:
        if price <= 0 or cash <= 0:
            return 0
        shares = math.floor(cash / price + 1e-9)
        while shares > 0 and r2(shares * price) > cash + 1e-9:
            shares -= 1
        return max(0, shares)

    def _stocks_value(self, session: GameSession) -> float:
        return r2(
            sum(
                p.shares * session.companies[cid].price
                for cid, p in session.portfolio.items()
                if not session.companies[cid].is_bankrupt
            )
        )

    def _net_worth(self, session: GameSession) -> float:
        return r2(session.cash + self._stocks_value(session))

    def _risk_level(self, risk: float) -> RiskLevel:
        thresholds = self.repo.scenario.risk_thresholds
        if risk >= thresholds.critical:
            return RiskLevel.CRITICAL
        if risk >= thresholds.elevated:
            return RiskLevel.ELEVATED
        return RiskLevel.LOW

    def _log(
        self,
        session: GameSession,
        *,
        action_type: ActionType,
        company_id: str | None = None,
        ticker: str | None = None,
        shares: int | None = None,
        price: float | None = None,
        amount: float = 0.0,
        note: str = "",
        details: dict | None = None,
        week: int | None = None,
    ) -> None:
        session.action_log.append(
            ActionLogEntry(
                seq=len(session.action_log) + 1,
                week=week if week is not None else session.current_week,
                action_type=action_type,
                company_id=company_id,
                ticker=ticker,
                shares=shares,
                price=price,
                amount=r2(amount),
                cash_after=session.cash,
                note=note,
                details=details or {},
            )
        )

    def _consequence_view(self, c: TriggeredConsequence) -> ConsequenceView:
        return ConsequenceView(
            event_title=c.event_title,
            source_week=c.source_week,
            trigger_week=c.trigger_week,
            is_delayed=c.is_delayed,
            delay_weeks=c.delay_weeks,
            target_type=c.target_type,
            target_label=c.target_label,
            direction=c.direction,
            impact_label=c.impact_label,
            consequence_text=c.consequence_text,
            affected_tickers=[i.ticker for i in c.company_impacts],
            player_was_exposed=any(i.player_shares > 0 for i in c.company_impacts),
        )

    def _market_timeline(self, session: GameSession) -> list[TimelineEntry]:
        weeks_played = len(session.weekly_snapshots)
        entries = []
        for week_number, event in self.repo.iter_events():
            if week_number > weeks_played:
                continue
            effects = []
            for effect in event.effects:
                trigger = week_number + effect.delay_weeks
                label = self.repo.target_label(effect.target_type, effect.target_id)
                if effect.delay_weeks == 0:
                    timing = "same week"
                elif trigger <= weeks_played:
                    timing = f"landed in Week {trigger} ({effect.delay_weeks}-week delay)"
                else:
                    timing = f"would have landed in Week {trigger}"
                effects.append(f"{label}: {self._impact_label(effect)} - {timing}")
            insight = self.repo.noise_insight(event.id) if event.is_noise else None
            entries.append(
                TimelineEntry(
                    week=week_number,
                    event_id=event.id,
                    title=event.title,
                    is_noise=event.is_noise,
                    effects=effects,
                    noise_explanation=insight.reveal if insight else None,
                )
            )
        return entries

    def _company_view(self, session: GameSession, company_id: str) -> CompanyView:
        company = self.repo.company(company_id)
        state = session.companies[company_id]
        position = session.portfolio.get(company_id)
        shares = position.shares if position else 0
        has_history = len(session.price_history) > 1
        just_listed = (
            company.listed_week > 1 and company.listed_week == session.current_week and not session.is_game_over
        )
        change_pct = None
        if has_history and state.previous_price > 0:
            change_pct = round((state.price - state.previous_price) / state.previous_price * 100, 2)
        if state.bankruptcy_risk > state.previous_risk + 1e-9:
            risk_trend = "up"
        elif state.bankruptcy_risk < state.previous_risk - 1e-9:
            risk_trend = "down"
        else:
            risk_trend = "neutral"
        return CompanyView(
            id=company.id,
            name=company.name,
            ticker=company.ticker,
            industry=company.industry,
            industry_label=self.repo.industry_label(company.industry),
            color=self.repo.company_color(company.id),
            main_product=company.main_product,
            description=company.description,
            country=company.country,
            owner=company.owner,
            condition=company.condition,
            price=state.price,
            previous_price=state.previous_price,
            sell_price=0.0 if state.is_bankrupt else self._sell_price(state.price),
            change_pct=None if just_listed else change_pct,
            listed_week=company.listed_week,
            just_listed=just_listed,
            dividend_per_share=state.dividend_per_share,
            previous_dividend=state.previous_dividend,
            bankruptcy_risk=state.bankruptcy_risk,
            risk_level=self._risk_level(state.bankruptcy_risk),
            risk_trend=risk_trend,
            is_bankrupt=state.is_bankrupt,
            bankrupt_week=state.bankrupt_week,
            latest_note=state.latest_note,
            latest_note_week=state.latest_note_week,
            shares_owned=shares,
            avg_cost=position.avg_cost if position else 0.0,
            position_value=r2(shares * state.price) if not state.is_bankrupt else 0.0,
            max_affordable=0 if state.is_bankrupt else self._max_affordable(session.cash, state.price),
        )

    def _build_state(self, session: GameSession) -> GameStateResponse:
        s = self.repo.scenario
        week_def = self.repo.week(session.current_week)
        stocks_value = self._stocks_value(session)
        net_worth = r2(session.cash + stocks_value)

        if session.is_game_over or week_def is None:
            news: list[NewsItem] = []
        else:
            # KEY RULE: only title + description leave the server during a turn.
            news = [NewsItem(id=e.id, title=e.title, description=e.description) for e in week_def.events]

        next_due = None if session.is_game_over else self._next_rent_due_from(session, session.current_week)
        rent = RentView(
            enabled=session.modifiers.enable_living_costs,
            monthly_rent=session.monthly_rent,
            previous_monthly_rent=session.previous_monthly_rent,
            rent_delta=session.rent_delta,
            changed_week=session.rent_changed_week,
            change_source_week=session.rent_change_source_week,
            period_weeks=s.rent_period_weeks,
            next_due_week=next_due,
            weeks_until_due=(next_due - session.current_week) if next_due is not None else None,
            total_paid=session.total_rent_paid,
        )
        used_this_week = session.advisor_used_weeks.count(session.current_week) >= s.advisor_max_per_week
        advisor = AdvisorView(
            uses_left=session.advisor_uses_left,
            uses_total=s.advisor_uses_per_game,
            can_use=not session.is_game_over and session.advisor_uses_left > 0 and not used_this_week,
            used_this_week=used_this_week,
            accuracy_percent=round(s.advisor_accuracy * 100),
            disclaimer=ADVISOR_DISCLAIMER,
        )
        history = [NetWorthPoint(week=0, label="Start", net_worth=session.starting_cash)] + [
            NetWorthPoint(week=snap.week, label=f"W{snap.week}", net_worth=snap.net_worth)
            for snap in session.weekly_snapshots
        ]
        return GameStateResponse(
            session_id=session.session_id,
            game_mode=session.game_mode,
            modifiers=session.modifiers,
            scenario=ScenarioView(
                id=s.id,
                title=s.title,
                tagline=s.tagline,
                description=s.description,
                total_weeks=s.total_weeks,
                week_theme=week_def.theme if week_def else None,
            ),
            current_week=session.current_week,
            total_weeks=s.total_weeks,
            is_game_over=session.is_game_over,
            end_reason=session.end_reason,
            cash=session.cash,
            stocks_value=stocks_value,
            net_worth=net_worth,
            starting_cash=session.starting_cash,
            # ROI = investment return before living costs (rent is shown separately).
            roi_pct=round((net_worth + session.total_rent_paid - session.starting_cash) / session.starting_cash * 100, 2),
            total_dividends=session.total_dividends,
            sell_spread_pct=round(s.sell_spread * 100, 2),
            rent=rent,
            advisor=advisor,
            companies=[
                self._company_view(session, c.id)
                for c in self.repo.companies
                if self._is_listed(c.id, session.current_week)
            ],
            news=news,
            price_history=session.price_history,
            net_worth_history=history,
        )
