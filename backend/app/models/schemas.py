"""Pydantic v2 models for CosmiCash.

Sections:
  1. Enums
  2. Scenario data contract (backend/data/game_data.json)
  3. Session state (internal, persisted by the SessionStore)
  4. Public API requests / responses (what the React client sees)
  5. AI contracts (inputs and structured outputs for Gemini / fallback)
  6. End-of-game analysis
  7. DAY-2 HOOK types (CEO mode, extra instruments)
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# =============================================================================
# 1. ENUMS
# =============================================================================


class GameMode(StrEnum):
    SINGLE_INVESTOR = "single_investor"
    CEO = "ceo"  # DAY-2 HOOK: CEO mode (choose between advisor proposals)


class InstrumentType(StrEnum):
    STOCK = "stock"  # MVP uses only stocks
    BOND = "bond"  # DAY-2 HOOK
    LOAN = "loan"  # DAY-2 HOOK
    TAX = "tax"  # DAY-2 HOOK
    BUDGET_ALLOCATION = "budget_allocation"  # DAY-2 HOOK


class TargetType(StrEnum):
    STOCK_PRICE = "stock_price"
    DIVIDEND = "dividend"
    RENT = "rent"
    BANKRUPTCY_RISK = "bankruptcy_risk"
    SAVINGS_RATE = "savings_rate"  # weekly interest rate of the player's savings account


class ChangeType(StrEnum):
    PERCENT = "percent"  # -0.30 means "minus 30%"
    FLAT = "flat"  # +80 means "plus 80 units" (dollars, risk points, ...)


class TradeAction(StrEnum):
    BUY = "buy"
    SELL = "sell"


class ActionType(StrEnum):
    BUY = "buy"
    SELL = "sell"
    ADVISOR = "advisor"
    DIVIDEND = "dividend"
    RENT = "rent"
    BANKRUPTCY = "bankruptcy"
    DEPOSIT = "deposit"
    WITHDRAW = "withdraw"
    INTEREST = "interest"


class SavingsAction(StrEnum):
    DEPOSIT = "deposit"
    WITHDRAW = "withdraw"


class AISource(StrEnum):
    GEMINI = "gemini"
    FALLBACK = "fallback"


class RiskLevel(StrEnum):
    LOW = "low"
    ELEVATED = "elevated"
    CRITICAL = "critical"


class EndReason(StrEnum):
    COMPLETED = "completed"
    LIQUIDITY = "liquidity"


class SuggestedAction(StrEnum):
    BUY = "buy"
    SELL = "sell"
    HOLD = "hold"
    WATCH = "watch"


Direction = Literal["up", "down", "neutral"]


# =============================================================================
# 2. SCENARIO DATA CONTRACT (game_data.json)
# =============================================================================


class _StrictModel(BaseModel):
    """Scenario files are hand-written: reject unknown keys to catch typos early."""

    model_config = ConfigDict(extra="forbid")


class EffectDefinition(_StrictModel):
    target_type: TargetType
    target_id: str = Field(description="Company id, industry id or 'global'.")
    change_type: ChangeType
    value: float
    delay_weeks: int = Field(ge=0, le=52)
    consequence_text: str = Field(min_length=1)
    cause_chain: list[str] = Field(
        default_factory=list,
        max_length=4,
        description="Short steps from the news to the company's money (no sizes, no timing). "
        "The advisor uses them to explain cause and effect; the outcome step is added automatically.",
    )


class EventDefinition(_StrictModel):
    id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    description: str = Field(min_length=1)
    is_noise: bool
    effects: list[EffectDefinition]

    @model_validator(mode="after")
    def _noise_has_no_effects(self) -> EventDefinition:
        if self.is_noise and self.effects:
            raise ValueError(f"Noise event '{self.id}' must have an empty 'effects' list.")
        if not self.is_noise and not self.effects:
            raise ValueError(f"Market event '{self.id}' needs at least one effect.")
        return self


class Fundamentals(_StrictModel):
    """The 'hard data' printed on the back of a company card."""

    cash: float = Field(ge=0, description="Cash in the bank, in millions of $.")
    debt: float = Field(ge=0, description="Loans still to repay, in millions of $.")
    profit_margin: float = Field(ge=-1, le=1, description="Profit kept from every $1 of sales (0.12 = 12 cents).")


class CompanyReport(_StrictModel):
    """A weekly hard-data update. Only the fields that changed are listed."""

    cash: float | None = Field(default=None, ge=0)
    debt: float | None = Field(default=None, ge=0)
    profit_margin: float | None = Field(default=None, ge=-1, le=1)
    fine_print: str | None = None


class CompanyDefinition(_StrictModel):
    id: str = Field(min_length=1)
    name: str
    ticker: str = Field(min_length=1, max_length=6)
    industry: str
    main_product: str
    initial_price: float = Field(gt=0)
    dividend_per_share: float = Field(ge=0)
    bankruptcy_risk: float = Field(ge=0.0, le=1.0)
    description: str
    country: str
    owner: str
    condition: str
    listed_week: int = Field(default=1, ge=1, description="Week the company joins the exchange (IPO).")
    fundamentals: Fundamentals
    fine_print: str = Field(default="", description="Small footnote at the bottom of the card that rewards careful reading.")


class IndustryDefinition(_StrictModel):
    label: str
    color: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")


class WeekDefinition(_StrictModel):
    week: int = Field(ge=1)
    theme: str
    market_drift: dict[str, float] = Field(
        default_factory=dict,
        description="Small scripted everyday price wiggle per company (percent as fraction).",
    )
    reports: dict[str, CompanyReport] = Field(
        default_factory=dict,
        description="Hard data published at the START of this week (company id -> changed values).",
    )
    events: list[EventDefinition]


class NoiseInsight(_StrictModel):
    related_company_id: str | None = None
    misleading_direction: Literal["up", "down"]
    reveal: str
    misleading_chain: list[str] = Field(
        default_factory=list,
        max_length=4,
        description="The tempting (but wrong) reasoning a misled advisor would give about this rumor.",
    )


class RiskThresholds(_StrictModel):
    elevated: float = Field(ge=0, le=1)
    critical: float = Field(ge=0, le=1)


class ScenarioSettings(_StrictModel):
    id: str
    title: str
    tagline: str
    description: str
    total_weeks: int = Field(ge=1, le=52)
    starting_cash: float = Field(gt=0)
    initial_monthly_rent: float = Field(ge=0)
    rent_period_weeks: int = Field(ge=1)
    sell_spread: float = Field(
        default=0.0, ge=0.0, lt=1.0, description="Selling fee/spread: you sell at price x (1 - sell_spread)."
    )
    bankruptcy_threshold: float = Field(gt=0, le=1)
    risk_sensitivity: float = Field(
        default=0.0,
        ge=0.0,
        le=5.0,
        description="Weekly risk change = -risk_sensitivity x price change (falling prices raise risk).",
    )
    risk_thresholds: RiskThresholds
    advisor_uses_per_game: int = Field(ge=0)
    advisor_cooldown_weeks: int = Field(default=1, ge=1, description="One advisor hint per this many weeks.")
    advisor_accuracy: float = Field(ge=0, le=1)
    savings_account_name: str = Field(default="Savings account")
    savings_weekly_rate: float = Field(
        default=0.0, ge=0.0, le=0.1, description="Interest paid on savings at the end of every week (0.003 = 0.3%)."
    )


class WeekLessonTexts(_StrictModel):
    title_delayed: str
    title_immediate: str
    title_quiet: str
    summary_moves: str
    summary_no_moves: str
    lag_with_delayed: str
    lag_without_delayed: str
    immediate_note: str
    noise_note: str
    rent_change_note: str
    rent_paid_note: str
    dividend_note: str
    bankruptcy_note: str
    savings_note: str
    savings_rent_note: str
    savings_rate_note: str
    takeaway_delayed: str
    takeaway_immediate: str
    takeaway_quiet: str


class AdvisorTexts(_StrictModel):
    accurate_delayed: str
    accurate_immediate: str
    accurate_risk: str
    accurate_dividend: str
    accurate_rent: str
    accurate_savings: str
    misleading_noise: str
    misleading_inverted: str
    quiet_week: str
    quiet_chain: list[str]
    timing_now: str
    timing_soon: str
    timing_later: str
    direction_up: str
    direction_down: str
    chain_middle: dict[str, str] = Field(description="'<target_type>:<up|down>' -> generic middle step.")
    chain_outcome: dict[str, str] = Field(description="'<target_type>:<up|down>' -> final step of every chain.")


class TextPair(_StrictModel):
    title: str
    detail: str


class PlayStyleText(_StrictModel):
    label: str
    description: str


class TipText(_StrictModel):
    title: str
    tip: str


class VerdictText(_StrictModel):
    approved: bool
    title: str
    reason: str


class HabitText(_StrictModel):
    title: str
    habit: str


class FinalAnalysisTexts(_StrictModel):
    play_styles: dict[str, PlayStyleText]
    tips: dict[str, TipText]
    overall_positive: str
    overall_neutral: str
    overall_negative: str
    overall_liquidity: str
    insights: dict[str, TextPair]
    verdicts: dict[str, VerdictText]
    habits: dict[str, HabitText]


class FallbackTexts(_StrictModel):
    week_lesson: WeekLessonTexts
    glossary: dict[str, str]
    advisor: AdvisorTexts
    final_analysis: FinalAnalysisTexts


class GameData(_StrictModel):
    scenario: ScenarioSettings
    industries: dict[str, IndustryDefinition]
    companies: list[CompanyDefinition]
    weeks: list[WeekDefinition]
    noise_insights: dict[str, NoiseInsight] = Field(default_factory=dict)
    fallback_texts: FallbackTexts


# =============================================================================
# 3. SESSION STATE (internal)
# =============================================================================


class GameModifiers(BaseModel):
    enable_dividends: bool = True
    enable_living_costs: bool = True


def _empty_fundamentals() -> Fundamentals:
    return Fundamentals(cash=0.0, debt=0.0, profit_margin=0.0)


class CompanyState(BaseModel):
    id: str
    price: float
    previous_price: float
    dividend_per_share: float
    previous_dividend: float
    bankruptcy_risk: float
    previous_risk: float
    is_bankrupt: bool = False
    bankrupt_week: int | None = None
    latest_note: str | None = None
    latest_note_week: int | None = None
    fundamentals: Fundamentals = Field(default_factory=_empty_fundamentals)
    previous_fundamentals: Fundamentals = Field(default_factory=_empty_fundamentals)
    fine_print: str = ""


class PortfolioPosition(BaseModel):
    company_id: str
    instrument_type: InstrumentType = InstrumentType.STOCK
    shares: int = 0
    avg_cost: float = 0.0


class PendingEffect(BaseModel):
    """A scheduled consequence waiting in the delayed-effects queue."""

    event_id: str
    source_event_title: str
    source_week: int
    trigger_week: int
    effect: EffectDefinition


class CompanyImpact(BaseModel):
    company_id: str
    ticker: str
    before: float
    after: float
    player_shares: int


class TriggeredConsequence(BaseModel):
    """An effect that has just been applied to the market (immediate or delayed)."""

    event_id: str
    event_title: str
    source_week: int
    trigger_week: int
    is_delayed: bool
    delay_weeks: int
    target_type: TargetType
    target_id: str
    target_label: str
    change_type: ChangeType
    value: float
    direction: Direction
    impact_label: str
    consequence_text: str
    company_impacts: list[CompanyImpact] = Field(default_factory=list)
    rent_before: float | None = None
    rent_after: float | None = None
    rate_before: float | None = None
    rate_after: float | None = None


class PricePoint(BaseModel):
    week: int
    label: str
    prices: dict[str, float]


class ActionLogEntry(BaseModel):
    seq: int
    week: int
    action_type: ActionType
    company_id: str | None = None
    ticker: str | None = None
    shares: int | None = None
    price: float | None = None
    amount: float = 0.0
    cash_after: float
    note: str = ""
    details: dict[str, Any] = Field(default_factory=dict)


class RentPayment(BaseModel):
    week: int
    amount: float
    cash_before: float
    cash_after: float
    savings_before: float = 0.0
    from_savings: float = 0.0


class BankruptcyRecord(BaseModel):
    company_id: str
    week: int
    last_price: float
    player_shares: int
    risk: float


class WeeklySnapshot(BaseModel):
    week: int
    cash: float
    stocks_value: float
    savings: float = 0.0
    interest_earned: float = 0.0
    net_worth: float
    holdings: dict[str, int]
    prices: dict[str, float]
    dividends_received: float
    rent_paid: float
    monthly_rent: float
    triggered_event_ids: list[str]
    news_event_ids: list[str]
    trades_this_week: int


class GameSession(BaseModel):
    session_id: str
    scenario_id: str
    created_at: datetime = Field(default_factory=utc_now)
    game_mode: GameMode
    modifiers: GameModifiers
    seed: int
    current_week: int = 1
    is_game_over: bool = False
    end_reason: EndReason | None = None
    starting_cash: float
    cash: float
    monthly_rent: float
    previous_monthly_rent: float
    rent_delta: float = 0.0
    rent_changed_week: int | None = None
    rent_change_source_week: int | None = None
    total_rent_paid: float = 0.0
    total_dividends: float = 0.0
    savings: float = 0.0
    savings_rate: float = 0.0
    previous_savings_rate: float = 0.0
    savings_rate_changed_week: int | None = None
    savings_rate_source_week: int | None = None
    total_interest: float = 0.0
    companies: dict[str, CompanyState]
    portfolio: dict[str, PortfolioPosition] = Field(default_factory=dict)
    pending_effects: list[PendingEffect] = Field(default_factory=list)
    price_history: list[PricePoint] = Field(default_factory=list)
    action_log: list[ActionLogEntry] = Field(default_factory=list)
    weekly_snapshots: list[WeeklySnapshot] = Field(default_factory=list)
    consequence_log: list[TriggeredConsequence] = Field(default_factory=list)
    rent_payments: list[RentPayment] = Field(default_factory=list)
    bankruptcies: list[BankruptcyRecord] = Field(default_factory=list)
    advisor_uses_left: int
    advisor_used_weeks: list[int] = Field(default_factory=list)
    final_analysis: FinalAnalysisResponse | None = None


# =============================================================================
# 4. PUBLIC API
# =============================================================================


class CreateSessionRequest(BaseModel):
    game_mode: GameMode = GameMode.SINGLE_INVESTOR
    modifiers: GameModifiers = Field(default_factory=GameModifiers)
    seed: int | None = Field(default=None, ge=0, le=2_147_483_647)


class TradeRequest(BaseModel):
    company_id: str = Field(min_length=1, max_length=64)
    action: TradeAction
    shares: int = Field(ge=0, le=1_000_000)


class SavingsRequest(BaseModel):
    action: SavingsAction
    amount: float = Field(gt=0, le=1_000_000_000)


class NewsTag(BaseModel):
    """'Who could this story be about?' Rumors get tags too, so a tag never reveals noise."""

    kind: Literal["sector", "bills", "savings"]
    label: str
    color: str | None = None
    tickers: list[str] = Field(default_factory=list)
    company_ids: list[str] = Field(default_factory=list)


class NewsItem(BaseModel):
    """What the player sees during a turn. Deliberately has NO is_noise / effects / delay."""

    id: str
    title: str
    description: str
    tags: list[NewsTag] = Field(default_factory=list)


class FundamentalsView(BaseModel):
    cash: float
    debt: float
    profit_margin: float
    cash_trend: Direction
    debt_trend: Direction
    margin_trend: Direction
    changed_this_week: bool


class CompanyView(BaseModel):
    id: str
    name: str
    ticker: str
    industry: str
    industry_label: str
    color: str
    main_product: str
    description: str
    country: str
    owner: str
    condition: str
    price: float
    previous_price: float
    sell_price: float
    change_pct: float | None
    listed_week: int
    just_listed: bool
    dividend_per_share: float
    previous_dividend: float
    bankruptcy_risk: float
    risk_level: RiskLevel
    risk_trend: Direction
    is_bankrupt: bool
    bankrupt_week: int | None
    latest_note: str | None
    latest_note_week: int | None
    shares_owned: int
    avg_cost: float
    position_value: float
    max_affordable: int
    fundamentals: FundamentalsView
    fine_print: str


class SavingsView(BaseModel):
    account_name: str
    balance: float
    weekly_rate_pct: float
    previous_rate_pct: float
    rate_changed_week: int | None
    rate_change_source_week: int | None
    total_interest: float
    projected_interest: float


class RentView(BaseModel):
    enabled: bool
    monthly_rent: float
    previous_monthly_rent: float
    rent_delta: float
    changed_week: int | None
    change_source_week: int | None
    period_weeks: int
    next_due_week: int | None
    weeks_until_due: int | None
    total_paid: float


class AdvisorView(BaseModel):
    uses_left: int
    uses_total: int
    can_use: bool
    used_this_week: bool
    cooldown_weeks: int
    next_available_week: int | None
    accuracy_percent: int
    disclaimer: str


class ScenarioView(BaseModel):
    id: str
    title: str
    tagline: str
    description: str
    total_weeks: int
    week_theme: str | None


class NetWorthPoint(BaseModel):
    week: int
    label: str
    net_worth: float


class GameStateResponse(BaseModel):
    session_id: str
    game_mode: GameMode
    modifiers: GameModifiers
    scenario: ScenarioView
    current_week: int
    total_weeks: int
    is_game_over: bool
    end_reason: EndReason | None
    cash: float
    stocks_value: float
    net_worth: float
    starting_cash: float
    roi_pct: float
    total_dividends: float
    sell_spread_pct: float
    rent: RentView
    savings: SavingsView
    advisor: AdvisorView
    companies: list[CompanyView]
    news: list[NewsItem]
    price_history: list[PricePoint]
    net_worth_history: list[NetWorthPoint]


class ScenarioInfo(BaseModel):
    """Lightweight scenario preview for the onboarding screen."""

    id: str
    title: str
    tagline: str
    description: str
    total_weeks: int
    starting_cash: float
    initial_monthly_rent: float
    rent_period_weeks: int
    companies_count: int
    starting_companies: int
    listing_interval_weeks: int | None
    savings_account_name: str
    savings_weekly_rate_pct: float
    available_modes: list[GameMode]
    coming_soon_modes: list[GameMode]


class TradeResponse(BaseModel):
    action: TradeAction
    company_id: str
    ticker: str
    requested_shares: int
    executed_shares: int
    was_clamped: bool
    price: float
    market_price: float
    total: float
    message: str
    state: GameStateResponse


class SavingsResponse(BaseModel):
    action: SavingsAction
    requested_amount: float
    amount: float
    was_clamped: bool
    message: str
    state: GameStateResponse


class AdvisorResponse(BaseModel):
    week: int
    hint: str
    cause_and_effect: list[str]
    focus_company_id: str | None
    focus_company_name: str | None
    suggested_action: SuggestedAction
    ai_source: AISource
    uses_left: int
    disclaimer: str
    state: GameStateResponse


class ConsequenceView(BaseModel):
    event_title: str
    source_week: int
    trigger_week: int
    is_delayed: bool
    delay_weeks: int
    target_type: TargetType
    target_label: str
    direction: Direction
    impact_label: str
    consequence_text: str
    affected_tickers: list[str]
    player_was_exposed: bool


class PriceChange(BaseModel):
    company_id: str
    name: str
    ticker: str
    color: str
    old_price: float
    new_price: float
    change_pct: float
    risk_before: float
    risk_after: float
    is_bankrupt: bool
    shares_owned: int


class DividendItem(BaseModel):
    company_id: str
    ticker: str
    shares: int
    per_share: float
    amount: float


class RentUpdate(BaseModel):
    enabled: bool
    changed: bool
    old_rent: float
    new_rent: float
    delta: float
    source_week: int | None
    paid: bool
    amount_paid: float
    cash_before_payment: float | None
    from_savings: float = 0.0
    next_due_week: int | None


class SavingsUpdate(BaseModel):
    balance_before: float
    interest: float
    rate_pct: float
    rate_changed: bool
    old_rate_pct: float
    rate_source_week: int | None
    rent_from_savings: float
    balance_after: float


class BankruptcyNotice(BaseModel):
    company_id: str
    name: str
    ticker: str
    message: str
    player_shares: int
    lost_value: float


class UnmaskedNoise(BaseModel):
    event_id: str
    title: str
    explanation: str
    related_company_id: str | None


class WeekSummaryResponse(BaseModel):
    week: int
    theme: str
    triggered_consequences: list[ConsequenceView]
    price_changes: list[PriceChange]
    dividends: list[DividendItem]
    dividends_total: float
    rent: RentUpdate
    savings: SavingsUpdate
    bankruptcies: list[BankruptcyNotice]
    unmasked_noise: list[UnmaskedNoise]
    lesson: WeekLesson
    net_worth_before: float
    net_worth_after: float
    net_worth_change: float
    net_worth_change_pct: float
    cash_after: float
    is_game_over: bool
    end_reason: EndReason | None


class NextWeekResponse(BaseModel):
    summary: WeekSummaryResponse
    state: GameStateResponse


# =============================================================================
# 5. AI CONTRACTS
# =============================================================================
# "*Content" models are the exact JSON schemas Gemini must return.
# The public models add `ai_source` so the UI can label Gemini vs. fallback.


class JargonTerm(BaseModel):
    term: str = Field(description="A finance word used this week, e.g. 'Dividend'.")
    meaning: str = Field(description="One plain-English sentence anyone can understand.")


class WeekLessonContent(BaseModel):
    title: str = Field(description="Catchy headline for the week, max 8 words.")
    summary: str = Field(description="2-3 short sentences on what moved and why.")
    market_lag_lesson: str = Field(
        description="2-4 sentences explaining market lag, linking older news (Week X) to effects now."
    )
    jargon: list[JargonTerm] = Field(description="1-3 finance terms explained simply.")
    key_takeaway: str = Field(description="One memorable sentence to remember.")


class WeekLesson(WeekLessonContent):
    ai_source: AISource


class WeekSummaryContext(BaseModel):
    week: int
    total_weeks: int
    consequences: list[ConsequenceView]
    price_changes: list[PriceChange]
    unmasked_noise: list[UnmaskedNoise]
    rent: RentUpdate
    savings: SavingsUpdate
    dividends_total: float
    bankruptcies: list[BankruptcyNotice]
    net_worth_change: float


class AdvisorSignal(BaseModel):
    event_title: str
    company_id: str | None
    company_name: str | None
    ticker: str | None
    target_type: TargetType
    direction: Literal["up", "down"]
    weeks_until_effect: int
    is_noise: bool = False
    cause_chain: list[str] = Field(default_factory=list)


class AdvisorCompanyBrief(BaseModel):
    id: str
    name: str
    ticker: str
    industry: str
    price: float
    risk_level: RiskLevel
    shares_owned: int
    cash_millions: float
    debt_millions: float
    profit_margin_pct: float


class AdvisorContext(BaseModel):
    week: int
    total_weeks: int
    accurate: bool
    signals: list[AdvisorSignal]
    companies: list[AdvisorCompanyBrief]
    player_cash: float
    player_savings: float
    savings_rate_pct: float
    rent_due_week: int | None
    monthly_rent: float


class AdvisorHintContent(BaseModel):
    hint: str = Field(description="One friendly hint, max 55 words, no exact numbers.")
    cause_and_effect: list[str] = Field(
        description="3-5 very short steps (max 7 words each) from the news to the company's money to its "
        "share price, e.g. ['Cooks earn more', 'Restaurant costs go up', 'Profit shrinks', 'Share price may dip']."
    )
    focus_company_id: str | None = Field(description="Id of the company the hint is about, or null.")
    suggested_action: SuggestedAction


class AdvisorHint(AdvisorHintContent):
    ai_source: AISource


# =============================================================================
# 6. END-OF-GAME ANALYSIS
# =============================================================================


class DelayedSignalOutcome(BaseModel):
    event_title: str
    company_id: str
    ticker: str
    source_week: int
    trigger_week: int
    impact_label: str
    direction: Direction
    player_shares: int
    value_change: float = Field(default=0.0, description="What the effect did to the player's shares, in $.")
    bought_week: int | None = Field(
        default=None, description="Week the player BOUGHT this stock after the warning news appeared."
    )
    outcome: Literal["caught", "missed", "hit", "dodged", "neutral"]


class ShockOutcome(BaseModel):
    event_title: str
    ticker: str
    week: int
    impact_label: str
    player_shares: int
    loss: float


class BankruptcyOutcome(BaseModel):
    company_id: str
    ticker: str
    week: int
    outcome: Literal["loss", "exited", "avoided"]
    player_shares: int
    loss: float


class NoiseFollow(BaseModel):
    week: int
    event_title: str
    ticker: str
    action: TradeAction


class AdvisorUse(BaseModel):
    week: int
    accurate: bool
    ticker: str | None
    suggested_action: SuggestedAction
    followed: bool
    followed_action: TradeAction | None


class RentCheck(BaseModel):
    week: int
    rent: float
    cash_before: float
    savings_before: float = 0.0
    from_savings: float = 0.0
    status: Literal["comfortable", "tight", "short"]


class PlayerMetrics(BaseModel):
    """Deterministic, explainable metrics. Feed both Gemini and the offline analyzer."""

    final_net_worth: float
    starting_cash: float
    roi_pct: float
    total_dividends: float
    total_rent_paid: float
    trades_count: int
    buys_count: int
    sells_count: int
    distinct_companies: int
    distinct_industries: int
    max_concentration_pct: float
    max_concentration_ticker: str | None
    avg_invested_pct: float
    avg_savings_pct: float = 0.0
    final_savings: float = 0.0
    total_interest: float = 0.0
    rent_covered_by_savings: float = 0.0
    noise_events_total: int
    noise_followed: list[NoiseFollow]
    delayed_signals: list[DelayedSignalOutcome]
    immediate_shocks: list[ShockOutcome]
    bankruptcies: list[BankruptcyOutcome]
    advisor_uses: list[AdvisorUse]
    rent_checks: list[RentCheck]
    liquidity_loss: bool
    liquidity_week: int | None
    weeks_played: int
    play_style_key: str


class AnalysisPoint(BaseModel):
    title: str = Field(description="Short title, max 7 words.")
    detail: str = Field(description="1-2 sentences referencing the player's real moves (week, ticker).")


class PracticalTip(BaseModel):
    title: str = Field(description="Short tip title, max 6 words.")
    tip: str = Field(description="One or two plain sentences of universal, practical advice.")


class InspectorVerdict(BaseModel):
    approved: bool = Field(description="true = APPROVED stamp, false = REJECTED stamp.")
    title: str = Field(description="2-3 word inspector label, e.g. 'Prudent Strategist' or 'FOMO Victim'.")
    reason: str = Field(description="One plain sentence that justifies the stamp with a real fact from the game.")


class KeyMoment(BaseModel):
    week: int = Field(description="The game week this moment happened in.")
    kind: Literal["mistake", "win"]
    title: str = Field(description="Short title, max 7 words.")
    detail: str = Field(
        description="1-2 sentences: the news, the player's decision and what it caused, e.g. "
        "'In Week 3 you bought PIZA despite the news about higher cook wages, which cut its profit in Week 4.'"
    )


class RealLifeHabit(BaseModel):
    title: str = Field(description="Short habit name, max 6 words.")
    habit: str = Field(description="1-2 sentences: one simple money or banking habit to start in real life this month.")


class MoveAnalysisContent(BaseModel):
    verdict: InspectorVerdict
    key_moments: list[KeyMoment] = Field(description="Exactly 2 specific weeks that decided the season, mistakes first.")
    real_life_habit: RealLifeHabit
    play_style: str = Field(description="2-3 word label of the player's style.")
    play_style_summary: str = Field(description="1-2 sentences describing the style.")
    overall_message: str = Field(description="One encouraging sentence about the final result.")
    strengths: list[AnalysisPoint] = Field(description="2-4 things the player did well.")
    improvements: list[AnalysisPoint] = Field(description="2-4 concrete things to change.")
    actionable_tips: list[PracticalTip] = Field(description="Exactly 3 or 4 practical tips.")


class MoveAnalysis(MoveAnalysisContent):
    ai_source: AISource


class FinalStats(BaseModel):
    final_net_worth: float
    starting_cash: float
    roi_pct: float
    total_dividends: float
    total_rent_paid: float
    final_cash: float
    final_stocks_value: float
    final_savings: float = 0.0
    total_interest: float = 0.0
    trades_count: int
    weeks_played: int
    end_reason: EndReason | None


class WeekResult(BaseModel):
    week: int
    net_worth: float
    change: float
    change_pct: float


class ChartCompany(BaseModel):
    id: str
    name: str
    ticker: str
    color: str
    is_bankrupt: bool


class TimelineEntry(BaseModel):
    week: int
    event_id: str
    title: str
    is_noise: bool
    effects: list[str]
    noise_explanation: str | None = None


class FinalAnalysisContext(BaseModel):
    metrics: PlayerMetrics
    stats: FinalStats
    action_log: list[ActionLogEntry]
    weekly_snapshots: list[WeeklySnapshot]
    market_timeline: list[TimelineEntry]
    companies: list[ChartCompany]


class FinalAnalysisResponse(BaseModel):
    session_id: str
    stats: FinalStats
    analysis: MoveAnalysis
    weekly_results: list[WeekResult]
    trade_history: list[ActionLogEntry]
    price_history: list[PricePoint]
    companies: list[ChartCompany]
    market_timeline: list[TimelineEntry]


# =============================================================================
# 7. DAY-2 HOOK TYPES (architecture only, no business logic in the MVP)
# =============================================================================


class AdvisorRole(StrEnum):
    CFO = "cfo"
    CTO = "cto"


class AdvisorProposal(BaseModel):
    """DAY-2 HOOK: CEO mode - each turn two specialised advisors pitch an investment."""

    proposal_id: str
    advisor_role: AdvisorRole
    title: str
    pitch: str
    cost: float = Field(ge=0)
    expected_return_pct: float
    risk_level: RiskLevel
    horizon_weeks: int = Field(ge=0)


class CEODecision(StrEnum):
    """DAY-2 HOOK: the four choices a CEO can make on a pair of proposals."""

    INVEST_FIRST = "invest_first"
    INVEST_SECOND = "invest_second"
    INVEST_BOTH = "invest_both"
    INVEST_NONE = "invest_none"


class CEODecisionRequest(BaseModel):
    """DAY-2 HOOK: payload for POST /api/sessions/{id}/ceo/decision."""

    week: int = Field(ge=1)
    decision: CEODecision
    proposals: list[AdvisorProposal] = Field(default_factory=list, max_length=2)


class InstrumentPosition(BaseModel):
    """DAY-2 HOOK: generic portfolio line for bonds, loans, taxes and budget envelopes."""

    instrument_type: InstrumentType
    instrument_id: str
    principal: float
    rate_pct: float = 0.0
    term_weeks: int | None = None


# Resolve forward references (GameSession -> FinalAnalysisResponse, etc.).
GameSession.model_rebuild()
WeekSummaryResponse.model_rebuild()
