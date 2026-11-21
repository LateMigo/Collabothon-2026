import InvestorAvatar from "./InvestorAvatar.jsx";

const ACTION_LABELS = { buy: "Buy", sell: "Sell", hold: "Hold", watch: "Watch" };

export default function AdvisorWidget({ advisor, advice, currentWeek, busy, onAsk }) {
  const hint = advice && advice.week === currentWeek ? advice : null;
  let buttonText = "Ask the advisor";
  if (busy) buttonText = "The advisor is thinking…";
  else if (advisor.uses_left === 0) buttonText = "No hints left";
  else if (advisor.used_this_week) buttonText = "Next hint: next week";

  return (
    <section className="advisor" aria-labelledby="advisor-title">
      <header className="advisor__head">
        <span className="advisor__icon">
          <InvestorAvatar size={52} />
        </span>
        <div>
          <p className="advisor__channel">Channel 7 &middot; Agent Gloop</p>
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
