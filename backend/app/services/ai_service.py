"""AI layer: Google AI Studio (Gemini API) with a deterministic fallback.

Three roles:
  1. generate_week_summary   - jargon translator + 2-minute "market lag" micro-lesson
  2. generate_advisor_hint   - the risky Investment Advisor lifeline (70% right / 30% wrong)
  3. generate_final_analysis - end-of-game post-mortem and financial coaching
  4. research_company        - the advisor studies one company from public information
  5. explain_term            - the glossary alien explains a money term in plain words

Every public method ALWAYS returns a valid object. If the API key is missing,
the network fails, the call times out, the quota is exhausted or Gemini returns
malformed JSON, the service silently switches to the offline generator and
labels the result with `ai_source = "fallback"`.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from app.config import Settings
from app.models.schemas import (
    AdvisorContext,
    AdvisorHint,
    AdvisorHintContent,
    AIPrefs,
    BudgetAdvice,
    BudgetNumbers,
    WhatIfContent,
    WhatIfStory,
    AISource,
    AnalysisPoint,
    CompanyResearchContent,
    CompanyResearchContext,
    CompanyResearchReport,
    FinalAnalysisContext,
    GlossaryAnswer,
    GlossaryAnswerContent,
    JargonTerm,
    MoveAnalysis,
    MoveAnalysisContent,
    ResearchNewsLink,
    RiskLevel,
    SuggestedAction,
    TargetType,
    WeekLesson,
    WeekLessonContent,
    WeekSummaryContext,
)
from app.services.analytics import build_fallback_analysis, fill, money
from app.services.data_loader import GameDataRepository
from app.services.glossary import TOPICS, find_entry

try:
    from google import genai
    from google.genai import errors as genai_errors
    from google.genai import types as genai_types
except ImportError:
    genai = None
    genai_errors = None
    genai_types = None

logger = logging.getLogger("cosmicash.ai")

T = TypeVar("T", bound=BaseModel)

TRANSIENT_STATUS_CODES = {500, 502, 503, 504}


UNIVERSE_RULES = (
    "The game 'CosmiCash' takes place in a 100% fictional universe: fictional companies, "
    "countries, people and a fictional dollar ($). Never mention real companies, brands, people "
    "or real-world markets. Write for players of every generation - teenagers, working adults and "
    "seniors - in clear, warm, plain English: short sentences, no slang, no unexplained jargon, "
    "no markdown, no emojis."
)

WEEK_SUMMARY_SYSTEM = f"""You are the friendly Market Coach inside an educational investing game.
{UNIVERSE_RULES}

Task: explain what just happened at the close of this game week. The whole lesson must take less than 2 minutes to read (under 170 words in total).

Rules:
- Use ONLY the facts in the JSON input. Never invent companies, numbers or events, and never hint at future events.
- The core lesson is MARKET LAG. For every consequence with "is_delayed": true, explicitly connect the original news ("Week <source_week>") to the effect now ("Week <trigger_week>") and explain in simple cause-and-effect words why it took time (monthly contracts, approvals, bills arriving later, and so on).
- If the rent changed, explain how a news story from an earlier week ended up in the player's living costs.
- If the savings interest rate changed, explain how the news about interest rates reached the player's savings account.
- If the savings account paid interest or covered part of the rent, mention it in one short sentence (safe money, small but steady return).
- If "expenses" lists a surprise bill, say in one short sentence how it was paid. If shares had to be sold ("from_shares" > 0), explain that an emergency fund in savings avoids selling in a hurry; if savings or cash covered it, praise that cushion.
- "investment_change" also excludes surprise bills - they are living costs, not investment losses.
- decision_feedback: if "decisions" lists the player's own trades, write ONE short sentence judging the REASONS, not just the result: a trade based on a news story or the company's numbers is good thinking even if the price fell; a trade on a gut feeling or the price trend alone that worked was partly luck. Name the ticker. Empty string if there are no decisions. Never invent trades.
- If bonds or term deposits ("fixed_income") earned interest, paid back at maturity or defaulted, mention it in one short sentence: a fixed rate for locking money away, and a company bond can default when its issuer goes bankrupt.
- "investment_change" is the player's investing result BEFORE rent; rent is a living cost, not an investment loss - never call a week with positive investment_change a losing investment week just because rent was paid.
- If there were no delayed effects, explain that some news needs time to show up and that older headlines are worth re-reading.
- If noise was unmasked, say briefly that it changed nothing.
- "jargon": pick 1-3 finance words that appear in this week's story and explain each in one plain sentence.
Return JSON that matches the schema."""

ADVISOR_SYSTEM_ACCURATE = f"""You are "the Advisor", a friendly investment advisor character in an educational game.
{UNIVERSE_RULES}

You receive this week's REAL market signals, sorted by importance (the first one matters most).
Give ONE short hint (max 55 words) about the most important signal, and spell out the cause-and-effect chain so a beginner sees WHY: for example higher wages -> higher restaurant costs -> smaller profit -> the share price may dip.
Rules:
- Never state exact percentages, amounts or the exact week an effect lands; use words like "this week", "soon" or "in a couple of weeks".
- Never use the word "noise". Mention the company by name.
- cause_and_effect: 3-5 very short steps (max 7 words each) from the news, through the company's money (sales, costs, profit, cash or debt), to what may happen to the share price, dividend, bankruptcy risk, rent or savings. Base them on the signal's cause_chain when it is given. No exact numbers about the effect.
- suggested_action: buy, sell, hold or watch. focus_company_id: the id of that company, or null for a hint about bills, rent or savings.
Return JSON that matches the schema."""

ADVISOR_SYSTEM_MISLEADING = f"""You are "the Advisor", a friendly investment advisor character in an educational game.
{UNIVERSE_RULES}

In this turn you are (without knowing it) WRONG. Build one confident, friendly hint (max 55 words) on the FIRST signal in the input, treating it as real and important, in the direction given.
Rules:
- Do not reveal or suggest that the information may be a rumor, noise or wrong.
- Never state exact percentages or amounts. Mention the company by name.
- cause_and_effect: 3-5 very short steps (max 7 words each) of your (convincing but mistaken) reasoning from the headline to the share price. Base them on the signal's cause_chain when it is given.
- focus_company_id: that company's id. suggested_action: "buy" if the direction is "up", "sell" if it is "down".
Return JSON that matches the schema."""

RESEARCH_SYSTEM = f"""You are "the Advisor", a friendly analyst in an educational investing game. The player asked you to research ONE company.
{UNIVERSE_RULES}

You receive the company's public profile, its hard data (cash, debt and profit margin in millions of $, with trends), its share price history, dividend, bankruptcy risk (100% = bankrupt) and every headline published so far.
Rules:
- Use ONLY the facts in the JSON input. Never invent numbers, events or future news.
- Teach the player how to read a company: connect the hard data to the business (for example "debt is bigger than cash, so a bad month hurts more").
- Do NOT give an order to buy or sell and never promise what the price will do. You may say what looks strong or weak.
- news_to_watch: pick at most 3 published headlines that could plausibly affect THIS company's sales, costs, cash or risk, copy each title exactly and explain the possible link in one short sentence using "could" or "might". Headlines can be noise - if nothing clearly relates, return an empty list.
- summary: 2-3 short sentences, max 60 words. strengths and risks: 1-3 items each, max 14 words each.
- question: one question the player should ask themselves before trading this company.
Return JSON that matches the schema."""

GLOSSARY_SYSTEM = """You are "Berg", a calm and wise alien teacher in an educational investing game, sitting in a spaceship cockpit and wearing a bank T-shirt. Players of every generation - teenagers, working adults and seniors - ask you what money words and ideas mean.
Rules:
- Explain the term or idea asked about in clear, warm, plain English: short sentences, no slang, no jargon you don't explain, no markdown, no emojis. Max 80 words in "answer".
- "example": one short everyday example with simple round numbers in dollars.
- You explain how things work in general (dividends, bonds, interest, inflation, diversification, risk, budgeting, banking, funds...). You may explain investing ideas and how to think about them.
- You never give personal investment advice: never say which company, share or product to buy or sell, and never predict prices. If asked, kindly say you explain ideas, not picks, and explain the idea behind the question instead.
- Never mention real companies, brands, people or real-world markets.
- If the question is not about money, saving, banking or investing, set on_topic to false and answer with one friendly sentence steering back to money words.
- related_terms: up to 3 money terms worth asking about next.
Return JSON that matches the schema."""

WHAT_IF_SYSTEM = f"""You are the AI Coach of an educational investing game. The season is over, and the game replayed the player's exact season (same news, same bills) with two simple strategies.
{UNIVERSE_RULES}

You receive "lines": the player's real result ("you") and the replays ("saver" = everything in a savings account; "spread" = an emergency fund in savings plus money spread over all companies and held). Each line has final_net_worth, roi_pct (investing result before rent and bills) and end_reason ("liquidity" = ran out of money for rent).
Rules:
- Use ONLY these numbers. Compare honestly: say which line ended highest and why in one plain cause, e.g. a safety cushion avoided selling in a hurry, spreading money softened one company's crash, or savings were safe but grew slowly.
- A line that ended with "liquidity" ran out of rent money: it LOST the game, whatever its net worth - never call it the best. If the player did best, praise it and still name the risk they took.
- Do not tell the player what to buy in real life. No exact predictions.
- headline: max 14 words. explanation: 2-3 short sentences with $ amounts. takeaway: one practical real-life habit, max 20 words.
Return JSON that matches the schema."""

BUDGET_SYSTEM = f"""You are "Berg", a calm, wise alien money teacher in an educational game, now helping the player with their REAL monthly budget.
All amounts are in numbers.currency (EUR, PLN or USD): write money with that currency (e.g. 450 EUR / 450 zł / $450), never with another one.
You receive the player's monthly income, housing, food and other costs, current savings and pre-computed numbers (50/30/20 split, suggested monthly saving, emergency-fund target of 3 months of essential costs and the months needed to reach it).
Rules:
- Use ONLY these numbers; do not recalculate differently. Plain, warm, encouraging language, no jargon, no markdown, no emojis.
- If spending is higher than income, say so kindly and focus the steps on closing the gap first (no investing advice).
- Never recommend specific shares, funds or products, and never promise returns. Budgeting and saving habits only.
- summary: 2-3 sentences. steps: exactly 3 concrete steps for the next month (each max 18 words). bank_step: one sentence about a first step with a bank account, e.g. a separate savings account or an automatic transfer on payday.
Return JSON that matches the schema."""

FINAL_ANALYSIS_SYSTEM = f"""You are the AI Coach of an educational investing game. The game has just ended. You act like a strict but fair border inspector who stamps the player's file.
{UNIVERSE_RULES}

You receive: the player's complete action log (every buy and sell with week, ticker, shares and price, savings deposits and withdrawals, interest, advisor uses, dividends, rent), weekly snapshots, the full market timeline (which headlines were noise and which effects were delayed) and pre-computed metrics. metrics.delayed_signals[].bought_week marks a purchase made AFTER a warning headline was already published.
Rules:
- verdict: approved = true (APPROVED stamp) or false (REJECTED stamp), a 2-3 word inspector label such as "Prudent Strategist", "Careful Saver", "FOMO Victim" or "All-In Gambler", and ONE plain sentence with a real fact that justifies it. Running out of cash for rent is always REJECTED.
- key_moments: EXACTLY 2 specific weeks that decided the season, costly mistakes first (use wins only if there were no real mistakes). Each one names the week, the news, the player's decision and what it caused, for example "In Week 3 you bought PIZA despite the news about higher cook wages, which cut its profit in Week 4." Never invent trades.
- real_life_habit: ONE simple money habit to start in real life this month, ideally a banking or saving habit (for example an automatic transfer to a savings account on payday, or a bills buffer of one month of rent). Tie it to the player's biggest weakness.
- Keep everything short: the stamp and the two weeks replace a long essay.
- Base every strength and improvement on the player's REAL moves: cite the week, the ticker and what happened (for example "In Week 2 you bought 20 PIZA at $40.40..."). Never invent trades.
- When relevant, cover: diversification, keeping cash or savings for rent (liquidity), reacting to delayed signals (market lag), avoiding companies heading to bankruptcy, following noise or wrong advisor hints, and how the player used bonds and term deposits (fixed interest, money locked until maturity, company bonds that can default).
- roi_pct is the investing result before rent. Rent is a living cost: judge investing skill on roi_pct, and liquidity on the rent checks.
- Dividends are paid on each company's own calendar (every 2, 3 or 4 weeks): only owners on payout day get paid.
- strengths: 2-4 items. improvements: 2-4 items, each with a concrete alternative. actionable_tips: exactly 3 or 4 universal, practical money tips worth remembering after the game.
- If the player made no trades, be kind and explain what they missed.
- play_style: a 2-3 word label such as "Cautious Saver" or "Headline Chaser".
Return JSON that matches the schema."""


LANGUAGE_NAMES = {"en": "English", "de": "German", "pl": "Polish"}
LEVEL_RULES = {
    "simple": "Reading level SIMPLE: very short sentences (max 12 words), everyday words only, explain every money word "
    "as if to a 12-year-old or a grandparent who never invested. Use about 30% fewer words than the limits allow.",
    "normal": "",
    "detailed": "Reading level DETAILED: the player wants more depth - you may add one extra sentence of 'why' and use "
    "correct finance terms, each explained in a few words. Stay within the word limits.",
}


def style_rules(prefs: AIPrefs | None) -> str:
    """Extra instructions for the player's reading level and language (appended to any system prompt)."""
    if prefs is None:
        return ""
    rules = []
    if prefs.language != "en":
        rules.append(
            f"LANGUAGE: write every text value in {LANGUAGE_NAMES[prefs.language]} (natural, simple, correct). "
            "Keep JSON keys, ids, tickers, company names and enum values exactly as in the schema."
        )
    if LEVEL_RULES.get(prefs.level):
        rules.append(LEVEL_RULES[prefs.level])
    return ("\n" + "\n".join(rules)) if rules else ""


class AIService:
    def __init__(self, settings: Settings, repo: GameDataRepository) -> None:
        self._settings = settings
        self._repo = repo
        self._cooldown_until = 0.0
        self._client = None
        if settings.gemini_api_key and genai is not None:
            try:
                self._client = genai.Client(api_key=settings.gemini_api_key)
            except Exception as exc:
                logger.warning("Gemini client could not be created, using fallback: %s", exc)
        elif settings.gemini_api_key and genai is None:
            logger.warning("google-genai is not installed - running on the fallback AI.")

    @property
    def mode(self) -> AISource:
        return AISource.GEMINI if self._client is not None else AISource.FALLBACK

    @property
    def model_name(self) -> str | None:
        return self._settings.gemini_model if self._client is not None else None

    async def generate_week_summary(self, ctx: WeekSummaryContext, prefs: AIPrefs | None = None) -> WeekLesson:
        payload = ctx.model_dump(mode="json")
        content = await self._generate(
            WEEK_SUMMARY_SYSTEM + style_rules(prefs), payload, WeekLessonContent, temperature=0.6
        )
        if content is not None:
            if not content.jargon:
                content.jargon = self._fallback_week_lesson(ctx).jargon
            content.jargon = content.jargon[:3]
            if not ctx.decisions:
                content.decision_feedback = ""
            elif not content.decision_feedback.strip():
                content.decision_feedback = self._fallback_decision_feedback(ctx)
            return WeekLesson(**content.model_dump(), ai_source=AISource.GEMINI)
        fallback = self._fallback_week_lesson(ctx)
        fallback.decision_feedback = self._fallback_decision_feedback(ctx)
        return WeekLesson(**fallback.model_dump(), ai_source=AISource.FALLBACK)

    @staticmethod
    def _fallback_decision_feedback(ctx: WeekSummaryContext) -> str:
        """Judges the reasons behind this week's trades: good thinking vs. luck."""
        if not ctx.decisions:
            return ""
        d = ctx.decisions[0]
        verb = "bought" if d.action == "buy" else "sold"
        thought_through = d.reason in ("news", "advisor")
        if thought_through and d.went_your_way:
            return f"You {verb} {d.ticker} because of {d.reason_label} and it went your way - that is reasoning paying off."
        if thought_through:
            return (
                f"You {verb} {d.ticker} because of {d.reason_label}. It hasn't paid off yet, but a reason you can "
                "check is good thinking - some news needs weeks to land."
            )
        if d.went_your_way:
            return f"{d.ticker} went your way, but {d.reason_label} is partly luck - next time check the news or the numbers first."
        return f"{d.ticker} moved against you after a trade based on {d.reason_label} - a reason you can check works better."

    def _fallback_week_lesson(self, ctx: WeekSummaryContext) -> WeekLessonContent:
        t = self._repo.fallback.week_lesson
        delayed = [c for c in ctx.consequences if c.is_delayed]
        immediate = [c for c in ctx.consequences if not c.is_delayed]

        if delayed:
            title, takeaway = t.title_delayed, t.takeaway_delayed
        elif immediate:
            title, takeaway = t.title_immediate, t.takeaway_immediate
        else:
            title, takeaway = t.title_quiet, t.takeaway_quiet

        moves = sorted(
            (p for p in ctx.price_changes if abs(p.change_pct) >= 0.5 or p.is_bankrupt),
            key=lambda p: -abs(p.change_pct),
        )[:3]
        summary_parts = [
            fill(t.summary_moves, moves=", ".join(f"{p.name} {p.change_pct:+.1f}%" for p in moves))
            if moves
            else t.summary_no_moves
        ]
        if immediate:
            items = ", ".join(f"'{c.event_title}' ({c.impact_label})" for c in immediate[:2])
            summary_parts.append(fill(t.immediate_note, items=items))
        if ctx.dividends_total > 0:
            summary_parts.append(fill(t.dividend_note, amount=money(ctx.dividends_total)))
        if ctx.bankruptcies:
            summary_parts.append(fill(t.bankruptcy_note, names=", ".join(b.name for b in ctx.bankruptcies)))
        if ctx.unmasked_noise:
            summary_parts.append(fill(t.noise_note, items=", ".join(f"'{n.title}'" for n in ctx.unmasked_noise)))
        if ctx.savings.interest > 0:
            summary_parts.append(
                fill(t.savings_note, amount=money(ctx.savings.interest), rate=f"{ctx.savings.rate_pct:g}%")
            )
        fi = ctx.fixed_income
        if fi.interest > 0:
            summary_parts.append(fill(t.fixed_income_note, amount=money(fi.interest)))
        for payout in fi.matured[:2]:
            summary_parts.append(
                fill(t.fixed_income_matured_note, name=payout.name, amount=money(payout.payout), interest=money(payout.interest))
            )
        for item in fi.defaulted[:2]:
            summary_parts.append(
                fill(t.fixed_income_default_note, name=item.name, recovered=money(item.recovered), lost=money(item.lost))
            )

        if delayed:
            items = "; ".join(
                f"'{c.event_title}' from Week {c.source_week} only landed now in Week {c.trigger_week} "
                f"({c.target_label}: {c.impact_label})"
                for c in delayed
            )
            lag = fill(t.lag_with_delayed, items=items)
        else:
            lag = t.lag_without_delayed
        if ctx.rent.changed:
            lag += " " + fill(
                t.rent_change_note,
                delta=f"+{money(ctx.rent.delta)}" if ctx.rent.delta >= 0 else money(ctx.rent.delta),
                rent=money(ctx.rent.new_rent),
                source_week=ctx.rent.source_week or ctx.week,
            )
        if ctx.rent.paid:
            lag += " " + fill(t.rent_paid_note, amount=money(ctx.rent.amount_paid))
        if ctx.savings.rent_from_savings > 0:
            lag += " " + fill(t.savings_rent_note, amount=money(ctx.savings.rent_from_savings))
        if ctx.savings.rate_changed:
            lag += " " + fill(
                t.savings_rate_note,
                old=f"{ctx.savings.old_rate_pct:g}%",
                new=f"{ctx.savings.rate_pct:g}%",
                source_week=ctx.savings.rate_source_week or ctx.week,
            )

        wanted_terms = ["Market lag"]
        if fi.defaulted:
            wanted_terms.append("Default")
        if fi.matured:
            wanted_terms.append("Maturity")
        if fi.interest > 0 and not fi.matured:
            wanted_terms.append("Bond")
        if ctx.savings.rate_changed:
            wanted_terms.append("Interest rate")
        if ctx.rent.changed or ctx.rent.paid:
            wanted_terms.append("Liquidity")
        if ctx.savings.interest > 0 or ctx.savings.rent_from_savings > 0:
            wanted_terms.append("Savings account")
        if ctx.bankruptcies or any(c.target_type == TargetType.BANKRUPTCY_RISK for c in ctx.consequences):
            wanted_terms.append("Bankruptcy risk")
        if ctx.dividends_total > 0:
            wanted_terms.append("Dividend calendar")
        elif any(c.target_type == TargetType.DIVIDEND for c in ctx.consequences):
            wanted_terms.append("Dividend")
        if ctx.unmasked_noise:
            wanted_terms.append("Noise")
        wanted_terms.append("Diversification")
        glossary = self._repo.fallback.glossary
        jargon = [JargonTerm(term=term, meaning=glossary[term]) for term in wanted_terms if term in glossary][:3]

        return WeekLessonContent(
            title=title,
            summary=" ".join(summary_parts),
            market_lag_lesson=lag,
            jargon=jargon,
            key_takeaway=takeaway,
        )

    async def generate_advisor_hint(self, ctx: AdvisorContext) -> AdvisorHint:
        valid_ids = {c.id for c in ctx.companies}
        if ctx.signals:
            system = ADVISOR_SYSTEM_ACCURATE if ctx.accurate else ADVISOR_SYSTEM_MISLEADING
            payload = ctx.model_dump(mode="json", exclude={"accurate"})
            content = await self._generate(system, payload, AdvisorHintContent, temperature=0.8)
            if content is not None and content.hint.strip():
                if content.focus_company_id not in valid_ids:
                    content.focus_company_id = ctx.signals[0].company_id
                steps = [step.strip() for step in content.cause_and_effect if step.strip()]
                content.cause_and_effect = steps[:5] if len(steps) >= 2 else self._fallback_chain(ctx.signals[0])
                return AdvisorHint(**content.model_dump(), ai_source=AISource.GEMINI)
        return AdvisorHint(**self._fallback_advisor(ctx).model_dump(), ai_source=AISource.FALLBACK)

    def _fallback_chain(self, signal) -> list[str]:
        """News -> what it does to the company's money -> what may happen to the price (or bill)."""
        t = self._repo.fallback.advisor
        key = f"{signal.target_type.value}:{signal.direction}"
        company = signal.company_name or "the company"
        steps = list(signal.cause_chain) or [
            f"News: {signal.event_title}",
            fill(t.chain_middle.get(key, ""), company=company),
        ]
        steps.append(fill(t.chain_outcome.get(key, ""), company=company))
        return [step for step in steps if step.strip()][:5]

    def _fallback_advisor(self, ctx: AdvisorContext) -> AdvisorHintContent:
        t = self._repo.fallback.advisor
        if not ctx.signals:
            return AdvisorHintContent(
                hint=t.quiet_week,
                cause_and_effect=list(t.quiet_chain),
                focus_company_id=None,
                suggested_action=SuggestedAction.HOLD,
            )

        signal = ctx.signals[0]
        chain = self._fallback_chain(signal)
        direction = t.direction_up if signal.direction == "up" else t.direction_down
        if signal.weeks_until_effect <= 0:
            timing = t.timing_now
        elif signal.weeks_until_effect == 1:
            timing = t.timing_soon
        else:
            timing = t.timing_later
        values = {
            "company": signal.company_name or "the market",
            "ticker": signal.ticker or "-",
            "event": signal.event_title,
            "direction": direction,
            "timing": timing,
        }
        move = SuggestedAction.BUY if signal.direction == "up" else SuggestedAction.SELL

        def hint(template: str, focus: str | None, action: SuggestedAction) -> AdvisorHintContent:
            return AdvisorHintContent(
                hint=fill(template, **values), cause_and_effect=chain, focus_company_id=focus, suggested_action=action
            )

        if not ctx.accurate:
            template = t.misleading_noise if signal.is_noise else t.misleading_inverted
            return hint(template, signal.company_id, move)

        if signal.target_type == TargetType.RENT:
            return hint(t.accurate_rent, None, SuggestedAction.HOLD)
        if signal.target_type == TargetType.SAVINGS_RATE:
            return hint(t.accurate_savings, None, SuggestedAction.HOLD)
        if signal.target_type == TargetType.BANKRUPTCY_RISK:
            action = SuggestedAction.SELL if signal.direction == "up" else SuggestedAction.WATCH
            return hint(t.accurate_risk, signal.company_id, action)
        if signal.target_type == TargetType.DIVIDEND:
            action = SuggestedAction.BUY if signal.direction == "up" else SuggestedAction.WATCH
            return hint(t.accurate_dividend, signal.company_id, action)
        template = t.accurate_delayed if signal.weeks_until_effect > 0 else t.accurate_immediate
        return hint(template, signal.company_id, move)

    async def research_company(self, ctx: CompanyResearchContext, prefs: AIPrefs | None = None) -> CompanyResearchReport:
        payload = ctx.model_dump(mode="json")
        content = await self._generate(
            RESEARCH_SYSTEM + style_rules(prefs), payload, CompanyResearchContent, temperature=0.5
        )
        if content is not None and content.summary.strip():
            titles = {h.title: h.week for h in ctx.headlines}
            content.news_to_watch = [
                link for link in content.news_to_watch if link.title in titles and link.why.strip()
            ][:3]
            for link in content.news_to_watch:
                link.week = titles[link.title]
            content.strengths = [x.strip() for x in content.strengths if x.strip()][:3]
            content.risks = [x.strip() for x in content.risks if x.strip()][:3]
            fallback = self._fallback_research(ctx)
            content.strengths = content.strengths or fallback.strengths
            content.risks = content.risks or fallback.risks
            content.question = content.question.strip() or fallback.question
            return CompanyResearchReport(**content.model_dump(), ai_source=AISource.GEMINI)
        return CompanyResearchReport(**self._fallback_research(ctx).model_dump(), ai_source=AISource.FALLBACK)

    def _fallback_research(self, ctx: CompanyResearchContext) -> CompanyResearchContent:
        """Offline research report built from the same public numbers."""
        c = ctx.company
        strengths: list[str] = []
        risks: list[str] = []
        if c.is_bankrupt:
            return CompanyResearchContent(
                verdict="Bankrupt - shares worth $0",
                summary=f"{c.name} went bankrupt. Its shares are worth nothing and can't be traded any more.",
                strengths=["None left - the company has closed."],
                risks=["Shareholders lost everything they put in."],
                news_to_watch=[],
                question="What warning signs did this company show before it went bankrupt?",
            )
        if c.cash_millions >= c.debt_millions:
            strengths.append(f"More cash (${c.cash_millions:g}M) than debt (${c.debt_millions:g}M).")
        else:
            risks.append(f"Debt (${c.debt_millions:g}M) is bigger than its cash (${c.cash_millions:g}M).")
        if c.profit_margin_pct > 0:
            strengths.append(f"Profitable: keeps about {c.profit_margin_pct:.0f} cents of every $1 it sells.")
        else:
            risks.append(f"Loses about {abs(c.profit_margin_pct):.0f} cents on every $1 it sells.")
        if c.margin_trend == "down":
            risks.append("Its profit margin is shrinking.")
        elif c.margin_trend == "up":
            strengths.append("Its profit margin is growing.")
        if c.debt_trend == "up":
            risks.append("It has been borrowing more.")
        if c.dividend_per_share > 0:
            strengths.append(f"Pays a dividend of {money(c.dividend_per_share)} per share.")
        if c.risk_level != RiskLevel.LOW:
            risks.append(f"Bankruptcy risk is {c.risk_level.value} ({c.bankruptcy_risk_pct:.0f}%).")
        if not risks:
            risks.append("Even healthy companies can be hit by bad news - don't put everything here.")
        if not strengths:
            strengths.append("Hard to find one right now - be careful.")

        healthy = c.profit_margin_pct > 0 and c.cash_millions >= c.debt_millions and c.risk_level == RiskLevel.LOW
        weak = c.profit_margin_pct <= 0 or c.risk_level == RiskLevel.CRITICAL
        verdict = "Solid numbers, watch the news" if healthy else "Fragile - handle with care" if weak else "Mixed picture"
        move = "up" if c.change_since_listing_pct >= 0 else "down"
        summary = (
            f"{c.name} ({c.industry}) sells {c.main_product[0].lower() + c.main_product[1:]}. "
            f"Its share price is {money(c.price)}, {move} {abs(c.change_since_listing_pct):.0f}% since it listed. "
            f"{c.condition}"
        )

        words = {c.name.lower(), c.ticker.lower(), c.name.split()[0].lower(), c.industry.split()[0].lower()}
        words = {w for w in words if len(w) > 3}
        links = []
        for h in reversed(ctx.headlines):
            text = f"{h.title} {h.description}".lower()
            if any(w in text for w in words):
                links.append(
                    ResearchNewsLink(
                        week=h.week, title=h.title, why=f"It mentions {c.name} or its business, so it could affect its money."
                    )
                )
            if len(links) >= 3:
                break
        return CompanyResearchContent(
            verdict=verdict,
            summary=summary,
            strengths=strengths[:3],
            risks=risks[:3],
            news_to_watch=links,
            question="Would I still be fine if this share fell 30% tomorrow - and do I have rent money set aside?",
        )

    async def explain_term(self, question: str, prefs: AIPrefs | None = None) -> GlossaryAnswer:
        content = await self._generate(
            GLOSSARY_SYSTEM + style_rules(prefs),
            {"question": question.strip()[:300]},
            GlossaryAnswerContent,
            temperature=0.4,
        )
        if content is not None and content.answer.strip():
            content.related_terms = [t.strip() for t in content.related_terms if t.strip()][:3]
            return GlossaryAnswer(**content.model_dump(), ai_source=AISource.GEMINI)
        return GlossaryAnswer(**self._fallback_term(question).model_dump(), ai_source=AISource.FALLBACK)

    @staticmethod
    def _fallback_term(question: str) -> GlossaryAnswerContent:
        entry = find_entry(question)
        if entry is None:
            return GlossaryAnswerContent(
                term="",
                answer=f"I don't have that one in my offline notebook. Try a money word such as {TOPICS}.",
                example="",
                related_terms=["Dividend", "Interest", "Diversification"],
                on_topic=True,
            )
        return GlossaryAnswerContent(
            term=entry["term"],
            answer=entry["answer"],
            example=entry["example"],
            related_terms=entry["related"][:3],
            on_topic=True,
        )

    async def explain_what_if(self, lines, prefs: AIPrefs | None = None) -> WhatIfStory:
        payload = {
            "lines": [
                {
                    "key": line.key,
                    "label": line.label,
                    "final_net_worth": line.final_net_worth,
                    "roi_pct": line.roi_pct,
                    "end_reason": line.end_reason,
                    "weeks_played": line.weeks_played,
                }
                for line in lines
            ]
        }
        content = await self._generate(WHAT_IF_SYSTEM + style_rules(prefs), payload, WhatIfContent, temperature=0.4)
        if content is not None and content.explanation.strip() and content.headline.strip():
            return WhatIfStory(**content.model_dump(), ai_source=AISource.GEMINI)
        return WhatIfStory(**self._fallback_what_if(lines).model_dump(), ai_source=AISource.FALLBACK)

    @staticmethod
    def _fallback_what_if(lines) -> WhatIfContent:
        survived = [line for line in lines if line.end_reason != "liquidity"] or lines
        best = max(survived, key=lambda line: line.final_net_worth)
        you = next(line for line in lines if line.key == "you")
        others = ", ".join(f"{line.label.lower()} {money(line.final_net_worth)}" for line in lines if line.key != "you")
        if you.end_reason == "liquidity":
            headline = f"You ran out of rent money in Week {you.weeks_played}; '{best.label}' lasted the whole season."
        elif best.key == "you":
            headline = "Your own plan beat both textbook strategies this season."
        else:
            headline = f"'{best.label}' would have ended {money(best.final_net_worth - you.final_net_worth)} higher."
        explanation = f"You finished with {money(you.final_net_worth)}; the replays ended with {others}."
        if you.end_reason == "liquidity":
            explanation += " You ran out of rent money - a cushion in savings would have kept you in the game."
        return WhatIfContent(
            headline=headline,
            explanation=explanation,
            takeaway="Keep a few months of bills in savings first, then spread what's left instead of betting on one idea.",
        )

    async def budget_advice(self, numbers: BudgetNumbers, request: dict, prefs: AIPrefs | None = None):
        def tidy(values: dict) -> dict:
            return {k: (int(v) if isinstance(v, float) and v.is_integer() else v) for k, v in values.items()}

        payload = {"player": tidy(request), "numbers": tidy(numbers.model_dump())}
        content = await self._generate(BUDGET_SYSTEM + style_rules(prefs), payload, BudgetAdvice, temperature=0.4)
        if content is not None and content.summary.strip() and len([s for s in content.steps if s.strip()]) >= 2:
            content.steps = [s.strip() for s in content.steps if s.strip()][:3]
            return content, AISource.GEMINI
        return self._fallback_budget(numbers), AISource.FALLBACK

    @staticmethod
    def _fallback_budget(n: BudgetNumbers) -> BudgetAdvice:
        def fmt(value: float) -> str:
            amount = f"{abs(value):,.0f}"
            return {"EUR": f"€{amount}", "PLN": f"{amount} zł", "USD": f"${amount}"}.get(n.currency, amount)

        if n.left_over < 0:
            return BudgetAdvice(
                summary=f"You spend {fmt(-n.left_over)} more than you earn each month. Closing that gap comes first.",
                steps=[
                    "Write down every expense for two weeks to see where the money goes.",
                    "Pick the two biggest 'wants' and cut them in half for one month.",
                    "Set a weekly spending limit and check it every Sunday.",
                ],
                bank_step="Use your banking app's spending overview to spot leaks before they grow.",
            )
        if n.months_to_emergency_fund == 0:
            cushion = f"Your savings already cover a {fmt(n.emergency_fund_target)} safety cushion - keep it there."
        else:
            cushion = (
                f"Saving {fmt(n.suggested_monthly_saving)} a month builds a {fmt(n.emergency_fund_target)} safety "
                f"cushion in about {n.months_to_emergency_fund} months."
            )
        return BudgetAdvice(
            summary=f"After your costs about {fmt(n.left_over)} is left each month. {cushion}",
            steps=[
                f"Move {fmt(n.suggested_monthly_saving)} to savings on payday, before spending anything.",
                "Keep the emergency fund separate from everyday money so you don't spend it by accident.",
                "Once the cushion is full, learn about long-term investing with small monthly amounts.",
            ],
            bank_step="Open a separate savings account and set up an automatic transfer on payday.",
        )

    async def generate_final_analysis(self, ctx: FinalAnalysisContext, prefs: AIPrefs | None = None) -> MoveAnalysis:
        fallback = build_fallback_analysis(ctx.metrics, self._repo)
        payload = ctx.model_dump(mode="json")
        content = await self._generate(
            FINAL_ANALYSIS_SYSTEM + style_rules(prefs),
            payload,
            MoveAnalysisContent,
            temperature=0.5,
            budget_seconds=self._settings.ai_final_timeout_seconds,
        )
        if content is None:
            return MoveAnalysis(**fallback.model_dump(), ai_source=AISource.FALLBACK)

        weeks_played = ctx.metrics.weeks_played
        if not content.verdict.title.strip() or not content.verdict.reason.strip():
            content.verdict = fallback.verdict
        if ctx.metrics.liquidity_loss:
            content.verdict.approved = False
        moments = [
            moment
            for moment in content.key_moments
            if 1 <= moment.week <= max(weeks_played, 1) and moment.title.strip() and moment.detail.strip()
        ][:2]
        for extra in fallback.key_moments:
            if len(moments) >= 2:
                break
            if all(extra.week != moment.week for moment in moments):
                moments.append(extra)
        content.key_moments = sorted(moments, key=lambda moment: moment.week)
        if not content.real_life_habit.title.strip() or not content.real_life_habit.habit.strip():
            content.real_life_habit = fallback.real_life_habit
        content.strengths = self._non_empty(content.strengths, fallback.strengths)[:4]
        content.improvements = self._non_empty(content.improvements, fallback.improvements)[:4]
        tips = [tip for tip in content.actionable_tips if tip.title.strip() and tip.tip.strip()]
        for extra in fallback.actionable_tips:
            if len(tips) >= 3:
                break
            if all(extra.title != tip.title for tip in tips):
                tips.append(extra)
        content.actionable_tips = tips[:4]
        return MoveAnalysis(**content.model_dump(), ai_source=AISource.GEMINI)

    @staticmethod
    def _non_empty(points: list[AnalysisPoint], fallback: list[AnalysisPoint]) -> list[AnalysisPoint]:
        cleaned = [p for p in points if p.title.strip() and p.detail.strip()]
        return cleaned or fallback

    async def _generate(
        self,
        system: str,
        payload: dict[str, Any],
        schema: type[T],
        *,
        temperature: float,
        budget_seconds: float | None = None,
    ) -> T | None:
        """Ask Gemini for JSON matching `schema`. Returns None on ANY problem.

        Resilience strategy, all within one time budget (AI_TIMEOUT_SECONDS):
          * 503 / 5xx, timeout, 404 or malformed JSON -> switch to the other model right away
            (GEMINI_MODEL <-> GEMINI_FALLBACK_MODEL) and keep alternating until the budget ends,
          * 429 quota                                 -> cooldown, offline fallback,
          * anything else                             -> offline fallback.
        """
        if self._client is None or genai_types is None:
            return None
        if time.monotonic() < self._cooldown_until:
            return None

        contents = "Game data (JSON):\n" + json.dumps(payload, ensure_ascii=False)
        budget = budget_seconds or self._settings.ai_timeout_seconds
        deadline = time.monotonic() + budget
        models = [self._settings.gemini_model]
        fallback_model = self._settings.gemini_fallback_model
        if fallback_model and fallback_model not in models:
            models.append(fallback_model)

        no_thinking: set[str] = set()
        attempt = 0
        while True:
            remaining = deadline - time.monotonic()
            if remaining < 1.5:
                logger.warning("Gemini time budget (%.0fs) used up - using fallback.", budget)
                return None
            model = models[attempt % len(models)]
            call_timeout = remaining if len(models) == 1 else min(remaining, max(budget * 0.45, 8.0))
            outcome, value = await self._call_model(
                model, system, contents, schema, temperature, call_timeout, model not in no_thinking
            )
            if outcome == "ok":
                if attempt:
                    logger.info("Gemini answered via %s after %d retr%s.", model, attempt, "y" if attempt == 1 else "ies")
                return value
            if outcome == "fatal":
                return None
            if outcome == "no_thinking":
                no_thinking.add(model)
                continue
            attempt += 1
            if outcome == "retry":
                await asyncio.sleep(min(0.8, max(0.0, deadline - time.monotonic() - 1.5)))

    def _thinking_config(self, model: str):
        """Keep answers fast: minimal reasoning for Flash-class models."""
        if not self._settings.gemini_disable_thinking or genai_types is None:
            return None
        if model.startswith("gemini-2.5") and "flash" in model:
            return genai_types.ThinkingConfig(thinking_budget=0)
        if model.startswith("gemini-3"):
            return genai_types.ThinkingConfig(thinking_level="low")
        return None

    async def _call_model(
        self,
        model: str,
        system: str,
        contents: str,
        schema: type[T],
        temperature: float,
        timeout: float,
        use_thinking: bool,
    ) -> tuple[str, T | None]:
        """One Gemini call. Returns (outcome, value) with outcome in
        ok / retry / next / no_thinking / fatal."""
        config_kwargs: dict[str, Any] = {
            "system_instruction": system,
            "response_mime_type": "application/json",
            "response_schema": schema,
            "temperature": temperature,
        }
        thinking = self._thinking_config(model) if use_thinking else None
        if thinking is not None:
            config_kwargs["thinking_config"] = thinking

        try:
            response = await asyncio.wait_for(
                self._client.aio.models.generate_content(
                    model=model,
                    contents=contents,
                    config=genai_types.GenerateContentConfig(**config_kwargs),
                ),
                timeout=timeout,
            )
            text = (response.text or "").strip()
            if not text:
                logger.warning("Gemini (%s) returned an empty response.", model)
                return "next", None
            return "ok", schema.model_validate_json(text)
        except asyncio.TimeoutError:
            logger.warning("Gemini (%s) timed out after %.0fs.", model, timeout)
            return "next", None
        except ValidationError as exc:
            logger.warning("Gemini (%s) JSON did not match %s: %s", model, schema.__name__, exc)
            return "next", None
        except Exception as exc:
            code = getattr(exc, "code", None) if genai_errors and isinstance(exc, genai_errors.APIError) else None
            if code == 429:
                self._cooldown_until = time.monotonic() + self._settings.ai_cooldown_seconds
                logger.warning("Gemini quota/rate limit hit - fallback for %.0fs.", self._settings.ai_cooldown_seconds)
                return "fatal", None
            if code in TRANSIENT_STATUS_CODES:
                logger.warning("Gemini (%s) temporarily unavailable (%s).", model, code)
                return "retry", None
            if code == 400 and use_thinking and thinking is not None and "thinking" in str(exc).lower():
                logger.info("Gemini (%s) rejected the thinking config - retrying without it.", model)
                return "no_thinking", None
            if code == 404:
                logger.warning("Gemini model '%s' is not available for this key.", model)
                return "next", None
            logger.warning("Gemini (%s) call failed - using fallback: %s", model, exc)
            return "fatal", None
