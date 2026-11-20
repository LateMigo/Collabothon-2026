import { useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import { clamp, money, plural } from "../utils/format.js";

const QUICK_SHARES = [0.25, 0.5, 0.75, 1];

export default function TradeModal({ company, game, onClose, onTrade }) {
  const canBuy = company.max_affordable > 0;
  const [mode, setMode] = useState(!canBuy && company.shares_owned > 0 ? "sell" : "buy");
  const [shares, setShares] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [approved, setApproved] = useState(false);
  const closeTimer = useRef(null);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const price = company.price;
  // Auto-clamping: buy <= floor(cash / price), sell <= shares owned, never below 0.
  const max = mode === "buy" ? Math.max(0, Math.floor((game.cash + 1e-9) / price)) : company.shares_owned;
  const value = clamp(shares, 0, max);
  const total = value * price;
  const cashAfter = mode === "buy" ? game.cash - total : game.cash + total;

  const rent = game.rent;
  const rentWarning =
    mode === "buy" &&
    value > 0 &&
    rent.enabled &&
    rent.next_due_week !== null &&
    cashAfter < rent.monthly_rent;

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
      await onTrade(company.id, mode, value);
      // Let the "Approved" stamp land on the form before the window closes.
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
            <dt>Price per share</dt>
            <dd>{money(price)}</dd>
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
          <div className="quick-picks" role="group" aria-label="Quick amounts">
            {QUICK_SHARES.map((share) => {
              const amount = Math.floor(max * share);
              return (
                <button
                  key={share}
                  type="button"
                  className={value === amount && amount > 0 ? "is-active" : ""}
                  onClick={() => setShares(amount)}
                  disabled={max === 0}
                >
                  {share * 100}%
                </button>
              );
            })}
            <button type="button" className="quick-picks__max" onClick={() => setShares(max)} disabled={max === 0}>
              Max
            </button>
          </div>
        </div>

        <p id="trade-hint" className="trade-hint">
          {max === 0
            ? mode === "buy"
              ? "You don't have enough cash for even one share."
              : "You don't own any shares of this company yet."
            : `Numbers above ${max} are adjusted automatically.`}
        </p>

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

        {rentWarning && (
          <p className="warning-note" role="alert">
            <strong>Careful:</strong> after this purchase you&apos;d have {money(cashAfter)} in cash, but{" "}
            {money(rent.monthly_rent)} rent is due at the end of Week {rent.next_due_week}. Shares are not cash!
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
