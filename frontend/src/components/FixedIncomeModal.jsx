import { useEffect, useRef, useState } from "react";
import Modal from "./Modal.jsx";
import { clamp, money, moneyCompact, plural, ratePct, RISK_LABELS } from "../utils/format.js";

const round2 = (value) => Math.round(value * 100) / 100;

const STATUS_LABELS = {
  matured: "Paid back",
  closed_early: "Cashed out early",
  defaulted: "Defaulted",
};

/** How safe the money is: bank and government can't default, a company can. */
function safety(offer) {
  if (offer.kind === "deposit") return { label: "Bank deposit · no risk", tone: "safe" };
  if (!offer.issuer_company_id) return { label: "Government · no default risk", tone: "safe" };
  if (offer.issuer_bankrupt) return { label: "Issuer bankrupt", tone: "critical" };
  const level = offer.issuer_risk_level ?? "low";
  return {
    label: `Company · ${RISK_LABELS[level]} risk ${Math.round((offer.issuer_risk ?? 0) * 100)}%`,
    tone: level,
  };
}

function OfferCard({ offer, selected, onSelect }) {
  const s = safety(offer);
  return (
    <li>
      <button
        type="button"
        className={`bond-offer ${selected ? "is-selected" : ""} ${offer.available ? "" : "is-closed"}`}
        aria-pressed={selected}
        onClick={() => onSelect(offer.id)}
      >
        <span className="bond-offer__top">
          <span className="bond-offer__name">{offer.name}</span>
          <span className="bond-offer__rate">
            {ratePct(offer.weekly_rate_pct)}
            <small>/ week</small>
          </span>
        </span>
        <span className="bond-offer__issuer">{offer.issuer}</span>
        <span className={`bond-offer__safety bond-offer__safety--${s.tone}`}>{s.label}</span>
        <span className="bond-offer__facts">
          {offer.available ? (
            <>
              Pays back end of <b>Week {offer.maturity_week}</b> &middot; +{offer.total_return_pct}% in{" "}
              {plural(offer.weeks_held, "week")}
            </>
          ) : (
            offer.unavailable_reason
          )}
        </span>
      </button>
    </li>
  );
}

function OrderForm({ offer, game, onSubmit }) {
  const [amountText, setAmountText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const max = round2(game.cash);
  const parsed = parseFloat(amountText);
  const value = clamp(round2(Number.isFinite(parsed) ? parsed : 0), 0, max);
  const interest = round2(value * (offer.weekly_rate_pct / 100) * offer.weeks_held);
  const rent = game.rent;
  const rentBeforeMaturity =
    rent.enabled && rent.next_due_week !== null && rent.next_due_week < offer.maturity_week ? rent.next_due_week : null;
  const cashAfter = round2(game.cash - value);
  const rentRisk = rentBeforeMaturity !== null && cashAfter + game.savings.balance < rent.monthly_rent;
  const keepForRent = rentBeforeMaturity !== null ? Math.max(0, max - Math.max(0, rent.monthly_rent - game.savings.balance)) : null;
  const tooSmall = value > 0 && value < offer.min_amount;

  const onInput = (event) => {
    let text = event.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
    const [whole, ...rest] = text.split(".");
    text = rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
    const number = parseFloat(text);
    setAmountText(Number.isFinite(number) && number > max ? max.toFixed(2) : text);
    setError(null);
  };

  const setAmount = (amount) => {
    setAmountText(clamp(round2(amount), 0, max).toFixed(2));
    setError(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (value <= 0 || tooSmall || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ action: "buy", product_id: offer.id, amount: value });
      setDone(true);
      setAmountText("");
      timer.current = setTimeout(() => setDone(false), 1400);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const quick = [
    { label: `Minimum ${moneyCompact(offer.min_amount)}`, amount: offer.min_amount },
    { label: "Keep the rent", amount: keepForRent ?? 0, hidden: keepForRent === null || keepForRent < offer.min_amount },
    { label: "Half my cash", amount: max / 2 },
    { label: "All my cash", amount: max },
  ];

  return (
    <form className="bond-order" onSubmit={submit}>
      <p className="bond-order__desc">{offer.description}</p>
      <dl className="trade-facts bond-order__facts">
        <div>
          <dt>Pays back</dt>
          <dd>End of Week {offer.maturity_week}</dd>
        </div>
        <div>
          <dt>Leave early</dt>
          <dd>
            {offer.early_exit_fee_pct > 0 ? `${offer.early_exit_fee_pct}% fee + ` : ""}
            lose the interest
          </dd>
        </div>
        <div>
          <dt>{offer.issuer_company_id ? "If it goes bankrupt" : "Default risk"}</dt>
          <dd>{offer.issuer_company_id ? `you get ${offer.recovery_pct}% back` : "none"}</dd>
        </div>
      </dl>

      <div className="amount-bar">
        <label htmlFor="bond-amount" className="amount-bar__label">
          How much do you lend?
          <small>
            Minimum {money(offer.min_amount)} &middot; your cash {money(max)}
          </small>
        </label>
        <div className="money-input">
          <span aria-hidden="true">$</span>
          <input
            id="bond-amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={amountText}
            onChange={onInput}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div className="quick-amounts" role="group" aria-label="Quick amounts">
          {quick
            .filter((q) => !q.hidden)
            .map((q) => (
              <button
                key={q.label}
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setAmount(q.amount)}
                disabled={max < offer.min_amount}
              >
                {q.label}
              </button>
            ))}
        </div>
      </div>

      <p className="fee-note" aria-live="polite">
        {value > 0 ? (
          <>
            You lend <strong>{money(value)}</strong> and get back <strong>{money(value + interest)}</strong> at the end of
            Week {offer.maturity_week} ({money(interest)} interest).
          </>
        ) : (
          <>Type an amount to see what you get back.</>
        )}
        {tooSmall && <strong> The minimum is {money(offer.min_amount)}.</strong>}
      </p>
      {rentRisk && value > 0 && (
        <p className="error-note" role="alert">
          Careful: {moneyCompact(rent.monthly_rent)} rent is due at the end of Week {rentBeforeMaturity}, but this money
          stays locked until Week {offer.maturity_week}. Keep enough cash or savings for the rent!
        </p>
      )}
      {error && (
        <p className="error-note" role="alert">
          {error}
        </p>
      )}

      <button type="submit" className="btn btn--red btn--xl btn--block" disabled={value <= 0 || tooSmall || submitting}>
        <span>
          {done
            ? "Signed!"
            : submitting
              ? "Signing…"
              : offer.kind === "deposit"
                ? `Open the deposit · ${money(value)}`
                : `Buy the bond · ${money(value)}`}
        </span>
        <span aria-hidden="true">&rarr;</span>
      </button>
    </form>
  );
}

function HoldingRow({ holding, currentWeek, onSubmit }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const active = holding.status === "active";
  const total = holding.maturity_week - holding.opened_week + 1;
  const done = Math.min(total, currentWeek - holding.opened_week);
  const lost = round2(holding.value - holding.early_exit_value);

  const cashOut = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ action: "close", holding_id: holding.holding_id });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <li className={`bond-holding bond-holding--${holding.status}`}>
      <div className="bond-holding__head">
        <b>{holding.name}</b>
        <span>
          {active
            ? holding.weeks_left === 0
              ? "pays back at the end of this week"
              : `pays back in Week ${holding.maturity_week}`
            : `${STATUS_LABELS[holding.status]} · Week ${holding.closed_week}`}
        </span>
      </div>
      {active ? (
        <>
          <div className="bond-holding__bar" aria-hidden="true">
            <span style={{ width: `${(done / total) * 100}%` }} />
          </div>
          <dl className="bond-holding__facts">
            <div>
              <dt>Lent</dt>
              <dd>{money(holding.principal)}</dd>
            </div>
            <div>
              <dt>Interest so far</dt>
              <dd className="is-up">+{money(holding.accrued_interest)}</dd>
            </div>
            <div>
              <dt>At maturity</dt>
              <dd>{money(holding.payout_at_maturity)}</dd>
            </div>
          </dl>
          {holding.weeks_left > 0 &&
            (confirming ? (
              <div className="bond-holding__confirm" role="alert">
                <p>
                  Cash out now: you get <b>{money(holding.early_exit_value)}</b> back and lose {money(lost)} (fee and
                  interest). Wait until Week {holding.maturity_week} to get {money(holding.payout_at_maturity)}.
                </p>
                <div>
                  <button type="button" className="btn btn--red btn--sm" onClick={cashOut} disabled={busy}>
                    {busy ? "Cashing out…" : "Yes, cash out"}
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirming(false)}>
                    Keep it
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirming(true)}>
                Cash out early &middot; {money(holding.early_exit_value)}
              </button>
            ))}
          {error && (
            <p className="error-note" role="alert">
              {error}
            </p>
          )}
        </>
      ) : (
        <p className="bond-holding__result">
          Lent {money(holding.principal)} &rarr; got back {money(holding.payout)}
        </p>
      )}
    </li>
  );
}

/** Form B-3: the bond desk. Bank term deposits and bonds, each with its own rate, date and risk. */
export default function FixedIncomeModal({ game, onClose, onSubmit }) {
  const fi = game.fixed_income;
  const activeCount = fi.holdings.filter((h) => h.status === "active").length;
  const [tab, setTab] = useState(activeCount > 0 ? "yours" : "deposit");
  const offers = fi.offers.filter((o) => o.kind === tab);
  const firstOpen = (kind) => fi.offers.find((o) => o.kind === kind && o.available)?.id ?? null;
  const [selected, setSelected] = useState(() => ({ deposit: firstOpen("deposit"), bond: firstOpen("bond") }));
  const current = offers.find((o) => o.id === selected[tab]) ?? null;

  return (
    <Modal labelledBy="bond-title" onClose={onClose} className="trade-modal bond-modal">
      <header className="trade-modal__head">
        <span className="vault__seal bond-desk__seal" aria-hidden="true">
          Bond
        </span>
        <div>
          <p className="eyebrow">Form B-3 &middot; Bond desk &middot; Week {game.current_week}</p>
          <h2 id="bond-title" className="trade-modal__title">
            Bonds &amp; Term Deposits
          </h2>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          &times;
        </button>
      </header>

      <p className="bond-modal__intro">
        Lend your money for a fixed time and earn a fixed interest every week. The longer and the riskier the loan, the
        higher the rate &mdash; but the money is locked until it pays back.
      </p>

      <div className="segmented segmented--large bond-modal__tabs" role="tablist" aria-label="Bond desk sections">
        {[
          ["deposit", "Bank deposits"],
          ["bond", "Bonds"],
          ["yours", `Yours (${activeCount})`],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "yours" ? (
        fi.holdings.length === 0 ? (
          <p className="bond-modal__empty">
            You haven&apos;t lent any money yet. Compare the bank deposits and bonds &mdash; and keep the rent dates in
            mind.
          </p>
        ) : (
          <ul className="bond-holdings">
            {[...fi.holdings]
              // active ones first (soonest pay-back on top), then the closed history
              .sort((a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1) || a.maturity_week - b.maturity_week)
              .map((h) => (
                <HoldingRow key={h.holding_id} holding={h} currentWeek={game.current_week} onSubmit={onSubmit} />
              ))}
          </ul>
        )
      ) : (
        <>
          <ul className="bond-offers">
            {offers.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                selected={offer.id === selected[tab]}
                onSelect={(id) => setSelected((prev) => ({ ...prev, [tab]: id }))}
              />
            ))}
          </ul>
          {current && current.available ? (
            <OrderForm key={current.id} offer={current} game={game} onSubmit={onSubmit} />
          ) : (
            <p className="bond-modal__empty">
              {current ? current.unavailable_reason : "Pick an offer to see the details."}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
