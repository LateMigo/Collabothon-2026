"""Deterministic, explainable analysis of a finished game.

`compute_player_metrics` turns the raw action log, weekly snapshots and the
consequence log into facts (diversification, liquidity before rent, reaction to
delayed signals, bankruptcies, noise, advisor use). Those facts are:
  * sent to Gemini as grounding for the AI Coach, and
  * turned into the "Smart Offline Analysis" by `build_fallback_analysis`.
"""

from __future__ import annotations

import string
from typing import Any

from app.models.schemas import (
    ActionType,
    AdvisorUse,
    AnalysisPoint,
    BankruptcyOutcome,
    DelayedSignalOutcome,
    EndReason,
    GameSession,
    InspectorVerdict,
    KeyMoment,
    MoveAnalysisContent,
    NoiseFollow,
    PlayerMetrics,
    PracticalTip,
    RealLifeHabit,
    RentCheck,
    ShockOutcome,
    SuggestedAction,
    TargetType,
    TradeAction,
)
from app.services.data_loader import GameDataRepository

MAX_POINTS = 4
KEY_MOMENTS = 2
DEFAULT_TIP_ORDER = ["delayed_signals", "diversify", "cash_reserve", "savings", "noise", "patience", "dividends"]


# =============================================================================
# Formatting helpers (shared with the AI fallback)
# =============================================================================


def money(value: float) -> str:
    sign = "-" if value < 0 else ""
    return f"{sign}${abs(value):,.2f}"


def signed_money(value: float) -> str:
    return f"+{money(value)}" if value >= 0 else money(value)


def signed_pct(value: float) -> str:
    return f"{value:+.1f}%"


def rate_pct(rate: float) -> float:
    """0.003 -> 0.3 (a weekly rate shown in percent)."""
    return round(rate * 100, 2)


class _SafeDict(dict):
    def __missing__(self, key: str) -> str:
        return "{" + key + "}"


def fill(template: str, **values: Any) -> str:
    """str.format that never raises on a missing placeholder."""
    return string.Formatter().vformat(template, (), _SafeDict(**values))


# =============================================================================
# Metrics
# =============================================================================


def compute_player_metrics(session: GameSession, repo: GameDataRepository) -> PlayerMetrics:
    trades = [a for a in session.action_log if a.action_type in (ActionType.BUY, ActionType.SELL)]
    buys = [a for a in trades if a.action_type == ActionType.BUY]
    sells = [a for a in trades if a.action_type == ActionType.SELL]

    bought_ids = {a.company_id for a in buys if a.company_id}
    industries = {repo.company(cid).industry for cid in bought_ids if repo.company(cid)}

    def ticker(company_id: str) -> str:
        company = repo.company(company_id)
        return company.ticker if company else company_id

    # --- diversification & invested share (from end-of-week snapshots) -----
    max_concentration = 0.0
    max_ticker: str | None = None
    invested_ratios: list[float] = []
    savings_ratios: list[float] = []
    for snap in session.weekly_snapshots:
        if snap.net_worth > 0:
            invested_ratios.append(max(0.0, min(1.0, snap.stocks_value / snap.net_worth)))
            # "safe money": the savings vault plus bonds and term deposits
            safe = snap.savings + snap.fixed_income_value
            savings_ratios.append(max(0.0, min(1.0, safe / snap.net_worth)))
        meaningful = snap.net_worth > 0 and snap.stocks_value / snap.net_worth >= 0.2
        if snap.stocks_value > 0 and meaningful:
            for company_id, shares in snap.holdings.items():
                share = shares * snap.prices.get(company_id, 0.0) / snap.stocks_value
                if share > max_concentration:
                    max_concentration, max_ticker = share, ticker(company_id)
    avg_invested = sum(invested_ratios) / len(invested_ratios) if invested_ratios else 0.0
    avg_savings = sum(savings_ratios) / len(savings_ratios) if savings_ratios else 0.0

    # --- delayed signals & immediate shocks --------------------------------
    delayed: list[DelayedSignalOutcome] = []
    shocks: list[ShockOutcome] = []
    for consequence in session.consequence_log:
        if consequence.target_type != TargetType.STOCK_PRICE:
            continue
        for impact in consequence.company_impacts:
            if consequence.is_delayed:
                bought_week = None
                if consequence.direction == "up":
                    outcome = "caught" if impact.player_shares > 0 else "missed"
                elif impact.player_shares > 0:
                    outcome = "hit"
                    # Did the player BUY after the warning headline was already out?
                    bought_week = next(
                        (
                            b.week
                            for b in buys
                            if b.company_id == impact.company_id
                            and consequence.source_week <= b.week <= consequence.trigger_week
                        ),
                        None,
                    )
                else:
                    sold_in_window = any(
                        s.company_id == impact.company_id
                        and consequence.source_week <= s.week <= consequence.trigger_week
                        for s in sells
                    )
                    outcome = "dodged" if sold_in_window else "neutral"
                delayed.append(
                    DelayedSignalOutcome(
                        event_title=consequence.event_title,
                        company_id=impact.company_id,
                        ticker=impact.ticker,
                        source_week=consequence.source_week,
                        trigger_week=consequence.trigger_week,
                        impact_label=consequence.impact_label,
                        direction=consequence.direction,
                        player_shares=impact.player_shares,
                        value_change=round(impact.player_shares * (impact.after - impact.before), 2),
                        bought_week=bought_week,
                        outcome=outcome,
                    )
                )
            elif consequence.direction == "down" and impact.player_shares > 0:
                shocks.append(
                    ShockOutcome(
                        event_title=consequence.event_title,
                        ticker=impact.ticker,
                        week=consequence.trigger_week,
                        impact_label=consequence.impact_label,
                        player_shares=impact.player_shares,
                        loss=round(impact.player_shares * (impact.before - impact.after), 2),
                    )
                )

    # --- bankruptcies --------------------------------------------------------
    bankruptcy_outcomes: list[BankruptcyOutcome] = []
    for record in session.bankruptcies:
        if record.player_shares > 0:
            outcome, loss = "loss", round(record.player_shares * record.last_price, 2)
        elif record.company_id in bought_ids:
            outcome, loss = "exited", 0.0
        else:
            outcome, loss = "avoided", 0.0
        bankruptcy_outcomes.append(
            BankruptcyOutcome(
                company_id=record.company_id,
                ticker=ticker(record.company_id),
                week=record.week,
                outcome=outcome,
                player_shares=record.player_shares,
                loss=loss,
            )
        )

    # --- noise ---------------------------------------------------------------
    weeks_played = len(session.weekly_snapshots)
    noise_total = 0
    noise_followed: list[NoiseFollow] = []
    for week_number, event in repo.iter_events():
        if not event.is_noise or week_number > weeks_played:
            continue
        noise_total += 1
        insight = repo.noise_insight(event.id)
        if not insight or not insight.related_company_id:
            continue
        wanted = ActionType.BUY if insight.misleading_direction == "up" else ActionType.SELL
        match = next(
            (
                t
                for t in trades
                if t.week == week_number
                and t.company_id == insight.related_company_id
                and t.action_type == wanted
            ),
            None,
        )
        if match:
            noise_followed.append(
                NoiseFollow(
                    week=week_number,
                    event_title=event.title,
                    ticker=ticker(insight.related_company_id),
                    action=TradeAction(match.action_type.value),
                )
            )

    # --- advisor -------------------------------------------------------------
    advisor_uses: list[AdvisorUse] = []
    for entry in session.action_log:
        if entry.action_type != ActionType.ADVISOR:
            continue
        focus = entry.details.get("focus_company_id")
        suggested = SuggestedAction(entry.details.get("suggested_action", SuggestedAction.WATCH))
        wanted = {SuggestedAction.BUY: ActionType.BUY, SuggestedAction.SELL: ActionType.SELL}.get(suggested)
        follow = None
        if focus and wanted:
            follow = next(
                (
                    t
                    for t in trades
                    if t.seq > entry.seq and t.week == entry.week and t.company_id == focus and t.action_type == wanted
                ),
                None,
            )
        advisor_uses.append(
            AdvisorUse(
                week=entry.week,
                accurate=bool(entry.details.get("accurate", False)),
                ticker=ticker(focus) if focus else None,
                suggested_action=suggested,
                followed=follow is not None,
                followed_action=TradeAction(follow.action_type.value) if follow else None,
            )
        )

    # --- rent / liquidity ----------------------------------------------------
    rent_checks = []
    for payment in session.rent_payments:
        ready = payment.cash_before + payment.savings_before  # savings cover rent automatically
        if payment.cash_after < 0:
            status = "short"
        elif ready < payment.amount * 1.5:
            status = "tight"
        else:
            status = "comfortable"
        rent_checks.append(
            RentCheck(
                week=payment.week,
                rent=payment.amount,
                cash_before=payment.cash_before,
                savings_before=payment.savings_before,
                from_savings=payment.from_savings,
                status=status,
            )
        )
    liquidity_loss = session.end_reason == EndReason.LIQUIDITY
    liquidity_week = session.rent_payments[-1].week if liquidity_loss and session.rent_payments else None

    final_net_worth = session.weekly_snapshots[-1].net_worth if session.weekly_snapshots else session.cash
    # ROI measures investing skill: market gains + dividends + interest, before living costs (rent).
    roi = (final_net_worth + session.total_rent_paid - session.starting_cash) / session.starting_cash * 100

    # --- bonds & term deposits ----------------------------------------------
    fi_defaults = [a for a in session.action_log if a.action_type == ActionType.FIXED_INCOME_DEFAULT]
    fi_interest = session.total_fixed_income_interest + sum(
        h.accrued_interest for h in session.fixed_income if h.status == "active"
    )

    def product_name(product_id: str) -> str:
        product = repo.fixed_income_product(product_id)
        return product.name if product else "A bond"

    metrics = PlayerMetrics(
        final_net_worth=round(final_net_worth, 2),
        starting_cash=session.starting_cash,
        roi_pct=round(roi, 2),
        total_dividends=round(session.total_dividends, 2),
        total_rent_paid=round(session.total_rent_paid, 2),
        trades_count=len(trades),
        buys_count=len(buys),
        sells_count=len(sells),
        distinct_companies=len(bought_ids),
        distinct_industries=len(industries),
        max_concentration_pct=round(max_concentration * 100, 1),
        max_concentration_ticker=max_ticker,
        avg_invested_pct=round(avg_invested * 100, 1),
        avg_savings_pct=round(avg_savings * 100, 1),
        final_savings=round(session.savings, 2),
        total_interest=round(session.total_interest, 2),
        rent_covered_by_savings=round(sum(p.from_savings for p in session.rent_payments), 2),
        fixed_income_interest=round(fi_interest, 2),
        fixed_income_bought=sum(1 for a in session.action_log if a.action_type == ActionType.FIXED_INCOME_BUY),
        fixed_income_defaults=[product_name(a.details.get("product_id", "")) for a in fi_defaults],
        fixed_income_default_loss=round(sum(float(a.details.get("lost", 0.0)) for a in fi_defaults), 2),
        fixed_income_default_week=fi_defaults[0].week if fi_defaults else None,
        noise_events_total=noise_total,
        noise_followed=noise_followed,
        delayed_signals=delayed,
        immediate_shocks=shocks,
        bankruptcies=bankruptcy_outcomes,
        advisor_uses=advisor_uses,
        rent_checks=rent_checks,
        liquidity_loss=liquidity_loss,
        liquidity_week=liquidity_week,
        weeks_played=weeks_played,
        play_style_key="balanced",
    )
    metrics.play_style_key = classify_play_style(metrics)
    return metrics


def classify_play_style(m: PlayerMetrics) -> str:
    busy_threshold = 2 * max(m.weeks_played, 1) + 2
    if m.trades_count == 0 or m.avg_invested_pct < 30:
        return "cautious"
    if len(m.noise_followed) >= 2 or (m.noise_followed and m.trades_count >= busy_threshold):
        return "reactive"
    if m.distinct_companies <= 1 or m.max_concentration_pct >= 75:
        return "concentrated"
    if m.avg_invested_pct >= 85 or m.trades_count >= busy_threshold:
        return "aggressive"
    return "balanced"


# =============================================================================
# Offline ("Smart Offline Analysis") coach
# =============================================================================


def build_fallback_analysis(m: PlayerMetrics, repo: GameDataRepository) -> MoveAnalysisContent:
    texts = repo.fallback.final_analysis
    insights = texts.insights

    def point(key: str, **values: Any) -> AnalysisPoint:
        template = insights[key]
        return AnalysisPoint(title=fill(template.title, **values), detail=fill(template.detail, **values))

    strengths: list[AnalysisPoint] = []
    improvements: list[AnalysisPoint] = []
    tip_keys: list[str] = []
    # Candidate "weeks that decided the season": (kind, severity, moment).
    moments: list[tuple[str, float, KeyMoment]] = []
    busy_threshold = 2 * max(m.weeks_played, 1) + 2

    def note(bucket: list[AnalysisPoint], key: str, *, week: int | None = None, severity: float = 0.0, **values: Any):
        """Add a strength/improvement; when it belongs to a specific week it is also a key-moment candidate."""
        if week is not None:
            values.setdefault("week", week)
        p = point(key, **values)
        bucket.append(p)
        if week is not None:
            kind = "win" if bucket is strengths else "mistake"
            moments.append((kind, severity, KeyMoment(week=week, kind=kind, title=p.title, detail=p.detail)))

    # ---------------- strengths ----------------
    for signal in [d for d in m.delayed_signals if d.outcome == "caught"][:2]:
        note(
            strengths,
            "s_caught_delayed",
            week=signal.trigger_week,
            severity=abs(signal.value_change),
            shares=signal.player_shares,
            ticker=signal.ticker,
            event=signal.event_title,
            source_week=signal.source_week,
            trigger_week=signal.trigger_week,
            impact=signal.impact_label,
        )
    for signal in [d for d in m.delayed_signals if d.outcome == "dodged"][:1]:
        note(
            strengths,
            "s_dodged_delayed",
            week=signal.trigger_week,
            severity=60,
            ticker=signal.ticker,
            event=signal.event_title,
            source_week=signal.source_week,
            trigger_week=signal.trigger_week,
        )
    if m.distinct_companies >= 3 and m.distinct_industries >= 2 and m.max_concentration_pct < 70:
        note(strengths, "s_diversified", count=m.distinct_companies, industries=m.distinct_industries)
    for check in [c for c in m.rent_checks if c.from_savings > 0 and c.status != "short"][:1]:
        note(strengths, "s_savings_rent", week=check.week, severity=55, amount=money(check.from_savings), rent=money(check.rent))
    for check in [c for c in m.rent_checks if c.status == "comfortable"][:1]:
        note(
            strengths,
            "s_cash_reserve",
            week=check.week,
            severity=10,
            cash=money(check.cash_before + check.savings_before),
            rent=money(check.rent),
        )
    if m.total_interest >= 1:
        note(strengths, "s_savings", interest=money(m.total_interest), savings=money(m.final_savings))
    if m.fixed_income_interest >= 1 and not m.fixed_income_defaults:
        note(strengths, "s_fixed_income", interest=money(m.fixed_income_interest), count=m.fixed_income_bought)
    for outcome in m.bankruptcies:
        if outcome.outcome == "exited":
            note(strengths, "s_exited_risk", week=outcome.week, severity=80, ticker=outcome.ticker)
        elif outcome.outcome == "avoided" and m.trades_count > 0:
            note(strengths, "s_avoided_bankrupt", week=outcome.week, severity=5, ticker=outcome.ticker)
    if m.noise_events_total > 0 and not m.noise_followed and m.trades_count > 0:
        note(strengths, "s_ignored_noise", count=m.noise_events_total)
    if m.total_dividends >= 10:
        note(strengths, "s_dividends", amount=money(m.total_dividends))
    if m.roi_pct > 0 and not m.liquidity_loss:
        note(strengths, "s_profit", net_worth=money(m.final_net_worth), roi=signed_pct(m.roi_pct))
    if not strengths:
        note(strengths, "s_finished", weeks=m.weeks_played)

    # ---------------- improvements (most severe first) ----------------
    if m.liquidity_loss:
        last = m.rent_checks[-1] if m.rent_checks else None
        note(
            improvements,
            "i_liquidity",
            week=m.liquidity_week,
            severity=10_000,
            rent=money(last.rent) if last else "",
            cash=money(last.cash_before + last.from_savings - last.rent) if last else "",
        )
        tip_keys.append("cash_reserve")
    for check in [c for c in m.rent_checks if c.status == "tight"][:1]:
        note(
            improvements,
            "i_low_cash",
            week=check.week,
            severity=40,
            rent=money(check.rent),
            cash=money(check.cash_before + check.savings_before),
        )
        tip_keys.append("cash_reserve")
    for outcome in [b for b in m.bankruptcies if b.outcome == "loss"][:1]:
        note(
            improvements,
            "i_bankrupt_loss",
            week=outcome.week,
            severity=max(outcome.loss, 1.0) + 50,
            shares=outcome.player_shares,
            ticker=outcome.ticker,
            loss=money(outcome.loss),
        )
        tip_keys.append("bankruptcy")
    if m.fixed_income_defaults:
        note(
            improvements,
            "i_bond_default",
            week=m.fixed_income_default_week,
            severity=m.fixed_income_default_loss + 40,
            name=m.fixed_income_defaults[0],
            loss=money(m.fixed_income_default_loss),
        )
        tip_keys.append("bankruptcy")
    hits = [d for d in m.delayed_signals if d.outcome == "hit"]
    bad_news_buys = sorted((d for d in hits if d.bought_week is not None), key=lambda d: d.value_change)
    for signal in bad_news_buys[:1]:
        note(
            improvements,
            "i_bought_bad_news",
            week=signal.bought_week,
            severity=abs(signal.value_change) + 100,
            buy_week=signal.bought_week,
            ticker=signal.ticker,
            event=signal.event_title,
            source_week=signal.source_week,
            trigger_week=signal.trigger_week,
            impact=signal.impact_label,
            loss=money(abs(signal.value_change)),
        )
        tip_keys.append("delayed_signals")
    for signal in sorted((d for d in hits if d.bought_week is None), key=lambda d: d.value_change)[:1]:
        note(
            improvements,
            "i_hit_delayed",
            week=signal.trigger_week,
            severity=abs(signal.value_change),
            shares=signal.player_shares,
            ticker=signal.ticker,
            event=signal.event_title,
            source_week=signal.source_week,
            trigger_week=signal.trigger_week,
            impact=signal.impact_label,
        )
        tip_keys.append("delayed_signals")
    missed = [d for d in m.delayed_signals if d.outcome == "missed"]
    if missed:
        signal = missed[0]
        note(
            improvements,
            "i_missed_delayed",
            week=signal.source_week,
            severity=20,
            event=signal.event_title,
            source_week=signal.source_week,
            ticker=signal.ticker,
            trigger_week=signal.trigger_week,
            impact=signal.impact_label,
        )
        tip_keys.append("delayed_signals")
    if m.immediate_shocks:
        worst = max(m.immediate_shocks, key=lambda s: s.loss)
        if worst.loss > 0:
            note(
                improvements,
                "i_immediate_hit",
                week=worst.week,
                severity=worst.loss * 0.8,
                shares=worst.player_shares,
                ticker=worst.ticker,
                event=worst.event_title,
                loss=money(worst.loss),
            )
            tip_keys.append("diversify")
    if m.max_concentration_pct >= 70 and m.max_concentration_ticker:
        note(improvements, "i_concentrated", share=f"{m.max_concentration_pct:.0f}%", ticker=m.max_concentration_ticker)
        tip_keys.append("diversify")
    if m.noise_followed:
        follow = m.noise_followed[0]
        verb = "bought" if follow.action == TradeAction.BUY else "sold"
        note(
            improvements,
            "i_followed_noise",
            week=follow.week,
            severity=60,
            action=verb,
            ticker=follow.ticker,
            event=follow.event_title,
        )
        tip_keys.append("noise")
    for use in [u for u in m.advisor_uses if not u.accurate and u.followed][:1]:
        verb = "bought" if use.followed_action == TradeAction.BUY else "sold"
        note(improvements, "i_followed_bad_advice", week=use.week, severity=50, ticker=use.ticker or "the stock", action=verb)
        tip_keys.append("advisor")
    if m.avg_invested_pct < 30 and m.avg_savings_pct < 25:
        note(improvements, "i_idle_cash", share=f"{m.avg_invested_pct:.0f}%")
        tip_keys.append("savings")
    if m.trades_count >= busy_threshold:
        note(improvements, "i_overtrading", count=m.trades_count, weeks=m.weeks_played)
        tip_keys.append("patience")
    if not improvements:
        note(improvements, "i_next_level")
        tip_keys.append("delayed_signals")

    # ---------------- tips: 4 unique cards ----------------
    ordered: list[str] = []
    for key in tip_keys + DEFAULT_TIP_ORDER:
        if key in texts.tips and key not in ordered:
            ordered.append(key)
    tips = [PracticalTip(title=texts.tips[k].title, tip=texts.tips[k].tip) for k in ordered[:4]]

    style = texts.play_styles.get(m.play_style_key) or next(iter(texts.play_styles.values()))
    roi = signed_pct(m.roi_pct)
    if m.liquidity_loss:
        overall = fill(texts.overall_liquidity, week=m.liquidity_week)
    elif m.roi_pct > 2:
        overall = fill(texts.overall_positive, net_worth=money(m.final_net_worth), roi=roi)
    elif m.roi_pct >= -2:
        overall = fill(texts.overall_neutral, net_worth=money(m.final_net_worth), roi=roi)
    else:
        overall = fill(texts.overall_negative, net_worth=money(m.final_net_worth), roi=roi)

    return MoveAnalysisContent(
        verdict=build_verdict(m, repo),
        key_moments=pick_key_moments(moments, m, point),
        real_life_habit=pick_habit(m, repo),
        play_style=style.label,
        play_style_summary=style.description,
        overall_message=overall,
        strengths=strengths[:MAX_POINTS],
        improvements=improvements[:MAX_POINTS],
        actionable_tips=tips,
    )


# =============================================================================
# Inspector mode: verdict stamp, two decisive weeks, one real-life habit
# =============================================================================


def _bad_news_buys(m: PlayerMetrics) -> list[DelayedSignalOutcome]:
    return [d for d in m.delayed_signals if d.outcome == "hit" and d.bought_week is not None]


def verdict_key(m: PlayerMetrics) -> str:
    bankrupt_loss = any(b.outcome == "loss" for b in m.bankruptcies)
    chased = bool(m.noise_followed or _bad_news_buys(m))
    if m.liquidity_loss:
        return "evicted"
    if chased and m.roi_pct < 0:
        return "fomo"
    if m.play_style_key == "reactive" and m.roi_pct < 2:
        return "fomo"
    if bankrupt_loss or (m.play_style_key in ("concentrated", "aggressive") and m.roi_pct < 0):
        return "all_in"
    if m.roi_pct < -2:
        return "rookie"
    if m.play_style_key == "cautious":
        return "careful_saver"
    if m.roi_pct >= 5 and not m.noise_followed:
        return "prudent"
    if m.play_style_key in ("concentrated", "aggressive"):
        return "bold"
    return "steady"


def build_verdict(m: PlayerMetrics, repo: GameDataRepository) -> InspectorVerdict:
    key = verdict_key(m)
    template = repo.fallback.final_analysis.verdicts[key]
    values: dict[str, Any] = {"roi": signed_pct(m.roi_pct), "net_worth": money(m.final_net_worth), "week": m.liquidity_week}
    if key == "fomo":
        if m.noise_followed:
            follow = m.noise_followed[0]
            values.update(
                week=follow.week, ticker=follow.ticker, action="bought" if follow.action == TradeAction.BUY else "sold"
            )
        elif _bad_news_buys(m):
            buy = _bad_news_buys(m)[0]
            values.update(week=buy.bought_week, ticker=buy.ticker, action="bought")
    elif key == "all_in":
        loss = next((b for b in m.bankruptcies if b.outcome == "loss"), None)
        values["ticker"] = loss.ticker if loss else (m.max_concentration_ticker or "one company")
    return InspectorVerdict(approved=template.approved, title=template.title, reason=fill(template.reason, **values))


def pick_key_moments(candidates, m: PlayerMetrics, point) -> list[KeyMoment]:
    """Two weeks that decided the season: the costliest mistakes first, then the best wins."""
    chosen: list[KeyMoment] = []
    used_weeks: set[int] = set()

    def take(pool) -> None:
        for _, _, moment in sorted(pool, key=lambda c: -c[1]):
            if len(chosen) >= KEY_MOMENTS:
                return
            if moment.week in used_weeks:
                continue
            chosen.append(moment)
            used_weeks.add(moment.week)

    mistakes = [c for c in candidates if c[0] == "mistake"]
    wins = [c for c in candidates if c[0] == "win"]
    take([c for c in mistakes if c[1] >= 25])
    take(wins)
    take(mistakes)
    if len(chosen) < KEY_MOMENTS:
        p = point("s_finished", weeks=m.weeks_played)
        week = max(1, m.weeks_played)
        if week not in used_weeks:
            chosen.append(KeyMoment(week=week, kind="win", title=p.title, detail=p.detail))
    return sorted(chosen, key=lambda moment: moment.week)


def habit_key(m: PlayerMetrics) -> str:
    busy_threshold = 2 * max(m.weeks_played, 1) + 2
    if m.liquidity_loss or any(c.status != "comfortable" for c in m.rent_checks):
        return "emergency_fund"
    if m.noise_followed or m.play_style_key == "reactive":
        return "cooling_off"
    if any(b.outcome == "loss" for b in m.bankruptcies) or _bad_news_buys(m):
        return "check_health"
    if m.max_concentration_pct >= 70:
        return "spread"
    if m.trades_count >= busy_threshold:
        return "fees"
    if m.roi_pct < -2:
        return "review_monthly"
    return "automate"


def pick_habit(m: PlayerMetrics, repo: GameDataRepository) -> RealLifeHabit:
    habit = repo.fallback.final_analysis.habits[habit_key(m)]
    return RealLifeHabit(title=habit.title, habit=habit.habit)
