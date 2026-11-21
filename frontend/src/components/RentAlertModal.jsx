import Modal from "./Modal.jsx";
import { money, moneyCompact, rentCheck } from "../utils/format.js";

export default function RentAlertModal({ game, onClose, onEndAnyway, onSell, onOpenBonds }) {
  const check = rentCheck(game);
  const rent = game.rent.monthly_rent;
  const stocks = game.companies.filter((c) => c.shares_owned > 0 && !c.is_bankrupt);
  const holdings = game.fixed_income.holdings.filter((h) => h.status === "active" && h.maturity_week !== game.current_week);
  const canRaise =
    stocks.reduce((sum, c) => sum + c.shares_owned * c.sell_price, 0) +
    holdings.reduce((sum, h) => sum + h.early_exit_value, 0);

  return (
    <Modal labelledBy="rent-alert-title" onClose={onClose} className="rent-alert" closeOnBackdrop={false}>
      <header className="rent-alert__head">
        <span className="stamp stamp--red stamp--drop rent-alert__stamp">Rent due</span>
        <div>
          <p className="eyebrow">Notice R-4 &middot; Landlord of Valdoria</p>
          <h2 id="rent-alert-title" className="section-title section-title--xl" tabIndex={-1} data-autofocus>
            You can&apos;t pay the rent yet
          </h2>
        </div>
      </header>

      <dl className="rent-alert__sum">
        <div>
          <dt>Rent due at the end of Week {game.current_week}</dt>
          <dd>{moneyCompact(rent)}</dd>
        </div>
        <div>
          <dt>Cash</dt>
          <dd>{money(game.cash)}</dd>
        </div>
        <div>
          <dt>Savings vault (pays automatically)</dt>
          <dd>{money(game.savings.balance)}</dd>
        </div>
        {game.fixed_income.maturing_this_week > 0 && (
          <div>
            <dt>Bonds &amp; deposits that pay back this week</dt>
            <dd>{money(game.fixed_income.maturing_this_week)}</dd>
          </div>
        )}
        <div className="rent-alert__missing">
          <dt>Missing</dt>
          <dd>{money(check.shortfall)}</dd>
        </div>
      </dl>

      {check.onlyIfDividends ? (
        <p className="rent-alert__warn">
          Only the dividends due this week (about <strong>{money(check.dividends)}</strong>) would close the gap &mdash;
          if the news cuts them, you can&apos;t pay the landlord and <strong>the game is over</strong>. To be safe, raise
          at least {money(check.shortfall)} first:
        </p>
      ) : (
        <p className="rent-alert__warn">
          If you end the week like this, you can&apos;t pay the landlord and <strong>the game is over</strong>. Shares and
          locked bonds don&apos;t pay rent &mdash; only cash does. Raise at least {money(check.shortfall)} first:
        </p>
      )}

      {stocks.length > 0 || holdings.length > 0 ? (
        <ul className="rent-alert__options">
          {stocks.map((c) => (
            <li key={c.id}>
              <span>
                <b>Sell {c.ticker}</b> &middot; {c.shares_owned} shares &times; {money(c.sell_price)} after the fee
              </span>
              <button type="button" className="btn btn--ink btn--sm" onClick={() => onSell(c.id)}>
                Sell
              </button>
            </li>
          ))}
          {holdings.map((h) => (
            <li key={h.holding_id}>
              <span>
                <b>Cash out {h.name}</b> &middot; you get {money(h.early_exit_value)} back now
              </span>
              <button type="button" className="btn btn--ink btn--sm" onClick={onOpenBonds}>
                Open
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rent-alert__none">You have nothing left to sell.</p>
      )}
      {canRaise > 0 && canRaise < check.shortfall && (
        <p className="rent-alert__none">Even selling everything would not cover the whole rent.</p>
      )}

      <div className="rent-alert__actions">
        <button type="button" className="btn btn--yellow btn--xl" onClick={onClose}>
          <span>Go back and raise cash</span>
          <span aria-hidden="true">&larr;</span>
        </button>
        <button type="button" className="btn btn--ghost btn--sm rent-alert__anyway" onClick={onEndAnyway}>
          {check.onlyIfDividends ? "End the week and count on the dividends" : "End the week anyway (game over)"}
        </button>
      </div>
    </Modal>
  );
}
