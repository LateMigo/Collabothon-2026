import { money, pct, tone } from "../utils/format.js";

function WeekStepper({ current, total, gameOver }) {
  const weeks = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <ol className="stepper" aria-label="Season progress">
      {weeks.map((week) => {
        const done = week < current || (gameOver && week <= current);
        const active = week === current && !gameOver;
        return (
          <li
            key={week}
            className={`stepper__item ${done ? "is-done" : ""} ${active ? "is-active" : ""}`}
            aria-current={active ? "step" : undefined}
          >
            <span className="stepper__dot">{week}</span>
            <span className="stepper__label">Week</span>
          </li>
        );
      })}
    </ol>
  );
}

function PortfolioMini({ history, total, start }) {
  const W = 260;
  const H = 96;
  const pad = 10;
  const values = history.map((p) => p.net_worth);
  const min = Math.min(...values, start) * 0.98;
  const max = Math.max(...values, start) * 1.02;
  const x = (week) => pad + (week / total) * (W - pad * 2);
  const y = (v) => pad + (1 - (v - min) / (max - min || 1)) * (H - pad * 2);
  const points = history.map((p) => `${x(p.week).toFixed(1)},${y(p.net_worth).toFixed(1)}`).join(" ");
  const last = history[history.length - 1];
  const change = ((last.net_worth - start) / start) * 100;

  return (
    <section className="portfolio-mini" aria-label="Your portfolio">
      <header>
        <h2>Your portfolio</h2>
        <span className={`portfolio-mini__change is-${tone(change)}`}>{pct(change)}</span>
      </header>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Net worth ${money(last.net_worth)}, ${pct(change)} since start`}>
        <line x1={pad} x2={W - pad} y1={y(start)} y2={y(start)} className="portfolio-mini__base" />
        {history.length > 1 ? (
          <polyline points={points} className="portfolio-mini__line" />
        ) : (
          <circle cx={x(0)} cy={y(start)} r="4" className="portfolio-mini__dot" />
        )}
        {history.length > 1 && <circle cx={x(last.week)} cy={y(last.net_worth)} r="4.5" className="portfolio-mini__dot" />}
      </svg>
      <p className="portfolio-mini__value">{money(last.net_worth)}</p>
    </section>
  );
}

export default function ScenarioPanel({ game, children }) {
  const { scenario } = game;
  return (
    <aside className="scenario-panel" aria-label="Scenario">
      <span className="tag-box">Scenario 01</span>
      <p className="eyebrow eyebrow--light">{scenario.tagline}</p>
      <h1 className="scenario-panel__title">{scenario.title}</h1>
      <p className="scenario-panel__desc">{scenario.description}</p>

      <WeekStepper current={game.current_week} total={game.total_weeks} gameOver={game.is_game_over} />
      {scenario.week_theme && !game.is_game_over && (
        <p className="scenario-panel__theme">
          <span>This week:</span> {scenario.week_theme}
        </p>
      )}

      <PortfolioMini history={game.net_worth_history} total={game.total_weeks} start={game.starting_cash} />

      {children}

      <p className="panel-note">Cash you don&apos;t invest stays safe &mdash; and it pays your rent.</p>
    </aside>
  );
}
