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
    MoveAnalysisContent,
    NoiseFollow,
    PlayerMetrics,
    PracticalTip,
    RentCheck,
    ShockOutcome,
    SuggestedAction,
    TargetType,
    TradeAction,
)
from app.services.data_loader import GameDataRepository

MAX_POINTS = 4
DEFAULT_TIP_ORDER = ["delayed_signals", "diversify", "cash_reserve", "noise", "patience", "dividends"]


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
    for snap in session.weekly_snapshots:
        if snap.net_worth > 0:
            invested_ratios.append(max(0.0, min(1.0, snap.stocks_value / snap.net_worth)))
        meaningful = snap.net_worth > 0 and snap.stocks_value / snap.net_worth >= 0.2
        if snap.stocks_value > 0 and meaningful:
            for company_id, shares in snap.holdings.items():
                share = shares * snap.prices.get(company_id, 0.0) / snap.stocks_value
                if share > max_concentration:
                    max_concentration, max_ticker = share, ticker(company_id)
    avg_invested = sum(invested_ratios) / len(invested_ratios) if invested_ratios else 0.0

    # --- delayed signals & immediate shocks --------------------------------
    delayed: list[DelayedSignalOutcome] = []
    shocks: list[ShockOutcome] = []
    for consequence in session.consequence_log:
        if consequence.target_type != TargetType.STOCK_PRICE:
            continue
        for impact in consequence.company_impacts:
            if consequence.is_delayed:
                if consequence.direction == "up":
                    outcome = "caught" if impact.player_shares > 0 else "missed"
                elif impact.player_shares > 0:
                    outcome = "hit"
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
        if payment.cash_after < 0:
            status = "short"
        elif payment.cash_before < payment.amount * 1.5:
            status = "tight"
        else:
            status = "comfortable"
        rent_checks.append(
            RentCheck(week=payment.week, rent=payment.amount, cash_before=payment.cash_before, status=status)
        )
    liquidity_loss = session.end_reason == EndReason.LIQUIDITY
    liquidity_week = session.rent_payments[-1].week if liquidity_loss and session.rent_payments else None

    final_net_worth = session.weekly_snapshots[-1].net_worth if session.weekly_snapshots else session.cash
    # ROI measures investing skill: market gains + dividends, before living costs (rent).
    roi = (final_net_worth + session.total_rent_paid - session.starting_cash) / session.starting_cash * 100

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
    busy_threshold = 2 * max(m.weeks_played, 1) + 2

    # ---------------- strengths ----------------
    for signal in [d for d in m.delayed_signals if d.outcome == "caught"][:2]:
        strengths.append(
            point(
                "s_caught_delayed",
                shares=signal.player_shares,
                ticker=signal.ticker,
                event=signal.event_title,
                source_week=signal.source_week,
                trigger_week=signal.trigger_week,
                impact=signal.impact_label,
            )
        )
    for signal in [d for d in m.delayed_signals if d.outcome == "dodged"][:1]:
        strengths.append(
            point(
                "s_dodged_delayed",
                ticker=signal.ticker,
                event=signal.event_title,
                source_week=signal.source_week,
                trigger_week=signal.trigger_week,
            )
        )
    if m.distinct_companies >= 3 and m.distinct_industries >= 2 and m.max_concentration_pct < 70:
        strengths.append(point("s_diversified", count=m.distinct_companies, industries=m.distinct_industries))
    for check in [c for c in m.rent_checks if c.status == "comfortable"][:1]:
        strengths.append(point("s_cash_reserve", cash=money(check.cash_before), rent=money(check.rent), week=check.week))
    for outcome in m.bankruptcies:
        if outcome.outcome == "exited":
            strengths.append(point("s_exited_risk", ticker=outcome.ticker, week=outcome.week))
        elif outcome.outcome == "avoided" and m.trades_count > 0:
            strengths.append(point("s_avoided_bankrupt", ticker=outcome.ticker, week=outcome.week))
    if m.noise_events_total > 0 and not m.noise_followed and m.trades_count > 0:
        strengths.append(point("s_ignored_noise", count=m.noise_events_total))
    if m.total_dividends >= 10:
        strengths.append(point("s_dividends", amount=money(m.total_dividends)))
    if m.roi_pct > 0 and not m.liquidity_loss:
        strengths.append(point("s_profit", net_worth=money(m.final_net_worth), roi=signed_pct(m.roi_pct)))
    if not strengths:
        strengths.append(point("s_finished", weeks=m.weeks_played))

    # ---------------- improvements (most severe first) ----------------
    if m.liquidity_loss:
        last = m.rent_checks[-1] if m.rent_checks else None
        improvements.append(
            point(
                "i_liquidity",
                rent=money(last.rent) if last else "",
                week=m.liquidity_week,
                cash=money(last.cash_before - last.rent) if last else "",
            )
        )
        tip_keys.append("cash_reserve")
    for check in [c for c in m.rent_checks if c.status == "tight"][:1]:
        improvements.append(point("i_low_cash", rent=money(check.rent), week=check.week, cash=money(check.cash_before)))
        tip_keys.append("cash_reserve")
    for outcome in [b for b in m.bankruptcies if b.outcome == "loss"][:1]:
        improvements.append(
            point("i_bankrupt_loss", shares=outcome.player_shares, ticker=outcome.ticker, week=outcome.week, loss=money(outcome.loss))
        )
        tip_keys.append("bankruptcy")
    for signal in [d for d in m.delayed_signals if d.outcome == "hit"][:1]:
        improvements.append(
            point(
                "i_hit_delayed",
                shares=signal.player_shares,
                ticker=signal.ticker,
                event=signal.event_title,
                source_week=signal.source_week,
                trigger_week=signal.trigger_week,
                impact=signal.impact_label,
            )
        )
        tip_keys.append("delayed_signals")
    missed = [d for d in m.delayed_signals if d.outcome == "missed"]
    if missed:
        signal = missed[0]
        improvements.append(
            point(
                "i_missed_delayed",
                event=signal.event_title,
                source_week=signal.source_week,
                ticker=signal.ticker,
                trigger_week=signal.trigger_week,
                impact=signal.impact_label,
            )
        )
        tip_keys.append("delayed_signals")
    if m.immediate_shocks:
        worst = max(m.immediate_shocks, key=lambda s: s.loss)
        if worst.loss > 0:
            improvements.append(
                point(
                    "i_immediate_hit",
                    shares=worst.player_shares,
                    ticker=worst.ticker,
                    event=worst.event_title,
                    week=worst.week,
                    loss=money(worst.loss),
                )
            )
            tip_keys.append("diversify")
    if m.max_concentration_pct >= 70 and m.max_concentration_ticker:
        improvements.append(point("i_concentrated", share=f"{m.max_concentration_pct:.0f}%", ticker=m.max_concentration_ticker))
        tip_keys.append("diversify")
    if m.noise_followed:
        follow = m.noise_followed[0]
        verb = "bought" if follow.action == TradeAction.BUY else "sold"
        improvements.append(point("i_followed_noise", week=follow.week, action=verb, ticker=follow.ticker, event=follow.event_title))
        tip_keys.append("noise")
    for use in [u for u in m.advisor_uses if not u.accurate and u.followed][:1]:
        verb = "bought" if use.followed_action == TradeAction.BUY else "sold"
        improvements.append(point("i_followed_bad_advice", week=use.week, ticker=use.ticker or "the stock", action=verb))
        tip_keys.append("advisor")
    if m.avg_invested_pct < 30:
        improvements.append(point("i_idle_cash", share=f"{m.avg_invested_pct:.0f}%"))
        tip_keys.append("dividends")
    if m.trades_count >= busy_threshold:
        improvements.append(point("i_overtrading", count=m.trades_count, weeks=m.weeks_played))
        tip_keys.append("patience")
    if not improvements:
        improvements.append(point("i_next_level"))
        tip_keys.append("delayed_signals")

    # ---------------- tips: 4 unique cards ----------------
    ordered: list[str] = []
    for key in tip_keys + DEFAULT_TIP_ORDER:
        if key in texts.tips and key not in ordered:
            ordered.append(key)
    tips = [PracticalTip(title=texts.tips[k].title, tip=texts.tips[k].tip) for k in ordered[:4]]

    style = texts.play_styles.get(m.play_style_key) or next(iter(texts.play_styles.values()))
    if m.liquidity_loss:
        overall = fill(texts.overall_liquidity, week=m.liquidity_week)
    elif m.roi_pct > 2:
        overall = fill(texts.overall_positive, net_worth=money(m.final_net_worth), roi=signed_pct(m.roi_pct))
    elif m.roi_pct >= -2:
        overall = fill(texts.overall_neutral, net_worth=money(m.final_net_worth), roi=signed_pct(m.roi_pct))
    else:
        overall = fill(texts.overall_negative, net_worth=money(m.final_net_worth), roi=signed_pct(m.roi_pct))

    return MoveAnalysisContent(
        play_style=style.label,
        play_style_summary=style.description,
        overall_message=overall,
        strengths=strengths[:MAX_POINTS],
        improvements=improvements[:MAX_POINTS],
        actionable_tips=tips,
    )
