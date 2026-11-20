import { money, moneyCompact, pct, plural, tone } from "../utils/format.js";

export function ReadabilityToggle({ enabled, onToggle, variant = "dark" }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      className={`readability-toggle readability-toggle--${variant} ${enabled ? "is-on" : ""}`}
      onClick={onToggle}
    >
      <span className="readability-toggle__icon" aria-hidden="true">
        Aa
      </span>
      <span className="readability-toggle__label">High Readability</span>
      <span className="readability-toggle__track" aria-hidden="true">
        <span className="readability-toggle__thumb" />
      </span>
    </button>
  );
}

function RentIndicator({ rent, cash }) {
  if (!rent.enabled) {
    return (
      <div className="hud-stat hud-rent hud-rent--off">
        <dt>Monthly rent</dt>
        <dd>Living costs off</dd>
      </div>
    );
  }

  const changed = Math.abs(rent.rent_delta) > 0.001;
  const up = rent.rent_delta > 0;
  const dueThisWeek = rent.next_due_week !== null && rent.weeks_until_due === 0;
  const danger = rent.next_due_week !== null && rent.weeks_until_due <= 1 && cash < rent.monthly_rent;

  let dueText;
  if (rent.next_due_week === null) dueText = "No more rent this season";
  else if (dueThisWeek) dueText = "Due at the end of this week!";
  else dueText = `Rent due in ${plural(rent.weeks_until_due, "week")}`;

  const changeNote = changed
    ? `Rent changed in Week ${rent.changed_week} because of news from Week ${rent.change_source_week}.`
    : undefined;

  return (
    <div
      className={`hud-stat hud-rent ${changed ? "hud-rent--changed" : ""} ${dueThisWeek ? "hud-rent--due" : ""} ${
        danger ? "hud-rent--danger" : ""
      }`}
      title={changeNote}
    >
      <dt>Monthly rent</dt>
      <dd>
        <span className="hud-rent__value">Rent: {moneyCompact(rent.monthly_rent)}</span>
        {changed && (
          <span className={`hud-rent__delta ${up ? "is-up" : "is-down"}`}>
            <span aria-hidden="true">{up ? "▲" : "▼"}</span> ({up ? "+" : "−"}
            {moneyCompact(Math.abs(rent.rent_delta))})
          </span>
        )}
      </dd>
      <span className="hud-rent__due">{danger ? `${dueText} Not enough cash!` : dueText}</span>
      {changeNote && <span className="sr-only">{changeNote}</span>}
    </div>
  );
}

export default function HudBar({ game, highReadability, onToggleReadability }) {
  const { current_week: week, total_weeks: total, cash, stocks_value: stocks, net_worth: netWorth } = game;
  const change = ((netWorth - game.starting_cash) / game.starting_cash) * 100;
  const progress = Math.min(100, ((week - (game.is_game_over ? 0 : 1)) / total) * 100);

  return (
    <header className="hud">
      <div className="hud__inner">
        <div className="brand" aria-label="Finance Quest">
          <span>Finance</span> <span className="brand__accent">Quest</span>
        </div>

        <div className="hud-week" aria-label={`Week ${week} of ${total}`}>
          <span className="hud-week__label">Week</span>
          <strong>{week}</strong>
          <span className="hud-week__of">/{total}</span>
        </div>

        <dl className="hud-stats">
          <div className="hud-stat">
            <dt>Cash</dt>
            <dd>{money(cash)}</dd>
          </div>
          <div className="hud-stat">
            <dt>Stocks</dt>
            <dd>{money(stocks)}</dd>
          </div>
          <div className="hud-stat hud-stat--accent">
            <dt>Net worth</dt>
            <dd>
              {money(netWorth)}{" "}
              <span className={`hud-change is-${tone(change)}`} title="Change since the start of the game">
                {pct(change)}
              </span>
            </dd>
          </div>
          <RentIndicator rent={game.rent} cash={cash} />
        </dl>

        <ReadabilityToggle enabled={highReadability} onToggle={onToggleReadability} />
      </div>
      <div className="hud__progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
    </header>
  );
}
