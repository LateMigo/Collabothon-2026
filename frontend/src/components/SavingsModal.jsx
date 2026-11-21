import { useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import { clamp, money, ratePct } from "../utils/format.js";

const round2 = (value) => Math.round(value * 100) / 100;

/** Form S-2: move money between cash and the savings account. */
export default function SavingsModal({ game, initialMode, onClose, onSubmit }) {
  const [mode, setMode] = useState(initialMode);
  const [amountText, setAmountText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [approved, setApproved] = useState(false);
  const closeTimer = useRef(null);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const s = game.savings;
  const rent = game.rent;
  const max = round2(mode === "deposit" ? game.cash : s.balance);
  const parsed = parseFloat(amountText);
  const value = clamp(round2(Number.isFinite(parsed) ? parsed : 0), 0, max);
  const cashAfter = round2(mode === "deposit" ? game.cash - value : game.cash + value);
  const savingsAfter = round2(mode === "deposit" ? s.balance + value : s.balance - value);
  const interestPreview = round2((savingsAfter * s.weekly_rate_pct) / 100);
  const rentDue = rent.enabled && rent.next_due_week !== null;
  const rentCovered = cashAfter + savingsAfter >= rent.monthly_rent;

  const switchMode = (next) => {
    setMode(next);
    setAmountText("");
    setError(null);
  };

  const setAmount = (amount) => {
    setAmountText(clamp(round2(amount), 0, max).toFixed(2));
    setError(null);
  };

  const onInput = (event) => {
    // digits and one decimal point with up to 2 decimals; anything above the maximum is adjusted
    let text = event.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
    const [whole, ...rest] = text.split(".");
    text = rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
    const number = parseFloat(text);
    setAmountText(Number.isFinite(number) && number > max ? max.toFixed(2) : text);
    setError(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (value <= 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(mode, value);
      setApproved(true);
      closeTimer.current = setTimeout(onClose, 900);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const quick =
    mode === "deposit"
      ? [
          { label: "Next rent", amount: Math.min(rent.monthly_rent, max), hidden: !rentDue },
          { label: "Half my cash", amount: max / 2 },
          { label: "All my cash", amount: max },
        ]
      : [
          { label: "Next rent", amount: Math.min(rent.monthly_rent, max), hidden: !rentDue },
          { label: "Half", amount: max / 2 },
          { label: "Everything", amount: max },
        ];

  return (
    <Modal labelledBy="savings-title" onClose={onClose} className="trade-modal savings-modal">
      <form onSubmit={submit}>
        <header className="trade-modal__head">
          <span className="vault__seal" aria-hidden="true">
            Safe
          </span>
          <div>
            <p className="eyebrow">Form S-2 &middot; Savings transfer &middot; {ratePct(s.weekly_rate_pct)} a week</p>
            <h2 id="savings-title" className="trade-modal__title">
              {s.account_name}
            </h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </header>

        <div className="segmented segmented--large" role="tablist" aria-label="Transfer type">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "deposit"}
            aria-pressed={mode === "deposit"}
            onClick={() => switchMode("deposit")}
          >
            Deposit
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "withdraw"}
            aria-pressed={mode === "withdraw"}
            onClick={() => switchMode("withdraw")}
          >
            Withdraw
          </button>
        </div>

        <dl className="trade-facts">
          <div>
            <dt>Your cash</dt>
            <dd>{money(game.cash)}</dd>
          </div>
          <div>
            <dt>In savings</dt>
            <dd>{money(s.balance)}</dd>
          </div>
          <div>
            <dt>Interest</dt>
            <dd>{ratePct(s.weekly_rate_pct)} / week</dd>
          </div>
        </dl>

        <div className="amount-bar">
          <label htmlFor="savings-amount" className="amount-bar__label">
            How much?
            <small>{mode === "deposit" ? `You can move up to ${money(max)}` : `You can take out up to ${money(max)}`}</small>
          </label>
          <div className="money-input">
            <span aria-hidden="true">$</span>
            <input
              id="savings-amount"
              data-autofocus
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={amountText}
              onChange={onInput}
              onFocus={(e) => e.target.select()}
              aria-describedby="savings-hint"
            />
          </div>
          <div className="quick-amounts" role="group" aria-label="Quick amounts">
            {quick
              .filter((q) => !q.hidden)
              .map((q) => (
                <button key={q.label} type="button" className="btn btn--ghost btn--sm" onClick={() => setAmount(q.amount)} disabled={max <= 0}>
                  {q.label}
                </button>
              ))}
          </div>
        </div>

        <p id="savings-hint" className="trade-hint">
          {max <= 0
            ? mode === "deposit"
              ? "You have no cash to move right now."
              : "Your savings account is empty."
            : "No fees and no risk: money in savings can't lose value."}
        </p>

        <div className="trade-total" aria-live="polite">
          <div>
            <span>Cash after</span>
            <strong>{money(cashAfter)}</strong>
          </div>
          <div>
            <span>Savings after</span>
            <strong>{money(savingsAfter)}</strong>
          </div>
        </div>

        <p className="fee-note">
          At {ratePct(s.weekly_rate_pct)} a week, {money(savingsAfter)} in savings pays you about{" "}
          <strong>{money(interestPreview)}</strong> at the end of this week.
          {rentDue && (
            <>
              {" "}
              Next rent: {money(rent.monthly_rent)} at the end of Week {rent.next_due_week} &mdash;{" "}
              {rentCovered ? "covered by your cash and savings." : <strong>not covered yet!</strong>}
            </>
          )}
        </p>

        {error && (
          <p className="error-note" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn--red btn--xl btn--block" disabled={value <= 0 || submitting}>
          <span>
            {approved
              ? "Transfer approved"
              : submitting
                ? "Sending…"
                : mode === "deposit"
                  ? `Deposit ${money(value)}`
                  : `Withdraw ${money(value)}`}
          </span>
          <span aria-hidden="true">&rarr;</span>
        </button>

        {approved && (
          <span className="stamp stamp--green stamp--drop trade-modal__stamp" role="status">
            {mode === "deposit" ? "Deposited" : "Withdrawn"}
          </span>
        )}
      </form>
    </Modal>
  );
}
