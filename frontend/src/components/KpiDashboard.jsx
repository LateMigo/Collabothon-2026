import { useEffect, useState } from "react";
import { api } from "../api/client.js";

const OFFER_NAMES = {
  savings: "Savings account",
  savings_plan: "Fund savings plan",
  current_account: "Current account + app",
  standing_order: "Automatic savings transfer",
  advisor: "Advisor meeting",
};

export default function KpiDashboard({ onExit }) {
  const [kpi, setKpi] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .kpi()
        .then((data) => {
          if (alive) {
            setKpi(data);
            setError(null);
          }
        })
        .catch((err) => alive && setError(err.message));
    load();
    const timer = window.setInterval(load, 4000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const top = kpi?.steps[0]?.value || 0;

  return (
    <main className="kpi">
      <header className="kpi__head">
        <div>
          <p className="kpi__kicker">Commerzbank view &middot; live demo data</p>
          <h1>CosmiCash &rarr; Commerzbank funnel</h1>
          <p className="kpi__sub">
            How a game about money turns into new, engaged bank customers. Updates every 4 seconds
            {kpi ? ` · collecting for ${kpi.since_minutes} min` : ""}.
          </p>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onExit}>
          Back to the game
        </button>
      </header>

      {error && <p className="error-note">Can&apos;t reach the server: {error}</p>}

      {kpi && (
        <>
          <section className="kpi__funnel" aria-label="Funnel">
            {kpi.steps.map((step, i) => (
              <div key={step.label} className="kpi__step">
                <div className="kpi__bar" style={{ "--w": `${top ? Math.max(4, (step.value / top) * 100) : 4}%` }}>
                  <span className="kpi__value">{step.value}</span>
                </div>
                <p className="kpi__label">
                  {i + 1}. {step.label}
                  <b>{step.pct_of_start}%</b>
                </p>
              </div>
            ))}
          </section>

          <section className="kpi__tiles" aria-label="Engagement and learning">
            <div className="kpi__tile">
              <span>Offer click-through</span>
              <b>{kpi.offer_ctr_pct}%</b>
              <small>of players who saw the Commerzbank next steps</small>
            </div>
            <div className="kpi__tile">
              <span>Weeks played</span>
              <b>{kpi.weeks_played}</b>
              <small>{kpi.avg_weeks_per_player} per player on average</small>
            </div>
            <div className="kpi__tile">
              <span>Quiz answers</span>
              <b>{kpi.quiz_answers}</b>
              <small>{kpi.quiz_correct_pct}% correct</small>
            </div>
            <div className="kpi__tile">
              <span>Lessons completed</span>
              <b>{kpi.lessons_completed}</b>
              <small>one-minute money basics</small>
            </div>
            <div className="kpi__tile">
              <span>Questions to Berg</span>
              <b>{kpi.glossary_questions}</b>
              <small>money words explained by AI</small>
            </div>
            <div className="kpi__tile">
              <span>Friends challenged</span>
              <b>{kpi.challenges_shared}</b>
              <small>{kpi.challenges_joined} joined through a link</small>
            </div>
          </section>

          <section className="kpi__offers" aria-label="Clicks per offer">
            <h2>Clicks per Commerzbank offer</h2>
            {Object.keys(kpi.offer_clicks).length === 0 ? (
              <p className="kpi__empty">No clicks yet - finish a season and open one of the next steps.</p>
            ) : (
              <ul>
                {Object.entries(kpi.offer_clicks).map(([id, count]) => (
                  <li key={id}>
                    <span>{OFFER_NAMES[id] ?? id}</span>
                    <b>{count}</b>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="kpi__model" aria-label="Business model">
            <h2>Why it pays off for Commerzbank</h2>
            <ol>
              <li>
                <b>Acquisition:</b> a free game reaches beginners before they choose a bank; challenge links bring
                friends at no cost.
              </li>
              <li>
                <b>Conversion:</b> every season ends with three personal next steps - savings account, fund savings
                plan, current account, advisor meeting.
              </li>
              <li>
                <b>Relationship:</b> players learn saving and investing with Commerzbank Savings as the &ldquo;safe
                harbour&rdquo; - trust built before the first real euro.
              </li>
              <li>
                <b>Measurable:</b> season completion, quiz scores and offer clicks show exactly what works.
              </li>
            </ol>
          </section>
        </>
      )}
    </main>
  );
}
