import InfoTip from "./InfoTip.jsx";
import { money, ratePct } from "../utils/format.js";

/** The safe option: a savings account with a small weekly interest that also backs up the rent. */
export default function SavingsPanel({ game, onOpen, disabled }) {
  const s = game.savings;
  const rateChanged = s.rate_changed_week !== null && Math.abs(s.weekly_rate_pct - s.previous_rate_pct) > 0.0001;
  const rateUp = s.weekly_rate_pct > s.previous_rate_pct;

  return (
    <section className="vault" aria-labelledby="vault-title">
      <header className="vault__head">
        <span className="vault__seal" aria-hidden="true">
          Safe
        </span>
        <div>
          <p className="vault__kicker">Bank &middot; no risk &middot; no fees</p>
          <h2 id="vault-title">{s.account_name}</h2>
        </div>
      </header>

      <div className="vault__balance">
        <span>Balance</span>
        <strong>{money(s.balance)}</strong>
      </div>

      <dl className="vault__facts">
        <div>
          <dt>
            Interest
            <InfoTip term="Interest">
              The bank pays you this share of your balance at the end of every week. Small, but your money can never
              fall in value here.
            </InfoTip>
          </dt>
          <dd>
            {ratePct(s.weekly_rate_pct)} a week
            {rateChanged && (
              <span className={`vault__rate-change ${rateUp ? "is-up" : "is-down"}`}>
                {rateUp ? "▲" : "▼"} news from Week {s.rate_change_source_week}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Pays you this week</dt>
          <dd className={s.projected_interest > 0 ? "is-up" : undefined}>+{money(s.projected_interest)}</dd>
        </div>
        <div>
          <dt>Earned so far</dt>
          <dd>{money(s.total_interest)}</dd>
        </div>
      </dl>

      <div className="vault__actions">
        <button
          type="button"
          className="btn btn--yellow btn--sm"
          onClick={() => onOpen("deposit")}
          disabled={disabled || game.cash <= 0}
        >
          Deposit
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => onOpen("withdraw")}
          disabled={disabled || s.balance <= 0}
        >
          Withdraw
        </button>
      </div>
      <p className="vault__note">Rent is paid from cash first &mdash; your savings cover the rest automatically.</p>
    </section>
  );
}
