import { useState } from "react";
import InfoTip from "./InfoTip.jsx";
import { everyWeeks, millions, money, pct, RISK_LABELS, tone, whenWeek } from "../utils/format.js";

const DEFAULT_SCALE = { elevated_pct: 47.1, critical_pct: 82.3, bankruptcy_pct: 100 };

/** Trend arrow for the hard data: green when the move is good news, red when it is a warning. */
function Trend({ direction, goodWhen }) {
  if (direction === "neutral") {
    return (
      <span className="trend trend--flat" title="No change since last week">
        =<span className="sr-only"> no change since last week</span>
      </span>
    );
  }
  const good = direction === goodWhen;
  return (
    <span className={`trend ${good ? "trend--good" : "trend--bad"}`} title={`${direction === "up" ? "Up" : "Down"} since last week`}>
      {direction === "up" ? "▲" : "▼"}
      <span className="sr-only"> {direction === "up" ? "rising" : "falling"} since last week</span>
    </span>
  );
}

function HardData({ fundamentals: f }) {
  const marginPct = Math.round(f.profit_margin * 100);
  return (
    <section className="hard-data" aria-label="Hard data">
      <p className="hard-data__title">
        Hard data <small>&middot; this week&apos;s report</small>
      </p>
      <dl className="hard-data__rows">
        <div>
          <dt>
            Cash
            <InfoTip entry="cash">
              This company has {millions(f.cash)} right now, and its cash is{" "}
              {f.cash_trend === "up" ? "growing" : f.cash_trend === "down" ? "shrinking" : "about the same"}.
            </InfoTip>
          </dt>
          <dd>
            {millions(f.cash)} <Trend direction={f.cash_trend} goodWhen="up" />
          </dd>
        </div>
        <div>
          <dt>
            Debt
            <InfoTip entry="debt">
              This company owes {millions(f.debt)}
              {f.debt > f.cash ? ` - more than the ${millions(f.cash)} it has in cash` : ` - less than its cash`}.
            </InfoTip>
          </dt>
          <dd>
            {millions(f.debt)} <Trend direction={f.debt_trend} goodWhen="down" />
          </dd>
        </div>
        <div>
          <dt>
            Profit margin
            <InfoTip entry="profitMargin">
              {marginPct >= 0
                ? `This company keeps about ${marginPct} cents of every $1 it sells.`
                : `This company loses about ${Math.abs(marginPct)} cents on every $1 it sells.`}
            </InfoTip>
          </dt>
          <dd className={marginPct < 0 ? "is-down" : undefined}>
            {marginPct < 0 ? "−" : ""}
            {Math.abs(marginPct)}% <Trend direction={f.margin_trend} goodWhen="up" />
          </dd>
        </div>
      </dl>
      <p className="hard-data__hint">Headlines can hype. Numbers like these are harder to fake.</p>
    </section>
  );
}

/**
 * One continuous gauge from 0% to 100% with the "Elevated" and "Critical" zones shaded and a red line where the
 * company goes bankrupt - so the player sees how far a company is from the edge, not just a word.
 */
function RiskMeter({ level, risk, trend, scale = DEFAULT_SCALE }) {
  const value = Math.round(risk * 100);
  const trendText = trend === "up" ? "rising" : trend === "down" ? "falling" : null;
  return (
    <div className={`risk-meter risk-meter--${level}`}>
      <div className="risk-meter__readout">
        <span className="risk-meter__label">{RISK_LABELS[level]}</span>
        <span className="risk-meter__pct">
          {value}%
          {trendText && (
            <span className={`risk-meter__trend is-${trend}`} title={`Risk ${trendText} since last week`}>
              {trend === "up" ? " ▲" : " ▼"}
              <span className="sr-only"> {trendText} since last week</span>
            </span>
          )}
        </span>
      </div>
      <span
        className="risk-meter__track"
        style={{
          "--elevated": `${scale.elevated_pct}%`,
          "--critical": `${scale.critical_pct}%`,
          "--bust": `${scale.bankruptcy_pct}%`,
        }}
        aria-hidden="true"
      >
        <span className="risk-meter__fill" style={{ width: `${Math.min(100, Math.max(2, value))}%` }} />
        <span className="risk-meter__bust" />
      </span>
      <span className="risk-meter__scale" aria-hidden="true">
        <span>safe</span>
        <span>bankrupt at {Math.round(scale.bankruptcy_pct)}%</span>
      </span>
    </div>
  );
}

function DividendRow({ c, currentWeek }) {
  const changed = Math.abs(c.dividend_per_share - c.previous_dividend) > 1e-6 && !c.is_bankrupt;
  const pays = c.dividend_per_share > 0 && !c.is_bankrupt;
  return (
    <div className="company-card__dividend">
      <dt>
        Dividend
        <InfoTip entry="dividend">
          {pays
            ? `Cash the company pays for each share you own - ${everyWeeks(
                c.dividend_every_weeks,
              )}, on its own calendar. Only owners at the end of a payout week get paid: 10 shares would bring you ${money(
                c.dividend_per_share * 10,
              )}.`
            : "Cash a company pays its owners on its payout days. This one pays nothing right now."}
        </InfoTip>
      </dt>
      <dd>
        {money(c.dividend_per_share)}
        <small> / share</small>
        {changed && (
          <span className={`mini-delta is-${tone(c.dividend_per_share - c.previous_dividend)}`}>
            {c.dividend_per_share > c.previous_dividend ? " ▲" : " ▼"}
          </span>
        )}
        {pays && (
          <small className={`company-card__payday ${c.pays_dividend_this_week ? "is-now" : ""}`}>
            {everyWeeks(c.dividend_every_weeks)} &middot;{" "}
            {c.pays_dividend_this_week ? "payout this week!" : `next ${whenWeek(c.next_dividend_week, currentWeek)}`}
          </small>
        )}
      </dd>
    </div>
  );
}

export default function CompanyCard({ company, onTrade, disabled, currentWeek, riskScale }) {
  const [flipped, setFlipped] = useState(false);
  const c = company;
  const changeTone = c.change_pct === null ? "flat" : tone(c.change_pct);

  return (
    <article
      className={`company-card ${flipped ? "is-flipped" : ""} ${c.is_bankrupt ? "is-bankrupt" : ""} ${
        c.shares_owned > 0 ? "is-owned" : ""
      }`}
      style={{ "--company": c.color }}
      aria-label={`${c.name}, ${c.industry_label}`}
    >
      <div className="company-card__inner">
        {/* ---------------- FRONT ---------------- */}
        <div className="company-card__face company-card__front" inert={flipped || undefined}>
          <span className="paperclip" aria-hidden="true" />
          <div className="company-card__top">
            <span className="ticker-badge">{c.ticker}</span>
            <span
              className={`change-chip is-${changeTone}`}
              title="Change since the last week closed"
            >
              {c.is_bankrupt ? "−100%" : c.change_pct === null ? "NEW" : pct(c.change_pct)}
            </span>
          </div>

          <p className="eyebrow">
            {c.industry_label}
            {c.just_listed && <span className="badge badge--listed">Just listed</span>}
          </p>
          <h3 className="company-card__name">{c.name}</h3>
          <p className="company-card__product">{c.main_product}</p>

          <div className="company-card__price">
            <span>
              Share price <InfoTip entry="sharePrice" />
            </span>
            <strong>{c.is_bankrupt ? "$0.00" : money(c.price)}</strong>
          </div>

          <dl className="company-card__stats">
            <DividendRow c={c} currentWeek={currentWeek} />
            <div className="company-card__risk">
              <dt>
                Bankruptcy risk
                <InfoTip entry="bankruptcyRisk">
                  {c.is_bankrupt
                    ? "This company is already bankrupt: its shares are worth $0."
                    : `This company is at ${Math.round(c.bankruptcy_risk * 100)}%${
                        c.risk_trend === "up" ? " and rising" : c.risk_trend === "down" ? " and falling" : ""
                      }.`}
                </InfoTip>
              </dt>
              <dd>
                <RiskMeter level={c.risk_level} risk={c.bankruptcy_risk} trend={c.risk_trend} scale={riskScale} />
              </dd>
            </div>
            <div className="company-card__owned">
              <dt>You own</dt>
              <dd>
                {c.shares_owned} {c.shares_owned === 1 ? "share" : "shares"}
                {c.shares_owned > 0 && <small> &middot; {money(c.position_value)}</small>}
              </dd>
            </div>
          </dl>

          <div className="company-card__actions">
            <button type="button" className="btn btn--ghost btn--sm company-card__flip" onClick={() => setFlipped(true)}>
              Details (Flip)
              {c.fundamentals.changed_this_week && !c.is_bankrupt && (
                <span className="report-dot" title="New hard data this week">
                  <span className="sr-only"> &middot; new hard data this week</span>
                </span>
              )}
            </button>
            <button
              type="button"
              className="btn btn--ink btn--sm"
              onClick={() => onTrade(c.id)}
              disabled={disabled || c.is_bankrupt}
            >
              Buy / Sell
            </button>
          </div>

          {c.fine_print && (
            <p className="fine-print">
              <span aria-hidden="true">*</span> {c.fine_print}
            </p>
          )}

          {c.is_bankrupt && (
            <div className="bankrupt-stamp" role="status">
              Bankrupt
              <small>Week {c.bankrupt_week} &middot; trading stopped</small>
            </div>
          )}
        </div>

        {/* ---------------- BACK ---------------- */}
        <div className="company-card__face company-card__back" inert={!flipped || undefined}>
          <div className="company-card__top">
            <span className="ticker-badge">{c.ticker}</span>
            <span className="eyebrow">Classified file</span>
          </div>
          <h3 className="company-card__name">{c.name}</h3>
          <p className="company-card__desc">{c.description}</p>
          <HardData fundamentals={c.fundamentals} />
          <dl className="company-card__facts company-card__facts--pair">
            <div>
              <dt>Country</dt>
              <dd>{c.country}</dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>{c.owner}</dd>
            </div>
          </dl>
          <dl className="company-card__facts">
            <div>
              <dt>Condition</dt>
              <dd>{c.condition}</dd>
            </div>
            {c.latest_note && (
              <div className="company-card__latest">
                <dt>Latest (Week {c.latest_note_week})</dt>
                <dd>{c.latest_note}</dd>
              </div>
            )}
          </dl>
          <button type="button" className="btn btn--yellow btn--sm company-card__back-btn" onClick={() => setFlipped(false)}>
            &larr; Back to front
          </button>
        </div>
      </div>
    </article>
  );
}
