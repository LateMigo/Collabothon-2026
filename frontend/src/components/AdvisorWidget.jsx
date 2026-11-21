import InvestorAvatar from "./InvestorAvatar.jsx";

const ACTION_LABELS = { buy: "Buy", sell: "Sell", hold: "Hold", watch: "Watch" };

export default function AdvisorWidget({ advisor, advice, currentWeek, busy, onAsk }) {
  const hint = advice && advice.week === currentWeek ? advice : null;
  let buttonText = "Ask the advisor";
  if (busy) buttonText = "The advisor is thinking…";
  else if (advisor.uses_left === 0) buttonText = "No hints left";
  else if (advisor.used_this_week)
    buttonText = advisor.next_available_week ? `Next hint: Week ${advisor.next_available_week}` : "No more hints this season";

  return (
    <section className="advisor" aria-labelledby="advisor-title">
      <header className="advisor__head">
        <span className="advisor__icon">
          <InvestorAvatar size={52} />
        </span>
        <div>
          <p className="advisor__channel">Channel 7 &middot; Agent Vorr</p>
          <h2 id="advisor-title">Investment Advisor</h2>
          <p>
            {advisor.uses_left} of {advisor.uses_total} hints left &middot; {advisor.cooldown_weeks > 1 ? `1 every ${advisor.cooldown_weeks} weeks` : "max 1 per week"}
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
          {hint.cause_and_effect?.length > 0 && (
            <div className="advisor__chain">
              <p className="advisor__chain-label">Vorr&apos;s reasoning &mdash; check every step:</p>
              <ol className="cause-chain">
                {hint.cause_and_effect.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}
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
