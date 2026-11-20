import { useState } from "react";
import { money, pct, RISK_LABELS, tone } from "../utils/format.js";

function RiskMeter({ level, risk, trend }) {
  const levels = ["low", "elevated", "critical"];
  const activeIndex = levels.indexOf(level);
  return (
    <span className={`risk-meter risk-meter--${level}`}>
      <span className="risk-meter__bars" aria-hidden="true">
        {levels.map((l, i) => (
          <span key={l} className={i <= activeIndex ? "is-lit" : ""} />
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
          <div className="company-card__top">
            <span className="ticker-badge">{c.ticker}</span>
            <span
              className={`change-chip is-${changeTone}`}
              title="Change since the last week closed"
            >
              {c.is_bankrupt ? "−100%" : c.change_pct === null ? "NEW" : pct(c.change_pct)}
            </span>
          </div>

          <p className="eyebrow">{c.industry_label}</p>
          <h3 className="company-card__name">{c.name}</h3>
          <p className="company-card__product">{c.main_product}</p>

          <div className="company-card__price">
            <span>Share price</span>
            <strong>{c.is_bankrupt ? "$0.00" : money(c.price)}</strong>
          </div>

          <dl className="company-card__stats">
            <div>
              <dt>Dividend/share</dt>
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
              <dt>Bankruptcy risk</dt>
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
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setFlipped(true)}>
              Details (Flip)
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
            <span className="eyebrow eyebrow--light">Company file</span>
          </div>
          <h3 className="company-card__name">{c.name}</h3>
          <p className="company-card__desc">{c.description}</p>
          <dl className="company-card__facts">
            <div>
              <dt>Country</dt>
              <dd>{c.country}</dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>{c.owner}</dd>
            </div>
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
