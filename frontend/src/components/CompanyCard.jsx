import { useState } from "react";
import InfoTip from "./InfoTip.jsx";
import { millions, money, pct, RISK_LABELS, tone } from "../utils/format.js";

const RISK_SEGMENTS = 10;

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
            <InfoTip term="Cash">
              Money the company has in the bank right now. Little cash and big bills is a dangerous mix.
            </InfoTip>
          </dt>
          <dd>
            {millions(f.cash)} <Trend direction={f.cash_trend} goodWhen="up" />
          </dd>
        </div>
        <div>
          <dt>
            Debt
            <InfoTip term="Debt">
              Money the company borrowed and must pay back with interest. Rising debt is a warning light.
            </InfoTip>
          </dt>
          <dd>
            {millions(f.debt)} <Trend direction={f.debt_trend} goodWhen="down" />
          </dd>
        </div>
        <div>
          <dt>
            Profit margin
            <InfoTip term="Profit margin">
              How many cents of every $1 of sales the company keeps as profit. Below zero means it loses money.
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

function RiskMeter({ level, risk, trend }) {
  // 10 segments, one per 10% of bankruptcy risk, so 5% and 35% look different.
  const lit = Math.max(1, Math.min(RISK_SEGMENTS, Math.round(risk * RISK_SEGMENTS)));
  return (
    <span className={`risk-meter risk-meter--${level}`}>
      <span className="risk-meter__bars" aria-hidden="true">
        {Array.from({ length: RISK_SEGMENTS }, (_, i) => (
          <span key={i} className={i < lit ? "is-lit" : ""} />
        ))}
      </span>
      <span className="risk-meter__label">
        {RISK_LABELS[level]}
        <small>
          {" "}
          {Math.round(risk * 100)}%{trend === "up" ? " ↑" : trend === "down" ? " ↓" : ""}
        </small>
      </span>
    </span>
  );
}

export default function CompanyCard({ company, onTrade, disabled }) {
  const [flipped, setFlipped] = useState(false);
  const c = company;
  const changeTone = c.change_pct === null ? "flat" : tone(c.change_pct);
  const dividendChanged = Math.abs(c.dividend_per_share - c.previous_dividend) > 1e-6 && !c.is_bankrupt;

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
            <span>Share price</span>
            <strong>{c.is_bankrupt ? "$0.00" : money(c.price)}</strong>
          </div>

          <dl className="company-card__stats">
            <div>
              <dt>
                Dividend/share
                <InfoTip term="Dividend/share">
                  {c.dividend_per_share > 0
                    ? `Cash the company pays you every week for each share you own: 10 shares would bring you ${money(
                        c.dividend_per_share * 10,
                      )} a week.`
                    : "Cash a company pays its owners every week. This one pays nothing right now."}
                </InfoTip>
              </dt>
              <dd>
                {money(c.dividend_per_share)}
                <small> / week</small>
                {dividendChanged && (
                  <span className={`mini-delta is-${tone(c.dividend_per_share - c.previous_dividend)}`}>
                    {c.dividend_per_share > c.previous_dividend ? " ▲" : " ▼"}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt>
                Bankruptcy risk
                <InfoTip term="Bankruptcy risk">
                  The chance that this company runs out of money. If it goes bankrupt, its shares drop to $0 and you
                  lose 100% of what you put in.
                </InfoTip>
              </dt>
              <dd>
                <RiskMeter level={c.risk_level} risk={c.bankruptcy_risk} trend={c.risk_trend} />
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
