const ACTION_LABELS = { buy: "Buy", sell: "Sell", hold: "Hold", watch: "Watch" };

function AdvisorIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="advisor__icon">
      <rect x="2" y="2" width="44" height="44" fill="var(--yellow)" stroke="var(--ink)" strokeWidth="3" />
      <circle cx="24" cy="19" r="8" fill="#F1B98D" stroke="var(--ink)" strokeWidth="3" />
      <path d="M10 44 C10 33 16 29 24 29 C32 29 38 33 38 44" fill="var(--blue)" stroke="var(--ink)" strokeWidth="3" />
      <path d="M24 29 L21 34 L24 44 L27 34 Z" fill="var(--red)" stroke="var(--ink)" strokeWidth="2" />
      <rect x="15" y="16" width="7" height="5" fill="none" stroke="var(--ink)" strokeWidth="2" />
      <rect x="26" y="16" width="7" height="5" fill="none" stroke="var(--ink)" strokeWidth="2" />
    </svg>
  );
}

export default function AdvisorWidget({ advisor, advice, currentWeek, busy, onAsk }) {
  const hint = advice && advice.week === currentWeek ? advice : null;
  let buttonText = "Ask the advisor";
  if (busy) buttonText = "The advisor is thinking…";
  else if (advisor.uses_left === 0) buttonText = "No hints left";
  else if (advisor.used_this_week) buttonText = "Next hint: next week";

  return (
    <section className="advisor" aria-labelledby="advisor-title">
      <header className="advisor__head">
        <AdvisorIcon />
        <div>
          <h2 id="advisor-title">Investment Advisor</h2>
          <p>
            {advisor.uses_left} of {advisor.uses_total} hints left &middot; max 1 per week
          </p>
        </div>
      </header>

      <p className="advisor__warning" role="note">
        <span aria-hidden="true">!</span>
        {advisor.disclaimer}
      </p>

      {hint && (
        <blockquote className="advisor__hint" aria-live="polite">
          <p>&ldquo;{hint.hint}&rdquo;</p>
          <footer>
            <span className={`source-badge source-badge--${hint.ai_source}`}>
              {hint.ai_source === "gemini" ? "AI Advisor · Gemini" : "Offline Advisor"}
            </span>
            {hint.focus_company_name && <span>About: {hint.focus_company_name}</span>}
            <span>Suggests: {ACTION_LABELS[hint.suggested_action] ?? hint.suggested_action}</span>
          </footer>
        </blockquote>
      )}

      <button type="button" className="btn btn--yellow btn--block" onClick={onAsk} disabled={!advisor.can_use || busy}>
        {buttonText}
      </button>
      <p className="advisor__odds">Roughly {Math.round(advisor.accuracy_percent / 10)} in 10 hints turn out right.</p>
    </section>
  );
}
