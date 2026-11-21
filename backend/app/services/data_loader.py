"""Loads, validates and indexes the scenario file (backend/data/game_data.json).

The simulation engine never hardcodes company or event names - everything it
knows about the fictional universe comes through `GameDataRepository`.
"""

from __future__ import annotations

import json
from pathlib import Path

from app.models.schemas import (
    CompanyDefinition,
    EventDefinition,
    GameData,
    IndustryDefinition,
    NoiseInsight,
    ScenarioSettings,
    TargetType,
    WeekDefinition,
)

GLOBAL_TARGET = "global"

REQUIRED_PLAY_STYLES = {"cautious", "balanced", "concentrated", "aggressive", "reactive"}
REQUIRED_TIPS = {
    "diversify",
    "cash_reserve",
    "delayed_signals",
    "noise",
    "bankruptcy",
    "dividends",
    "advisor",
    "patience",
}
REQUIRED_INSIGHTS = {
    "s_diversified",
    "s_caught_delayed",
    "s_dodged_delayed",
    "s_cash_reserve",
    "s_exited_risk",
    "s_avoided_bankrupt",
    "s_ignored_noise",
    "s_dividends",
    "s_profit",
    "s_finished",
    "i_concentrated",
    "i_missed_delayed",
    "i_hit_delayed",
    "i_immediate_hit",
    "i_low_cash",
    "i_liquidity",
    "i_bankrupt_loss",
    "i_followed_noise",
    "i_followed_bad_advice",
    "i_idle_cash",
    "i_overtrading",
    "i_next_level",
}


class ScenarioDataError(ValueError):
    """Raised when game_data.json is structurally valid JSON but logically inconsistent."""


class GameDataRepository:
    """Read-only, indexed view over a validated scenario."""

    def __init__(self, data: GameData) -> None:
        self.data = data
        self._companies: dict[str, CompanyDefinition] = {c.id: c for c in data.companies}
        self._weeks: dict[int, WeekDefinition] = {w.week: w for w in data.weeks}
        self._events: dict[str, tuple[int, EventDefinition]] = {
            e.id: (w.week, e) for w in data.weeks for e in w.events
        }

    # --- scenario -----------------------------------------------------------
    @property
    def scenario(self) -> ScenarioSettings:
        return self.data.scenario

    @property
    def fallback(self):
        return self.data.fallback_texts

    # --- companies & industries --------------------------------------------
    @property
    def companies(self) -> list[CompanyDefinition]:
        return self.data.companies

    def company(self, company_id: str) -> CompanyDefinition | None:
        return self._companies.get(company_id)

    def industry(self, industry_id: str) -> IndustryDefinition | None:
        return self.data.industries.get(industry_id)

    def industry_label(self, industry_id: str) -> str:
        industry = self.industry(industry_id)
        return industry.label if industry else industry_id.title()

    def company_color(self, company_id: str) -> str:
        company = self.company(company_id)
        industry = self.industry(company.industry) if company else None
        return industry.color if industry else "#1B1A17"

    def resolve_company_ids(self, target_id: str) -> list[str]:
        """Company id -> [id]; industry id -> all companies in it; 'global' -> all companies."""
        if target_id == GLOBAL_TARGET:
            return [c.id for c in self.companies]
        if target_id in self._companies:
            return [target_id]
        return [c.id for c in self.companies if c.industry == target_id]

    def target_label(self, target_type: TargetType, target_id: str) -> str:
        if target_type == TargetType.RENT:
            return "Your monthly rent"
        if target_id == GLOBAL_TARGET:
            return "All companies"
        company = self.company(target_id)
        if company:
            return f"{company.name} ({company.ticker})"
        return f"{self.industry_label(target_id)} sector"

    # --- weeks & events -----------------------------------------------------
    def week(self, week_number: int) -> WeekDefinition | None:
        return self._weeks.get(week_number)

    def event(self, event_id: str) -> tuple[int, EventDefinition] | None:
        return self._events.get(event_id)

    def noise_insight(self, event_id: str) -> NoiseInsight | None:
        return self.data.noise_insights.get(event_id)

    def iter_events(self):
        for week in self.data.weeks:
            for event in week.events:
                yield week.week, event


# =============================================================================
# Loading & cross-reference validation
# =============================================================================


def load_game_data(path: Path) -> GameDataRepository:
    if not path.exists():
        raise ScenarioDataError(f"Scenario file not found: {path}")
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ScenarioDataError(f"Scenario file is not valid JSON: {exc}") from exc

    data = GameData.model_validate(raw)
    validate_cross_references(data)
    return GameDataRepository(data)


def validate_cross_references(data: GameData) -> None:
    errors: list[str] = []
    scenario = data.scenario

    if scenario.risk_thresholds.elevated >= scenario.risk_thresholds.critical:
        errors.append("risk_thresholds.elevated must be lower than risk_thresholds.critical")

    company_ids = [c.id for c in data.companies]
    tickers = [c.ticker for c in data.companies]
    if len(set(company_ids)) != len(company_ids):
        errors.append("Company ids must be unique")
    if len(set(tickers)) != len(tickers):
        errors.append("Company tickers must be unique")

    listed_week = {c.id: c.listed_week for c in data.companies}
    if not any(week == 1 for week in listed_week.values()):
        errors.append("At least one company must be listed in week 1")

    for company in data.companies:
        if company.listed_week > scenario.total_weeks:
            errors.append(f"Company '{company.id}' lists after the final week")
        if company.industry not in data.industries:
            errors.append(f"Company '{company.id}' uses unknown industry '{company.industry}'")
        if company.id in data.industries or company.id == GLOBAL_TARGET:
            errors.append(f"Company id '{company.id}' collides with an industry id or 'global'")

    week_numbers = sorted(w.week for w in data.weeks)
    expected = list(range(1, scenario.total_weeks + 1))
    if week_numbers != expected:
        errors.append(f"Weeks must be exactly {expected}, got {week_numbers}")

    valid_company_targets = set(company_ids)
    valid_industry_targets = set(data.industries)
    event_ids: set[str] = set()

    for week in data.weeks:
        for company_id in week.market_drift:
            if company_id not in valid_company_targets:
                errors.append(f"Week {week.week}: market_drift references unknown company '{company_id}'")
            elif listed_week[company_id] > week.week:
                errors.append(f"Week {week.week}: market_drift for '{company_id}' before it is listed")
        for event in week.events:
            if event.id in event_ids:
                errors.append(f"Duplicate event id '{event.id}'")
            event_ids.add(event.id)
            for effect in event.effects:
                where = f"Event '{event.id}' (week {week.week})"
                if effect.target_type == TargetType.RENT:
                    if effect.target_id != GLOBAL_TARGET:
                        errors.append(f"{where}: rent effects must target 'global'")
                elif effect.target_id not in valid_company_targets | valid_industry_targets | {GLOBAL_TARGET}:
                    errors.append(f"{where}: unknown target_id '{effect.target_id}'")
                trigger = week.week + effect.delay_weeks
                if effect.target_id in listed_week and trigger < listed_week[effect.target_id]:
                    errors.append(f"{where}: effect lands before '{effect.target_id}' is listed")
                if trigger > scenario.total_weeks:
                    errors.append(
                        f"{where}: effect triggers in week {trigger}, after the final week "
                        f"{scenario.total_weeks} - the thread would never close"
                    )

    for event_id, insight in data.noise_insights.items():
        if event_id not in event_ids:
            errors.append(f"noise_insights references unknown event '{event_id}'")
        if insight.related_company_id and insight.related_company_id not in valid_company_targets:
            errors.append(f"noise_insights['{event_id}'] references unknown company")

    final_texts = data.fallback_texts.final_analysis
    missing = REQUIRED_PLAY_STYLES - set(final_texts.play_styles)
    if missing:
        errors.append(f"fallback_texts.final_analysis.play_styles is missing {sorted(missing)}")
    missing = REQUIRED_TIPS - set(final_texts.tips)
    if missing:
        errors.append(f"fallback_texts.final_analysis.tips is missing {sorted(missing)}")
    missing = REQUIRED_INSIGHTS - set(final_texts.insights)
    if missing:
        errors.append(f"fallback_texts.final_analysis.insights is missing {sorted(missing)}")

    if errors:
        raise ScenarioDataError("Invalid game_data.json:\n  - " + "\n  - ".join(errors))
