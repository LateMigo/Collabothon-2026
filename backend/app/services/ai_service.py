"""AI layer: Google AI Studio (Gemini API) with a deterministic fallback.

Three roles:
  1. generate_week_summary   - jargon translator + 2-minute "market lag" micro-lesson
  2. generate_advisor_hint   - the risky Investment Advisor lifeline (70% right / 30% wrong)
  3. generate_final_analysis - end-of-game post-mortem and financial coaching

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
    AISource,
    AnalysisPoint,
    FinalAnalysisContext,
    JargonTerm,
    MoveAnalysis,
    MoveAnalysisContent,
    SuggestedAction,
    TargetType,
    WeekLesson,
    WeekLessonContent,
    WeekSummaryContext,
)
from app.services.analytics import build_fallback_analysis, fill, money
from app.services.data_loader import GameDataRepository

try:  # The SDK is optional at runtime: without it the game runs on the fallback.
    from google import genai
    from google.genai import errors as genai_errors
    from google.genai import types as genai_types
except ImportError:  # pragma: no cover - exercised only when the SDK is missing
    genai = None
    genai_errors = None
    genai_types = None

logger = logging.getLogger("cosmicash.ai")

T = TypeVar("T", bound=BaseModel)

TRANSIENT_STATUS_CODES = {500, 502, 503, 504}

# =============================================================================
# Prompts
# =============================================================================

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
- If there were no delayed effects, explain that some news needs time to show up and that older headlines are worth re-reading.
- If noise was unmasked, say briefly that it changed nothing.
- "jargon": pick 1-3 finance words that appear in this week's story and explain each in one plain sentence.
Return JSON that matches the schema."""

ADVISOR_SYSTEM_ACCURATE = f"""You are "the Advisor", a friendly investment advisor character in an educational game.
{UNIVERSE_RULES}

You receive this week's REAL market signals, sorted by importance (the first one matters most).
Give ONE short hint (max 55 words) about the most important signal.
Rules:
- Never state exact percentages, amounts or the exact week an effect lands; use words like "this week", "soon" or "in a couple of weeks".
- Never use the word "noise". Mention the company by name.
- suggested_action: buy, sell, hold or watch. focus_company_id: the id of that company, or null for a hint about bills/rent.
Return JSON that matches the schema."""

ADVISOR_SYSTEM_MISLEADING = f"""You are "the Advisor", a friendly investment advisor character in an educational game.
{UNIVERSE_RULES}

In this turn you are (without knowing it) WRONG. Build one confident, friendly hint (max 55 words) on the FIRST signal in the input, treating it as real and important, in the direction given.
Rules:
- Do not reveal or suggest that the information may be a rumor, noise or wrong.
- Never state exact percentages or amounts. Mention the company by name.
- focus_company_id: that company's id. suggested_action: "buy" if the direction is "up", "sell" if it is "down".
Return JSON that matches the schema."""

FINAL_ANALYSIS_SYSTEM = f"""You are the AI Coach of an educational investing game. The game has just ended.
{UNIVERSE_RULES}

You receive: the player's complete action log (every buy and sell with week, ticker, shares and price, advisor uses, dividends, rent), weekly snapshots, the full market timeline (which headlines were noise and which effects were delayed) and pre-computed metrics.
Write a personal, encouraging and honest post-mortem.
Rules:
- Base every strength and improvement on the player's REAL moves: cite the week, the ticker and what happened (for example "In Week 2 you bought 20 PIZA at $40.40..."). Never invent trades.
- When relevant, cover: diversification, keeping cash for rent (liquidity), reacting to delayed signals (market lag), avoiding companies heading to bankruptcy, and following noise or wrong advisor hints.
- strengths: 2-4 items. improvements: 2-4 items, each with a concrete alternative. actionable_tips: exactly 3 or 4 universal, practical money tips worth remembering after the game.
- If the player made no trades, be kind and explain what they missed.
- play_style: a 2-3 word label such as "Cautious Saver" or "Headline Chaser".
Return JSON that matches the schema."""


class AIService:
    def __init__(self, settings: Settings, repo: GameDataRepository) -> None:
        self._settings = settings
        self._repo = repo
        self._cooldown_until = 0.0
        self._client = None
        if settings.gemini_api_key and genai is not None:
            try:
                self._client = genai.Client(api_key=settings.gemini_api_key)
            except Exception as exc:  # noqa: BLE001 - never crash the game because of AI setup
                logger.warning("Gemini client could not be created, using fallback: %s", exc)
        elif settings.gemini_api_key and genai is None:
            logger.warning("google-genai is not installed - running on the fallback AI.")

    # ------------------------------------------------------------------ status
    @property
    def mode(self) -> AISource:
        return AISource.GEMINI if self._client is not None else AISource.FALLBACK

    @property
    def model_name(self) -> str | None:
        return self._settings.gemini_model if self._client is not None else None

    # ======================================================================
    # 1. Week summary / market-lag micro-lesson
    # ======================================================================
    async def generate_week_summary(self, ctx: WeekSummaryContext) -> WeekLesson:
        payload = ctx.model_dump(mode="json")
        content = await self._generate(WEEK_SUMMARY_SYSTEM, payload, WeekLessonContent, temperature=0.6)
        if content is not None:
            if not content.jargon:
                content.jargon = self._fallback_week_lesson(ctx).jargon
            content.jargon = content.jargon[:3]
            return WeekLesson(**content.model_dump(), ai_source=AISource.GEMINI)
        return WeekLesson(**self._fallback_week_lesson(ctx).model_dump(), ai_source=AISource.FALLBACK)

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

        wanted_terms = ["Market lag"]
        if ctx.rent.changed or ctx.rent.paid:
            wanted_terms.append("Liquidity")
        if ctx.bankruptcies or any(c.target_type == TargetType.BANKRUPTCY_RISK for c in ctx.consequences):
            wanted_terms.append("Bankruptcy risk")
        if ctx.dividends_total > 0 or any(c.target_type == TargetType.DIVIDEND for c in ctx.consequences):
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

    # ======================================================================
    # 2. Investment Advisor lifeline
    # ======================================================================
    async def generate_advisor_hint(self, ctx: AdvisorContext) -> AdvisorHint:
        valid_ids = {c.id for c in ctx.companies}
        if ctx.signals:
            system = ADVISOR_SYSTEM_ACCURATE if ctx.accurate else ADVISOR_SYSTEM_MISLEADING
            payload = ctx.model_dump(mode="json", exclude={"accurate"})
            content = await self._generate(system, payload, AdvisorHintContent, temperature=0.8)
            if content is not None and content.hint.strip():
                if content.focus_company_id not in valid_ids:
                    content.focus_company_id = ctx.signals[0].company_id
                return AdvisorHint(**content.model_dump(), ai_source=AISource.GEMINI)
        return AdvisorHint(**self._fallback_advisor(ctx).model_dump(), ai_source=AISource.FALLBACK)

    def _fallback_advisor(self, ctx: AdvisorContext) -> AdvisorHintContent:
        t = self._repo.fallback.advisor
        if not ctx.signals:
            return AdvisorHintContent(hint=t.quiet_week, focus_company_id=None, suggested_action=SuggestedAction.HOLD)

        signal = ctx.signals[0]
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

        if not ctx.accurate:
            template = t.misleading_noise if signal.is_noise else t.misleading_inverted
            return AdvisorHintContent(hint=fill(template, **values), focus_company_id=signal.company_id, suggested_action=move)

        if signal.target_type == TargetType.RENT:
            return AdvisorHintContent(
                hint=fill(t.accurate_rent, **values), focus_company_id=None, suggested_action=SuggestedAction.HOLD
            )
        if signal.target_type == TargetType.BANKRUPTCY_RISK:
            action = SuggestedAction.SELL if signal.direction == "up" else SuggestedAction.WATCH
            return AdvisorHintContent(hint=fill(t.accurate_risk, **values), focus_company_id=signal.company_id, suggested_action=action)
        if signal.target_type == TargetType.DIVIDEND:
            action = SuggestedAction.BUY if signal.direction == "up" else SuggestedAction.WATCH
            return AdvisorHintContent(
                hint=fill(t.accurate_dividend, **values), focus_company_id=signal.company_id, suggested_action=action
            )
        template = t.accurate_delayed if signal.weeks_until_effect > 0 else t.accurate_immediate
        return AdvisorHintContent(hint=fill(template, **values), focus_company_id=signal.company_id, suggested_action=move)

    # ======================================================================
    # 3. End-of-game move analysis & coaching
    # ======================================================================
    async def generate_final_analysis(self, ctx: FinalAnalysisContext) -> MoveAnalysis:
        fallback = build_fallback_analysis(ctx.metrics, self._repo)
        payload = ctx.model_dump(mode="json")
        content = await self._generate(
            FINAL_ANALYSIS_SYSTEM,
            payload,
            MoveAnalysisContent,
            temperature=0.5,
            budget_seconds=self._settings.ai_final_timeout_seconds,
        )
        if content is None:
            return MoveAnalysis(**fallback.model_dump(), ai_source=AISource.FALLBACK)

        # Light post-validation so the UI contract always holds.
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

    # ======================================================================
    # Gemini plumbing
    # ======================================================================
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
            # Never let one hanging call eat the whole budget when another model can still try.
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
                # Overload (503): brief pause before asking again.
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
        except Exception as exc:  # noqa: BLE001 - network, auth, quota, safety blocks...
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
