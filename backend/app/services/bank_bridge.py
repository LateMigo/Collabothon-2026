"""From the game to real life: Commerzbank next steps, and the KPI funnel that shows the bank's business case.

Two parts:
  * recommend_next_steps() - picks 3 real-life banking steps that match how the player played (no AI needed,
    every reason quotes the player's own numbers). These are example product categories for the demo, not
    financial advice.
  * KpiTracker - an in-memory event log (games started, weeks played, quizzes, lessons, offer clicks,
    challenge links) that turns into a funnel: player -> finished season -> clicked a bank offer.
"""

from __future__ import annotations

import time
from collections import Counter, defaultdict
from contextlib import contextmanager
from contextvars import ContextVar
from threading import Lock

from app.models.schemas import BankOffer, ChallengeEntry, KpiFunnel, KpiStep, PlayerMetrics

BANK_URL = "https://www.commerzbank.de"
OFFER_DISCLAIMER = (
    "Example next steps for this demo - not financial advice. Check the current offers and conditions at "
    "commerzbank.de or with a Commerzbank advisor."
)

PRODUCTS: dict[str, dict[str, str]] = {
    "savings": {
        "product": "Savings account",
        "headline": "Build your safety cushion",
        "what": "A Commerzbank savings account keeps an emergency fund safe and earns interest - and you can "
        "reach the money whenever a bill or a surprise comes.",
        "cta": "See savings accounts",
    },
    "savings_plan": {
        "product": "Fund savings plan",
        "headline": "Spread your money automatically",
        "what": "A monthly savings plan puts a small fixed amount into a fund that holds many companies at once - "
        "diversification without picking single shares.",
        "cta": "Explore savings plans",
    },
    "current_account": {
        "product": "Current account + banking app",
        "headline": "See where your money goes",
        "what": "A current account with the Commerzbank app shows your income and spending in one place - the "
        "first step to a budget and to paying bills on time.",
        "cta": "Open an account",
    },
    "standing_order": {
        "product": "Automatic savings transfer",
        "headline": "Pay yourself first",
        "what": "A standing order moves a fixed amount to savings on payday, before you can spend it - the "
        "easiest saving habit there is.",
        "cta": "Set up in online banking",
    },
    "advisor": {
        "product": "Free meeting with an advisor",
        "headline": "Turn your game lessons into a plan",
        "what": "A Commerzbank advisor can help you set a savings goal, an emergency fund and a first investing "
        "plan that fits your real income.",
        "cta": "Book a meeting",
    },
}


def _offer(product_id: str, why: str, rank: int) -> BankOffer:
    p = PRODUCTS[product_id]
    return BankOffer(
        id=product_id,
        product=p["product"],
        headline=p["headline"],
        why=why,
        what_it_is=p["what"],
        cta_label=p["cta"],
        url=BANK_URL,
        rank=rank,
    )


def recommend_next_steps(m: PlayerMetrics) -> list[BankOffer]:
    """Three real-life steps, the most relevant first. Every 'why' quotes the player's own season."""
    picks: list[tuple[str, str]] = []

    if m.expenses_paid_by_selling and not m.liquidity_loss:
        picks.append(
            (
                "savings",
                f"Surprise bills forced you to sell shares {m.expenses_paid_by_selling} "
                f"time{'s' if m.expenses_paid_by_selling != 1 else ''}. An emergency fund in savings pays those bills "
                "so your investments can stay put.",
            )
        )
    if m.liquidity_loss:
        picks.append(
            (
                "savings",
                f"You ran out of money for the rent in Week {m.liquidity_week}. A cushion in savings would have "
                "paid that bill without selling anything.",
            )
        )
    else:
        tight = [c for c in m.rent_checks if c.status != "comfortable"]
        if tight or m.avg_savings_pct < 10:
            if tight:
                reason = f"Rent day was tight {len(tight)} time{'s' if len(tight) != 1 else ''} this season."
            elif m.avg_savings_pct < 1:
                reason = "You kept no money in savings this season."
            else:
                reason = f"On average only {m.avg_savings_pct:.0f}% of your money sat in savings."
            picks.append(("savings", reason + " A savings account keeps bill money safe and earning."))

    bankrupt_loss = next((b for b in m.bankruptcies if b.outcome == "loss" and b.loss > 0), None)
    if bankrupt_loss:
        picks.append(
            (
                "savings_plan",
                f"You lost ${bankrupt_loss.loss:,.0f} when {bankrupt_loss.ticker} went bankrupt. A fund spreads the same "
                "money over many companies, so one failure can't sink it.",
            )
        )
    elif m.trades_count > 0 and m.max_concentration_pct >= 60:
        ticker = m.max_concentration_ticker or "one company"
        picks.append(
            (
                "savings_plan",
                f"At one point {m.max_concentration_pct:.0f}% of your shares were in {ticker}. A fund spreads the "
                "same money over many companies, so one bad headline can't sink it.",
            )
        )
    elif m.trades_count == 0 or m.play_style_key == "cautious":
        picks.append(
            (
                "savings_plan",
                "You played it very safe. A small monthly savings plan is a gentle way to let part of your money "
                "grow over many years.",
            )
        )

    if m.final_savings > 0 or m.total_interest > 0:
        picks.append(
            (
                "standing_order",
                f"Your savings earned ${m.total_interest:,.2f} in interest without any risk. An automatic transfer "
                "on payday makes that habit happen on its own.",
            )
        )

    picks.append(
        (
            "current_account",
            f"You paid ${m.total_rent_paid:,.0f} in rent this season. Seeing every bill in one app is how a real "
            "budget starts.",
        )
    )
    picks.append(
        (
            "advisor",
            "You've practised with play money for a whole season - an advisor can help you do the same with real "
            "goals, step by step.",
        )
    )

    seen: set[str] = set()
    offers: list[BankOffer] = []
    for product_id, why in picks:
        if product_id in seen:
            continue
        seen.add(product_id)
        offers.append(_offer(product_id, why, len(offers) + 1))
        if len(offers) == 3:
            break
    return offers


TRACKED_EVENTS = {
    "game_started",
    "week_completed",
    "game_finished",
    "offers_shown",
    "offer_clicked",
    "quiz_answered",
    "quiz_correct",
    "lesson_completed",
    "challenge_shared",
    "challenge_joined",
    "glossary_question",
    "research_used",
    "budget_plan",
    "what_if_viewed",
}


class KpiTracker:
    """Counts events and unique sessions per event. In memory: enough for a live demo dashboard."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._counts: Counter[str] = Counter()
        self._sessions: dict[str, set[str]] = defaultdict(set)
        self._offer_clicks: Counter[str] = Counter()
        self._started_at = time.time()

    def record(self, event: str, session_id: str | None = None, detail: str | None = None) -> None:
        if event not in TRACKED_EVENTS or _MUTED.get():
            return
        with self._lock:
            self._counts[event] += 1
            if session_id:
                self._sessions[event].add(session_id)
            if event == "offer_clicked" and detail:
                self._offer_clicks[detail] += 1

    def funnel(self) -> KpiFunnel:
        with self._lock:
            players = len(self._sessions["game_started"]) or self._counts["game_started"]
            finished = len(self._sessions["game_finished"]) or self._counts["game_finished"]
            shown = len(self._sessions["offers_shown"]) or self._counts["offers_shown"]
            clicked = len(self._sessions["offer_clicked"]) or (1 if self._counts["offer_clicked"] else 0)

            def pct(part: float, whole: float) -> float:
                return round(part / whole * 100, 1) if whole else 0.0

            steps = [
                KpiStep(label="Started a season", value=players, pct_of_start=100.0 if players else 0.0),
                KpiStep(label="Finished the season", value=finished, pct_of_start=pct(finished, players)),
                KpiStep(label="Saw Commerzbank next steps", value=shown, pct_of_start=pct(shown, players)),
                KpiStep(label="Clicked a Commerzbank offer", value=clicked, pct_of_start=pct(clicked, players)),
            ]
            answered = self._counts["quiz_answered"]
            return KpiFunnel(
                steps=steps,
                weeks_played=self._counts["week_completed"],
                avg_weeks_per_player=round(self._counts["week_completed"] / players, 1) if players else 0.0,
                quiz_answers=answered,
                quiz_correct_pct=pct(self._counts["quiz_correct"], answered),
                lessons_completed=self._counts["lesson_completed"],
                glossary_questions=self._counts["glossary_question"],
                research_reports=self._counts["research_used"],
                challenges_shared=self._counts["challenge_shared"],
                challenges_joined=self._counts["challenge_joined"],
                offer_clicks={k: v for k, v in self._offer_clicks.most_common()},
                offer_ctr_pct=pct(clicked, shown),
                since_minutes=round((time.time() - self._started_at) / 60),
            )


_MUTED: ContextVar[bool] = ContextVar("kpi_muted", default=False)


@contextmanager
def kpi_muted():
    """Background replays ("what if?") must not count as real players in the bank's funnel."""
    token = _MUTED.set(True)
    try:
        yield
    finally:
        _MUTED.reset(token)


tracker = KpiTracker()


class ChallengeBoard:
    """Results per season seed (in memory). Same seed = same news and the same market, so results compare fairly."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._results: dict[int, dict[str, ChallengeEntry]] = defaultdict(dict)

    def add(self, seed: int, entry: ChallengeEntry) -> None:
        with self._lock:
            self._results[seed][entry.session_id] = entry

    def board(self, seed: int) -> list[ChallengeEntry]:
        with self._lock:
            return sorted(self._results.get(seed, {}).values(), key=lambda e: e.final_net_worth, reverse=True)


challenges = ChallengeBoard()
