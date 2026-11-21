import { useState } from "react";
import { api } from "../api/client.js";
import { useAiPrefs } from "../utils/aiPrefs.js";
import SpeakButton from "./SpeakButton.jsx";

const CURRENCIES = [
  { id: "EUR", label: "€ EUR" },
  { id: "PLN", label: "zł PLN" },
  { id: "USD", label: "$ USD" },
];
const FIELDS = [
  { id: "income", label: "Monthly income (after tax)" },
  { id: "housing", label: "Rent / housing" },
  { id: "food", label: "Food" },
  { id: "other", label: "Everything else" },
  { id: "savings_now", label: "Savings you already have" },
];

function fmt(value, currency) {
  const amount = Math.round(Math.abs(value)).toLocaleString("en-US");
  const sign = value < 0 ? "−" : "";
  return currency === "PLN" ? `${sign}${amount} zł` : currency === "USD" ? `${sign}$${amount}` : `${sign}€${amount}`;
}

export default function BudgetPlanner({ sessionId }) {
  const prefs = useAiPrefs();
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState("EUR");
  const [values, setValues] = useState({ income: "", housing: "", food: "", other: "", savings_now: "" });
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const ready = Number(values.income) > 0;

  const submit = async (event) => {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Math.max(0, Number(v) || 0)]));
      setPlan(await api.budgetPlan({ ...body, currency, level: prefs.level, language: prefs.language }));
      api.kpiEvent({ event: "budget_plan", session_id: sessionId });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <section className="paper-card budget budget--closed" aria-labelledby="budget-title">
        <div>
          <p className="eyebrow">Now with your real money</p>
          <h2 id="budget-title" className="section-title">
            Plan your real budget with Berg
          </h2>
          <p className="budget__intro">
            Enter 4 numbers and Berg turns this season&apos;s lessons into a plan for next month: what to save, how big
            your safety cushion should be, and when you&apos;ll get there. Your numbers are not stored.
          </p>
        </div>
        <button type="button" className="btn btn--yellow" onClick={() => setOpen(true)}>
          Start my plan &rarr;
        </button>
      </section>
    );
  }

  const n = plan?.numbers;
  return (
    <section className="paper-card budget" aria-labelledby="budget-title">
      <p className="eyebrow">Now with your real money &middot; nothing is stored</p>
      <h2 id="budget-title" className="section-title">
        Plan your real budget with Berg
      </h2>
      <form className="budget__form" onSubmit={submit}>
        <div className="budget__currency" role="group" aria-label="Currency">
          {CURRENCIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={currency === c.id ? "is-on" : ""}
              aria-pressed={currency === c.id}
              onClick={() => setCurrency(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="budget__fields">
          {FIELDS.map((f) => (
            <label key={f.id}>
              <span>{f.label}</span>
              <input
                type="number"
                min="0"
                inputMode="decimal"
                value={values[f.id]}
                placeholder={f.id === "savings_now" ? "0" : ""}
                onChange={(event) => setValues((v) => ({ ...v, [f.id]: event.target.value }))}
              />
            </label>
          ))}
        </div>
        <button type="submit" className="btn btn--red" disabled={!ready || busy}>
          {busy ? "Berg is thinking…" : plan ? "Update my plan" : "Make my plan"}
        </button>
      </form>
      {error && <p className="error-note">{error}</p>}

      {plan && (
        <article className="budget__plan" aria-live="polite">
          <dl className="budget__numbers">
            <div>
              <dt>Left each month</dt>
              <dd className={n.left_over < 0 ? "is-down" : "is-up"}>{fmt(n.left_over, n.currency)}</dd>
            </div>
            <div>
              <dt>Save every month</dt>
              <dd>{fmt(n.suggested_monthly_saving, n.currency)}</dd>
            </div>
            <div>
              <dt>Safety cushion goal</dt>
              <dd>{fmt(n.emergency_fund_target, n.currency)}</dd>
              <small>3 months of rent + food</small>
            </div>
            <div>
              <dt>Cushion ready in</dt>
              <dd>
                {n.months_to_emergency_fund === null
                  ? "—"
                  : n.months_to_emergency_fund === 0
                    ? "Done!"
                    : `${n.months_to_emergency_fund} mo.`}
              </dd>
            </div>
          </dl>
          <p>{plan.summary}</p>
          <ol className="budget__steps">
            {plan.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="budget__bank">
            <b>First step with your bank:</b> {plan.bank_step}
          </p>
          <footer>
            <span className={`source-badge source-badge--${plan.ai_source}`}>
              {plan.ai_source === "gemini" ? "Berg · Gemini" : "Berg · offline"}
            </span>
            <SpeakButton text={`${plan.summary} ${plan.steps.join(". ")}. ${plan.bank_step}`} />
            <small>{plan.disclaimer}</small>
          </footer>
        </article>
      )}
    </section>
  );
}
