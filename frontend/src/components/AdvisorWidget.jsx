const ACTION_LABELS = { buy: "Buy", sell: "Sell", hold: "Hold", watch: "Watch" };

/** Agent Gloop: a three-eyed alien on a crackly video channel, drawn on purpose like a 5-minute doodle. */
function AdvisorIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="advisor__icon">
      <defs>
        <filter id="advisor-wobble">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="2.5" />
        </filter>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="6" fill="#1b2a52" stroke="#111" strokeWidth="3" />
      <g className="crude" filter="url(#advisor-wobble)">
        <path d="M33 20 L27 8" stroke="#111" strokeWidth="3" />
        <circle cx="26" cy="7" r="3.5" fill="var(--magenta)" stroke="#111" strokeWidth="2" />
        <ellipse cx="32" cy="35" rx="18" ry="15" fill="var(--alien)" stroke="#111" strokeWidth="3" />
        <circle cx="23" cy="32" r="4.5" fill="#fff" stroke="#111" strokeWidth="2" />
        <circle cx="32" cy="28" r="5" fill="#fff" stroke="#111" strokeWidth="2" />
        <circle cx="41" cy="32" r="4" fill="#fff" stroke="#111" strokeWidth="2" />
        <circle cx="24.5" cy="33" r="1.8" fill="#111" />
        <circle cx="33.5" cy="29" r="2" fill="#111" />
        <circle cx="42" cy="33" r="1.6" fill="#111" />
        <path d="M24 42 Q31 47 41 40" fill="none" stroke="#111" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M30 50 L35 50 L36 61 L32 63 L29 61 Z" fill="var(--stamp-red)" stroke="#111" strokeWidth="2" />
      </g>
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
