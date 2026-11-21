import { useEffect, useState } from "react";
import { money, moneyCompact, pct, plural, readStorage, readyForRent, tone, writeStorage } from "../utils/format.js";
import BrandMark from "./BrandMark.jsx";
import InfoTip from "./InfoTip.jsx";

const COLLAPSED_KEY = "fq.hudCollapsed";

function rentStatus(rent, ready) {
  const changed = Math.abs(rent.rent_delta) > 0.001;
  const up = rent.rent_delta > 0;
  const dueThisWeek = rent.next_due_week !== null && rent.weeks_until_due === 0;
  const danger = rent.next_due_week !== null && rent.weeks_until_due <= 1 && ready < rent.monthly_rent;
  let dueText;
  if (rent.next_due_week === null) dueText = "No more rent this season";
  else if (dueThisWeek) dueText = "Due at the end of this week!";
  else dueText = `Rent due in ${plural(rent.weeks_until_due, "week")}`;
  const delta = changed ? `(${up ? "+" : "−"}${moneyCompact(Math.abs(rent.rent_delta))})` : null;
  return { changed, up, dueThisWeek, danger, dueText, delta };
}

function RentIndicator({ rent, ready }) {
  if (!rent.enabled) {
    return (
      <div className="hud-stat hud-rent hud-rent--off">
        <dt>Monthly rent</dt>
        <dd>Living costs off</dd>
      </div>
    );
  }

  const status = rentStatus(rent, ready);
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

export default function HudBar({ game, onMenu }) {
  const [collapsed, setCollapsed] = useState(() => readStorage("localStorage", COLLAPSED_KEY) === "1");
  const { current_week: week, total_weeks: total, cash, stocks_value: stocks, net_worth: netWorth } = game;
  const savings = game.savings.balance;
  const ready = readyForRent(game);
  const investing = game.roi_pct;
  const progress = Math.min(100, ((week - (game.is_game_over ? 0 : 1)) / total) * 100);

  useEffect(() => {
    writeStorage("localStorage", COLLAPSED_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  if (collapsed) {
    const danger = game.rent.enabled && rentStatus(game.rent, ready).danger;
    return (
      <div className="hud-tab-wrap">
        <button
          type="button"
          className={`hud-tab ${danger ? "hud-tab--danger" : ""}`}
          aria-expanded="false"
          aria-controls="hud-details"
          onClick={() => setCollapsed(false)}
          title={danger ? "Rent is due and you are short of cash - open the panel" : "Show the top panel"}
        >
          <span aria-hidden="true">{"▾"}</span> Show panel
          {danger && <span className="hud-tab__alert"> &middot; Rent alert!</span>}
        </button>
      </div>
    );
  }

  return (
    <header className="hud">
      <div className="hud__inner">
        <div className="brand" aria-label="CosmiCash">
          <BrandMark />
          <span className="brand__text">
            <span>Cosmi</span><span className="brand__accent">Cash</span>
            <small>Galactic Exchange &middot; Booth 7</small>
          </span>
        </div>

        <div className="hud-week" aria-label={`Week ${week} of ${total}`}>
          <span className="hud-week__label">Week</span>
          <strong>{week}</strong>
          <span className="hud-week__of">/{total}</span>
        </div>

        <dl id="hud-details" className="hud-stats">
          <div className="hud-stat">
            <dt>Cash</dt>
            <dd>{money(cash)}</dd>
          </div>
          <div className="hud-stat">
            <dt>Stocks</dt>
            <dd>{money(stocks)}</dd>
          </div>
          <div className="hud-stat" title={`${game.savings.account_name}: ${game.savings.weekly_rate_pct}% interest a week`}>
            <dt>
              Savings <InfoTip entry="savings" />
            </dt>
            <dd>{money(savings)}</dd>
          </div>
          <div className="hud-stat" title="Bonds and term deposits: money lent for a fixed interest, plus the interest earned so far">
            <dt>Bonds</dt>
            <dd>{money(game.fixed_income_value)}</dd>
          </div>
          <div className="hud-stat hud-stat--accent">
            <dt>
              Net worth <InfoTip entry="netWorth" />
            </dt>
            <dd>{money(netWorth)}</dd>
            <span
              className={`hud-invest is-${tone(investing)}`}
              title={`What your investing earned since the start, before living costs. Rent paid so far: ${money(
                game.total_rent_paid,
              )} - that is a bill, not an investment loss.`}
            >
              Investing {pct(investing)}
              {game.total_rent_paid > 0 && <small> &middot; rent paid {moneyCompact(game.total_rent_paid)}</small>}
            </span>
          </div>
          <RentIndicator rent={game.rent} ready={ready} />
        </dl>

        <div className="hud__controls">
          <button type="button" className="hud__collapse hud__menu" onClick={onMenu} title="Back to the main menu (your game is kept)">
            <span aria-hidden="true" className="hud__collapse-icon">
              {"☰"}
            </span>
            <span className="hud__collapse-text">Menu</span>
            <span className="sr-only">Back to the main menu</span>
          </button>
          <button
            type="button"
            className="hud__collapse"
            aria-expanded="true"
            aria-controls="hud-details"
            aria-label="Hide top panel"
            title="Hide top panel"
            onClick={() => setCollapsed(true)}
          >
            <span aria-hidden="true" className="hud__collapse-icon">
              {"▴"}
            </span>
            <span className="hud__collapse-text">Hide</span>
          </button>
        </div>
      </div>
      <div className="hud__progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
    </header>
  );
}
