import Modal from "./Modal.jsx";
import { money, moneyCompact, pct, signedMoney, tone } from "../utils/format.js";

function headlineFor(summary) {
  if (summary.end_reason === "liquidity") return "Out of cash!";
  if (summary.is_game_over) return "Final bell!";
  if (summary.net_worth_change_pct > 0.5) return "Money at work!";
  if (summary.net_worth_change_pct < -0.5) return summary.rent.paid ? "Rent day bites." : "Rough week.";
  return "Holding steady.";
}

// The verdict stamped on the weekly report.
function verdictFor(summary) {
  if (summary.end_reason === "liquidity") return { text: "Evicted", tone: "red" };
  if (summary.net_worth_change_pct > 0.5) return { text: "Profit", tone: "green" };
  if (summary.net_worth_change_pct < -0.5) return { text: "Loss", tone: "red" };
  return { text: "No change", tone: "ink" };
}

// Higher rent or a higher bankruptcy risk is bad news for the player, so its colour flips.
const BAD_WHEN_UP = new Set(["rent", "bankruptcy_risk"]);

function sentiment(item) {
  if (!BAD_WHEN_UP.has(item.target_type) || item.direction === "neutral") return item.direction;
  return item.direction === "up" ? "down" : "up";
}

function ConsequenceItem({ item }) {
  return (
    <li className={`hit ${item.is_delayed ? "hit--delayed" : "hit--immediate"}`}>
      <div className="hit__badges">
        {item.is_delayed ? (
          <span className="badge badge--delayed">
            <span aria-hidden="true">&#9201;</span> Effect from Week {item.source_week}
          </span>
        ) : (
          <span className="badge badge--immediate">
            <span aria-hidden="true">&#9889;</span> Immediate Effect
          </span>
        )}
        <span className={`impact impact--${sentiment(item)}`}>
          {item.target_label}: {item.impact_label}
        </span>
        {item.player_was_exposed && <span className="badge badge--you">You owned this</span>}
      </div>
      <p className="hit__news">
        News: &ldquo;{item.event_title}&rdquo;
        {item.is_delayed && (
          <span className="hit__lag">
            {" "}
            &mdash; published in Week {item.source_week}, landed in Week {item.trigger_week} ({item.delay_weeks}-week
            lag)
          </span>
        )}
      </p>
      <p className="hit__text">{item.consequence_text}</p>
    </li>
  );
}

export default function WeekSummaryModal({ summary, onContinue }) {
  const resultTone = tone(summary.net_worth_change);
  const verdict = verdictFor(summary);
  const rentPaid = summary.rent.paid ? summary.rent.amount_paid : 0;
  const marketMove = summary.net_worth_change - summary.dividends_total + rentPaid;
  const lesson = summary.lesson;
  const delayedCount = summary.triggered_consequences.filter((c) => c.is_delayed).length;

  return (
    <Modal labelledBy="summary-title" className="summary" overlayClassName="summary-overlay" closeOnBackdrop={false}>
      <div className="summary__hero">
        <p className="eyebrow">
          Weekly report &middot; Week {summary.week} closed &middot; {summary.theme}
        </p>
        <h2 id="summary-title" className="summary__headline" tabIndex={-1} data-autofocus>
          {headlineFor(summary)}
        </h2>
        <p className="summary__sub">{lesson.title}</p>
        <span className={`stamp stamp--${verdict.tone} stamp--drop summary__verdict`}>{verdict.text}</span>
      </div>

      <div className={`ledger is-${resultTone}`}>
        <p className="eyebrow">Your result this week</p>
        <dl className="ledger__rows">
          <div>
            <dt>Share prices</dt>
            <dd className={`is-${tone(marketMove)}`}>{signedMoney(marketMove)}</dd>
          </div>
          <div>
            <dt>Dividends</dt>
            <dd className={`is-${tone(summary.dividends_total)}`}>{signedMoney(summary.dividends_total)}</dd>
          </div>
          <div>
            <dt>Rent</dt>
            <dd className={rentPaid ? "is-down" : "is-flat"}>{rentPaid ? signedMoney(-rentPaid) : money(0)}</dd>
          </div>
          <div className="ledger__total">
            <dt>Net change</dt>
            <dd className={`is-${resultTone}`}>{signedMoney(summary.net_worth_change)}</dd>
          </div>
          <div className="ledger__total">
            <dt>New net worth</dt>
            <dd>
              {money(summary.net_worth_after)} <small>({pct(summary.net_worth_change_pct)})</small>
            </dd>
          </div>
        </dl>
      </div>

      {/* ----------------------- BLOCK 1 ----------------------- */}
      <section className="summary-block" aria-labelledby="hit-title">
        <header className="summary-block__head">
          <h3 id="hit-title" className="section-title">
            What Just Hit the Market
          </h3>
          <p>
            {summary.triggered_consequences.length === 0
              ? "No news moved the market this week."
              : `${summary.triggered_consequences.length} effect${summary.triggered_consequences.length === 1 ? "" : "s"} · ${delayedCount} delayed from earlier news`}
          </p>
        </header>
        {summary.triggered_consequences.length > 0 && (
          <ul className="hit-list">
            {summary.triggered_consequences.map((item, i) => (
              <ConsequenceItem key={`${item.event_title}-${i}`} item={item} />
            ))}
          </ul>
        )}
        {summary.bankruptcies.map((b) => (
          <p key={b.company_id} className="bankrupt-note" role="alert">
            <strong>Bankruptcy:</strong> {b.message}
          </p>
        ))}
      </section>

      {/* ----------------------- BLOCK 2 ----------------------- */}
      <section className="summary-block" aria-labelledby="recap-title">
        <header className="summary-block__head">
          <h3 id="recap-title" className="section-title">
            Financial Recap &amp; Market Lag Lesson
          </h3>
        </header>

        <div className="recap-grid">
          <div className="recap-card">
            <h4>What did each company do?</h4>
            <table className="recap-table">
              <thead>
                <tr>
                  <th scope="col">Company</th>
                  <th scope="col">Before</th>
                  <th scope="col">After</th>
                  <th scope="col">Change</th>
                </tr>
              </thead>
              <tbody>
                {summary.price_changes.map((p) => (
                  <tr key={p.company_id}>
                    <th scope="row">
                      <i style={{ background: p.color }} aria-hidden="true" /> {p.name}
                      {p.shares_owned > 0 && <small> &middot; you: {p.shares_owned}</small>}
                    </th>
                    <td>{money(p.old_price)}</td>
                    <td>{p.is_bankrupt ? "Bankrupt" : money(p.new_price)}</td>
                    <td className={`is-${tone(p.change_pct, 0.05)}`}>{pct(p.change_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="recap-card">
            <h4>Your money moves</h4>
            <ul className="money-moves">
              <li>
                <span>Dividends received</span>
                <b className={summary.dividends_total > 0 ? "is-up" : ""}>{money(summary.dividends_total)}</b>
              </li>
              {summary.dividends.map((d) => (
                <li key={d.company_id} className="money-moves__sub">
                  <span>
                    {d.ticker}: {d.shares} &times; {money(d.per_share)}
                  </span>
                  <b>{money(d.amount)}</b>
                </li>
              ))}
              {summary.rent.enabled ? (
                <>
                  {summary.rent.changed && (
                    <li className="money-moves__alert">
                      <span>
                        Rent changed {moneyCompact(summary.rent.old_rent)} &rarr; {moneyCompact(summary.rent.new_rent)}
                        {summary.rent.source_week && <> (news from Week {summary.rent.source_week})</>}
                      </span>
                      <b className={summary.rent.delta > 0 ? "is-down" : "is-up"}>
                        {summary.rent.delta > 0 ? "+" : "−"}
                        {moneyCompact(Math.abs(summary.rent.delta))}
                      </b>
                    </li>
                  )}
                  <li>
                    <span>Rent paid this week</span>
                    <b className={summary.rent.paid ? "is-down" : ""}>
                      {summary.rent.paid ? `−${money(summary.rent.amount_paid)}` : "$0.00"}
                    </b>
                  </li>
                  <li className="money-moves__sub">
                    <span>
                      {summary.rent.next_due_week
                        ? `Next rent: ${moneyCompact(summary.rent.new_rent)} at the end of Week ${summary.rent.next_due_week}`
                        : "No more rent due this season"}
                    </span>
                  </li>
                </>
              ) : (
                <li>
                  <span>Living costs are switched off</span>
                </li>
              )}
              <li className="money-moves__total">
                <span>Cash now</span>
                <b className={summary.cash_after < 0 ? "is-down" : ""}>{money(summary.cash_after)}</b>
              </li>
            </ul>
          </div>
        </div>

        {summary.unmasked_noise.length > 0 && (
          <div className="noise-box">
            <h4>
              <span className="badge badge--noise">Just noise</span> Headlines that changed nothing
            </h4>
            <ul>
              {summary.unmasked_noise.map((n) => (
                <li key={n.event_id}>
                  <strong>&ldquo;{n.title}&rdquo;</strong> {n.explanation}
                </li>
              ))}
            </ul>
          </div>
        )}

        <article className="lesson">
          <header className="lesson__head">
            <span className="lesson__label">Coach&apos;s briefing</span>
            <span className={`source-badge source-badge--${lesson.ai_source}`}>
              {lesson.ai_source === "gemini" ? "Gemini AI lesson" : "Offline lesson"}
            </span>
            <span className="lesson__time">2-minute read</span>
          </header>
          <h4 className="lesson__title">{lesson.title}</h4>
          <p>{lesson.summary}</p>
          <div className="lesson__lag">
            <h5>Market lag, explained</h5>
            <p>{lesson.market_lag_lesson}</p>
          </div>
          {lesson.jargon.length > 0 && (
            <dl className="jargon">
              {lesson.jargon.map((j) => (
                <div key={j.term}>
                  <dt>{j.term}</dt>
                  <dd>{j.meaning}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="lesson__takeaway">
            <span>Remember</span>
            {lesson.key_takeaway}
          </p>
        </article>
      </section>

      <div className="summary__cta">
        <button type="button" className="btn btn--red btn--xl" onClick={onContinue}>
          <span>{summary.is_game_over ? "See your final results" : `Start Week ${summary.week + 1}`}</span>
          <span aria-hidden="true">&rarr;</span>
        </button>
      </div>
    </Modal>
  );
}
