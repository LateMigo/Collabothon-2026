import { useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import { clamp, everyWeeks, money, plural, whenWeek } from "../utils/format.js";
import InfoTip from "./InfoTip.jsx";

const REASONS = [
  { id: "news", label: "A news story" },
  { id: "trend", label: "Price trend" },
  { id: "advisor", label: "Advisor's tip" },
  { id: "gut", label: "Gut feeling" },
  { id: "cash", label: "I need cash" },
];

export default function TradeModal({ company, game, onClose, onTrade }) {
  const [reason, setReason] = useState(null);
  const canBuy = company.max_affordable > 0;
  const [mode, setMode] = useState(!canBuy && company.shares_owned > 0 ? "sell" : "buy");
  const [shares, setShares] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [approved, setApproved] = useState(false);
  const closeTimer = useRef(null);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const price = company.price;
  const unitPrice = mode === "buy" ? price : company.sell_price;
  const feePct = game.sell_spread_pct;
  const breakEvenPct = feePct > 0 ? (100 / (100 - feePct) - 1) * 100 : 0;
  const max = mode === "buy" ? Math.max(0, Math.floor((game.cash + 1e-9) / price)) : company.shares_owned;
  const value = clamp(shares, 0, max);
  const total = value * unitPrice;
  const cashAfter = mode === "buy" ? game.cash - total : game.cash + total;

  const rent = game.rent;
  const savings = game.savings.balance;
  const rentWarning =
    mode === "buy" &&
    value > 0 &&
    rent.enabled &&
    rent.next_due_week !== null &&
    cashAfter + savings + game.fixed_income.maturing_this_week < rent.monthly_rent;

  const switchMode = (next) => {
    setMode(next);
    setShares(0);
    setError(null);
  };

  const onInput = (event) => {
    const digits = event.target.value.replace(/[^0-9]/g, "");
    const parsed = digits === "" ? 0 : parseInt(digits, 10);
    setShares(clamp(Number.isFinite(parsed) ? parsed : 0, 0, max));
    setError(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (value <= 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onTrade(company.id, mode, value, reason);
      setApproved(true);
      closeTimer.current = setTimeout(onClose, 900);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const verb = mode === "buy" ? "Buy" : "Sell";

  return (
    <Modal labelledBy="trade-title" onClose={onClose} className="trade-modal">
      <form onSubmit={submit} style={{ "--company": company.color }}>
        <header className="trade-modal__head">
          <span className="ticker-badge">{company.ticker}</span>
          <div>
            <p className="eyebrow">Form T-1 &middot; Share order &middot; {company.industry_label}</p>
            <h2 id="trade-title" className="trade-modal__title">
              {company.name}
            </h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </header>

        <div className="segmented segmented--large" role="tablist" aria-label="Trade type">
          <button type="button" role="tab" aria-selected={mode === "buy"} aria-pressed={mode === "buy"} onClick={() => switchMode("buy")}>
            Buy
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "sell"}
            aria-pressed={mode === "sell"}
            onClick={() => switchMode("sell")}
          >
            Sell
          </button>
        </div>

        <dl className="trade-facts">
          <div>
            <dt>{mode === "buy" ? "Price per share" : "You get per share"}</dt>
            <dd>{money(unitPrice)}</dd>
          </div>
          <div>
            <dt>Your cash</dt>
            <dd>{money(game.cash)}</dd>
          </div>
          <div>
            <dt>You own</dt>
            <dd>{plural(company.shares_owned, "share")}</dd>
          </div>
        </dl>

        <div className="amount-bar">
          <label htmlFor="trade-shares" className="amount-bar__label">
            How many shares?
            <small>
              {mode === "buy" ? `You can afford up to ${max}` : `You can sell up to ${max}`}
            </small>
          </label>
          <div className="stepper-input">
            <button type="button" onClick={() => setShares(clamp(value - 1, 0, max))} aria-label="One share less" disabled={value <= 0}>
              &minus;
            </button>
            <input
              id="trade-shares"
              data-autofocus
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={String(value)}
              onChange={onInput}
              onFocus={(e) => e.target.select()}
              aria-describedby="trade-hint"
            />
            <button type="button" onClick={() => setShares(clamp(value + 1, 0, max))} aria-label="One share more" disabled={value >= max}>
              +
            </button>
          </div>
        </div>

        <div className="trade-reason" role="group" aria-label="Why are you trading? (optional)">
          <span className="trade-reason__label">
            Why? <small>(optional - the coach reviews your reasons at the end of the week)</small>
          </span>
          <span className="trade-reason__chips">
            {REASONS.filter((r) => mode === "sell" || r.id !== "cash").map((r) => (
              <button
                key={r.id}
                type="button"
                className={reason === r.id ? "is-on" : ""}
                aria-pressed={reason === r.id}
                onClick={() => setReason(reason === r.id ? null : r.id)}
              >
                {r.label}
              </button>
            ))}
          </span>
        </div>

        <p id="trade-hint" className="trade-hint">
          {max === 0
            ? mode === "buy"
              ? "You don't have enough cash for even one share."
              : "You don't own any shares of this company yet."
            : `Numbers above ${max} are adjusted automatically.`}
        </p>

        {feePct > 0 && (
          <p className="fee-note">
            {mode === "buy" ? (
              <>
                <strong>Selling costs {feePct}%.</strong> <InfoTip entry="sellFee" /> If you sell later, you get {money(company.sell_price)} per share
                at today&apos;s price. The price has to rise about {breakEvenPct.toFixed(1)}% before selling breaks even.
              </>
            ) : (
              <>
                <strong>Selling fee {feePct}%:</strong> <InfoTip entry="sellFee" /> market price {money(price)} &minus; {feePct}% ={" "}
                {money(company.sell_price)} per share.
                {company.avg_cost > 0 && (
                  <>
                    {" "}
                    You paid {money(company.avg_cost)} on average, so selling now{" "}
                    {company.sell_price >= company.avg_cost ? "is a gain" : "means a loss"} of{" "}
                    {money(Math.abs(company.sell_price - company.avg_cost) * value)} on these shares.
                  </>
                )}
              </>
            )}
          </p>
        )}

        <div className="trade-total" aria-live="polite">
          <div>
            <span>{mode === "buy" ? "You pay" : "You receive"}</span>
            <strong>{money(total)}</strong>
          </div>
          <div>
            <span>Cash after</span>
            <strong>{money(cashAfter)}</strong>
          </div>
        </div>

        {game.modifiers.enable_dividends && company.dividend_per_share > 0 && company.next_dividend_week !== null && (
          <p className="fee-note">
            <strong>Dividend calendar:</strong> {money(company.dividend_per_share)} per share, {everyWeeks(company.dividend_every_weeks)}.
            Next payout {whenWeek(company.next_dividend_week, game.current_week)}
            {company.next_dividend_week === game.current_week ? " (end of this week)" : ""} &mdash;{" "}
            {mode === "buy"
              ? value > 0
                ? `own these ${value} shares then and you get ${money(company.dividend_per_share * value)}.`
                : "only owners on payout day get paid."
              : "if you sell now, you won't get it."}
          </p>
        )}
        {rentWarning && (
          <p className="warning-note" role="alert">
            <strong>Careful:</strong> after this purchase you&apos;d have {money(cashAfter)} in cash
            {savings > 0 ? ` and ${money(savings)} in savings` : ""}, but {money(rent.monthly_rent)} rent is due at the
            end of Week {rent.next_due_week}. Shares are not cash!
          </p>
        )}
        {company.fine_print && (
          <p className="fine-print fine-print--form">
            <strong>Fine print:</strong> {company.fine_print}
          </p>
        )}
        {error && (
          <p className="error-note" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn--red btn--xl btn--block" disabled={value <= 0 || submitting}>
          <span>
            {approved
              ? "Order approved"
              : submitting
                ? "Sending order…"
                : `${verb} ${value} ${company.ticker} for ${money(total)}`}
          </span>
          <span aria-hidden="true">&rarr;</span>
        </button>

        {approved && (
          <span className="stamp stamp--green stamp--drop trade-modal__stamp" role="status">
            Approved
          </span>
        )}
      </form>
    </Modal>
  );
}
