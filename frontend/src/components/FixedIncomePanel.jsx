import InfoTip from "./InfoTip.jsx";
import { money, ratePct } from "../utils/format.js";

const UNLOCK_WEEK = 3;

export default function FixedIncomePanel({ game, onOpen, disabled }) {
  const fi = game.fixed_income;
  if (game.current_week < UNLOCK_WEEK && fi.holdings.length === 0) {
    return (
      <section className="vault bond-desk bond-desk--locked" aria-labelledby="bond-desk-title">
        <header className="vault__head">
          <span className="vault__seal bond-desk__seal" aria-hidden="true">
            Bond
          </span>
          <div>
            <p className="vault__kicker">Opens in Week {UNLOCK_WEEK}</p>
            <h2 id="bond-desk-title">Bonds &amp; Term Deposits</h2>
          </div>
        </header>
        <p className="bond-desk__locked-text">
          First get to know shares and your savings account. In Week {UNLOCK_WEEK} you can also lend money for a
          fixed interest - safer than shares, but locked until it pays back.
        </p>
        <p className="vault__note">Want a head start? Open <b>Learn</b> &rarr; &ldquo;Bonds and term deposits&rdquo;.</p>
      </section>
    );
  }
  const active = fi.holdings.filter((h) => h.status === "active");
  const open = fi.offers.filter((o) => o.available);
  const best = open.reduce((top, o) => (!top || o.weekly_rate_pct > top.weekly_rate_pct ? o : top), null);
  const next = active.reduce((soon, h) => (!soon || h.maturity_week < soon.maturity_week ? h : soon), null);

  return (
    <section className="vault bond-desk" aria-labelledby="bond-desk-title">
      <header className="vault__head">
        <span className="vault__seal bond-desk__seal" aria-hidden="true">
          Bond
        </span>
        <div>
          <p className="vault__kicker">Fixed interest &middot; money locked</p>
          <h2 id="bond-desk-title">Bonds &amp; Term Deposits</h2>
        </div>
      </header>

      <div className="vault__balance">
        <span>Locked away</span>
        <strong>{money(fi.total_value)}</strong>
      </div>

      <dl className="vault__facts">
        <div>
          <dt>
            On offer
            <InfoTip entry="fixedIncome">
              A bank deposit or a government bond is safe; a company bond pays more, but can default if the company
              goes bankrupt.
            </InfoTip>
          </dt>
          <dd>
            {open.length} offer{open.length === 1 ? "" : "s"}
            {best && <span className="vault__rate-change">up to {ratePct(best.weekly_rate_pct)} a week</span>}
          </dd>
        </div>
        <div>
          <dt>Yours</dt>
          <dd>
            {active.length === 0 ? "none yet" : `${active.length} active`}
            {next && <span className="vault__rate-change">next pays back in Week {next.maturity_week}</span>}
          </dd>
        </div>
        <div>
          <dt>Interest so far</dt>
          <dd className={fi.total_interest > 0 ? "is-up" : undefined}>{money(fi.total_interest)}</dd>
        </div>
      </dl>

      <button type="button" className="btn btn--yellow btn--sm" onClick={onOpen} disabled={disabled}>
        Open the bond desk
      </button>
      <p className="vault__note">Locked money can&apos;t pay rent until it pays back &mdash; plan the dates.</p>
    </section>
  );
}
