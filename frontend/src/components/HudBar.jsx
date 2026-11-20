import { useEffect, useState } from "react";
import { money, moneyCompact, pct, plural, readStorage, tone, writeStorage } from "../utils/format.js";

const COLLAPSED_KEY = "fq.hudCollapsed";

export function ReadabilityToggle({ enabled, onToggle, variant = "dark" }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="High Readability"
      className={`readability-toggle readability-toggle--${variant} ${enabled ? "is-on" : ""}`}
      onClick={onToggle}
    >
      <span className="readability-toggle__icon" aria-hidden="true">
        Aa
      </span>
      <span className="readability-toggle__label" aria-hidden="true">
        High Readability
      </span>
      <span className="readability-toggle__track" aria-hidden="true">
        <span className="readability-toggle__thumb" />
      </span>
    </button>
  );
}

/** Crude little planet - the exchange's "official" emblem. */
function BrandMark() {
  return (
    <svg className="brand__mark" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="21" r="12" fill="var(--magenta)" stroke="#111" strokeWidth="2.5" />
      <circle cx="15" cy="17" r="2.6" fill="#b8329f" />
      <circle cx="24" cy="26" r="2" fill="#b8329f" />
      <path d="M3 27 C 8 17, 33 11, 38 15" fill="none" stroke="#111" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M3 27 C 8 17, 33 11, 38 15" fill="none" stroke="var(--alien)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Shared rent logic for the full readout and the collapsed strip. */
function rentStatus(rent, cash) {
  const changed = Math.abs(rent.rent_delta) > 0.001;
  const up = rent.rent_delta > 0;
  const dueThisWeek = rent.next_due_week !== null && rent.weeks_until_due === 0;
  const danger = rent.next_due_week !== null && rent.weeks_until_due <= 1 && cash < rent.monthly_rent;
  let dueText;
  if (rent.next_due_week === null) dueText = "No more rent this season";
  else if (dueThisWeek) dueText = "Due at the end of this week!";
  else dueText = `Rent due in ${plural(rent.weeks_until_due, "week")}`;
  const delta = changed ? `(${up ? "+" : "−"}${moneyCompact(Math.abs(rent.rent_delta))})` : null;
  return { changed, up, dueThisWeek, danger, dueText, delta };
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

  const status = rentStatus(rent, cash);
  const changeNote = status.changed
    ? `Rent changed in Week ${rent.changed_week} because of news from Week ${rent.change_source_week}.`
    : undefined;

  return (
    <div
      className={`hud-stat hud-rent ${status.changed ? "hud-rent--changed" : ""} ${
        status.dueThisWeek ? "hud-rent--due" : ""
      } ${status.danger ? "hud-rent--danger" : ""}`}
      title={changeNote}
    >
      <dt>Monthly rent</dt>
      <dd>
        <span className="hud-rent__value">Rent: {moneyCompact(rent.monthly_rent)}</span>
        {status.changed && (
          <span className={`hud-rent__delta ${status.up ? "is-up" : "is-down"}`}>
            <span aria-hidden="true">{status.up ? "▲" : "▼"}</span> {status.delta}
          </span>
        )}
      </dd>
      <span className="hud-rent__due">{status.danger ? `${status.dueText} Not enough cash!` : status.dueText}</span>
      {changeNote && <span className="sr-only">{changeNote}</span>}
    </div>
  );
}

/** One-line summary shown while the panel is collapsed. */
function CompactReadout({ game, change }) {
  const { rent, cash } = game;
  const status = rent.enabled ? rentStatus(rent, cash) : null;
  return (
    <p className="hud-compact">
      <span>
        <b>Cash</b> {money(cash)}
      </span>
      <span>
        <b>Net worth</b> {money(game.net_worth)} <span className={`is-${tone(change)}`}>{pct(change)}</span>
      </span>
      {status ? (
        <span className={`hud-compact__rent ${status.danger ? "is-danger" : ""} ${status.changed ? "is-changed" : ""}`}>
          <b>Rent</b> {moneyCompact(rent.monthly_rent)}
          {status.changed && ` ${status.up ? "▲" : "▼"} ${status.delta}`} &middot;{" "}
          {status.danger ? `${status.dueText} Not enough cash!` : status.dueText}
        </span>
      ) : (
        <span>
          <b>Rent</b> off
        </span>
      )}
    </p>
  );
}

export default function HudBar({ game, highReadability, onToggleReadability }) {
  const [collapsed, setCollapsed] = useState(() => readStorage("localStorage", COLLAPSED_KEY) === "1");
  const { current_week: week, total_weeks: total, cash, stocks_value: stocks, net_worth: netWorth } = game;
  const change = ((netWorth - game.starting_cash) / game.starting_cash) * 100;
  const progress = Math.min(100, ((week - (game.is_game_over ? 0 : 1)) / total) * 100);

  useEffect(() => {
    writeStorage("localStorage", COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <header className={`hud ${collapsed ? "is-collapsed" : ""}`}>
      <div className="hud__inner">
        <div className="brand" aria-label="Finance Quest">
          <BrandMark />
          <span className="brand__text">
            <span>Finance</span> <span className="brand__accent">Quest</span>
            <small>Galactic Exchange &middot; Booth 7</small>
          </span>
        </div>

        <div className="hud-week" aria-label={`Week ${week} of ${total}`}>
          <span className="hud-week__label">Week</span>
          <strong>{week}</strong>
          <span className="hud-week__of">/{total}</span>
        </div>

        {collapsed && <CompactReadout game={game} change={change} />}

        <dl id="hud-details" className="hud-stats" hidden={collapsed}>
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

        <div className="hud__controls">
          <ReadabilityToggle enabled={highReadability} onToggle={onToggleReadability} />
          <button
            type="button"
            className="hud__collapse"
            aria-expanded={!collapsed}
            aria-controls="hud-details"
            aria-label={collapsed ? "Show top panel" : "Hide top panel"}
            title={collapsed ? "Show top panel" : "Hide top panel"}
            onClick={() => setCollapsed((value) => !value)}
          >
            <span aria-hidden="true" className="hud__collapse-icon">
              {collapsed ? "▾" : "▴"}
            </span>
            <span className="hud__collapse-text">{collapsed ? "Show" : "Hide"}</span>
          </button>
        </div>
      </div>
      <div className="hud__progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
    </header>
  );
}
