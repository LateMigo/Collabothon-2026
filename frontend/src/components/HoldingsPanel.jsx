import { money, pct, signedMoney, tone, whenWeek } from "../utils/format.js";

/** Under the newspaper: everything you own, with today's value and profit or loss. */
export default function HoldingsPanel({ game, onTrade, onOpenBonds, disabled }) {
  const owned = game.companies.filter((c) => c.shares_owned > 0);
  const bonds = game.fixed_income.holdings.filter((h) => h.status === "active");
  const stocksCost = owned.reduce((sum, c) => sum + c.avg_cost * c.shares_owned, 0);
  const stocksGain = game.stocks_value - stocksCost;

  return (
    <section className="holdings" aria-labelledby="holdings-title">
      <header className="holdings__head">
        <h2 id="holdings-title" className="holdings__title">
          Your stocks
        </h2>
        <span className="holdings__total">{money(game.stocks_value)}</span>
      </header>

      {owned.length === 0 ? (
        <p className="holdings__empty">
          You don&apos;t own any shares yet. Press <b>Buy / Sell</b> on a company card to start.
        </p>
      ) : (
        <ul className="holdings__list">
          {owned.map((c) => {
            const gain = c.position_value - c.avg_cost * c.shares_owned;
            const gainPct = c.avg_cost > 0 ? (c.price / c.avg_cost - 1) * 100 : 0;
            return (
              <li key={c.id} style={{ "--company": c.color }} className={c.is_bankrupt ? "is-bankrupt" : undefined}>
                <button
                  type="button"
                  className="holdings__row"
                  onClick={() => onTrade(c.id)}
                  disabled={disabled || c.is_bankrupt}
                  aria-label={`${c.name}: ${c.shares_owned} shares worth ${money(c.position_value)}. Open buy or sell.`}
                >
                  <span className="holdings__ticker">{c.ticker}</span>
                  <span className="holdings__shares">
                    <b>{c.shares_owned}</b> {c.shares_owned === 1 ? "share" : "shares"}
                  </span>
                  <b className="holdings__value">{c.is_bankrupt ? "$0.00" : money(c.position_value)}</b>
                  <small className="holdings__avg">avg {money(c.avg_cost)}</small>
                  <small className={`holdings__gain is-${tone(gain, 0.004)}`}>
                    {c.is_bankrupt ? "bankrupt" : `${signedMoney(gain)} (${pct(gainPct)})`}
                  </small>
                  {!c.is_bankrupt && c.dividend_per_share > 0 && c.next_dividend_week !== null && (
                    <span className="holdings__div">
                      Dividend {money(c.dividend_per_share * c.shares_owned)} {whenWeek(c.next_dividend_week, game.current_week)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {owned.length > 0 && (
        <p className={`holdings__sum is-${tone(stocksGain, 0.004)}`}>
          Profit / loss on your shares: <b>{signedMoney(stocksGain)}</b>
        </p>
      )}

      <button type="button" className="holdings__bonds" onClick={onOpenBonds} disabled={disabled}>
        <span>Bonds &amp; deposits</span>
        <b>{bonds.length ? `${bonds.length} · ${money(game.fixed_income.total_value)}` : "none"}</b>
      </button>
    </section>
  );
}
