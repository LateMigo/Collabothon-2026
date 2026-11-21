import Modal from "./Modal.jsx";
import { money, moneyCompact, pct, ratePct, RISK_LABELS, signedMoney, tone } from "../utils/format.js";

// Headline and stamp judge the INVESTING result: rent is a bill, not an investment loss.
function headlineFor(summary) {
  if (summary.end_reason === "liquidity") return "Out of cash!";
  if (summary.is_game_over) return "Final bell!";
  const invest = summary.investment_change_pct;
  if (invest > 0.5) return summary.rent.paid ? "Profit - and the rent is paid." : "Money at work!";
  if (invest < -0.5) return "Rough week.";
  return summary.rent.paid ? "Rent day - investments held steady." : "Holding steady.";
}

function verdictFor(summary) {
  if (summary.end_reason === "liquidity") return { text: "Evicted", tone: "red" };
  if (summary.investment_change_pct > 0.5) return { text: "Profit", tone: "green" };
  if (summary.investment_change_pct < -0.5) return { text: "Loss", tone: "red" };
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
  const investTone = tone(summary.investment_change);
  const verdict = verdictFor(summary);
  const rentPaid = summary.rent.paid ? summary.rent.amount_paid : 0;
  const savings = summary.savings;
  const fi = summary.fixed_income;
  const interest = savings.interest + fi.interest;
  const defaultLoss = fi.defaulted.reduce((sum, d) => sum + d.lost, 0);
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

      <div className={`ledger is-${investTone}`}>
        <p className="eyebrow">Your result this week</p>
        <dl className="ledger__rows">
          <div>
            <dt>Share prices</dt>
            <dd className={`is-${tone(summary.stocks_change)}`}>{signedMoney(summary.stocks_change)}</dd>
          </div>
          <div>
            <dt>Dividends</dt>
            <dd className={`is-${tone(summary.dividends_total)}`}>{signedMoney(summary.dividends_total)}</dd>
          </div>
          <div>
            <dt>Interest (savings, bonds, deposits)</dt>
            <dd className={`is-${tone(interest)}`}>{signedMoney(interest)}</dd>
          </div>
          {defaultLoss > 0 && (
            <div>
              <dt>Bond default</dt>
              <dd className="is-down">{signedMoney(-defaultLoss)}</dd>
            </div>
          )}
          <div className="ledger__total ledger__invest">
            <dt>Investing result</dt>
            <dd className={`is-${investTone}`}>
              {signedMoney(summary.investment_change)} <small>({pct(summary.investment_change_pct)})</small>
            </dd>
          </div>
          <div>
            <dt>Rent (a bill, not an investment)</dt>
            <dd className={rentPaid ? "is-down" : "is-flat"}>{rentPaid ? signedMoney(-rentPaid) : money(0)}</dd>
          </div>
          <div className="ledger__total">
            <dt>Net change after bills</dt>
            <dd className={`is-${resultTone}`}>{signedMoney(summary.net_worth_change)}</dd>
          </div>
          <div className="ledger__total">
            <dt>New net worth</dt>
            <dd>{money(summary.net_worth_after)}</dd>
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
                  <th scope="col">You own</th>
                  <th scope="col">Share price</th>
                  <th scope="col">Change</th>
                  <th scope="col">
                    <abbr title="Bankruptcy risk now. The arrow shows the direction since last week.">Bust risk</abbr>
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.price_changes.map((p) => {
                  const riskMove = p.risk_after - p.risk_before;
                  const moved = Math.abs(riskMove) >= 0.005;
                  return (
                    <tr key={p.company_id} className={p.shares_owned > 0 ? "is-owned" : undefined}>
                      <th scope="row">
                        <span className="recap-company">
                          <i style={{ background: p.color }} aria-hidden="true" />
                          <span>
                            {p.name}
                            <small>{p.ticker}</small>
                          </span>
                        </span>
                      </th>
                      <td className="recap-owned">
                        {p.shares_owned > 0 ? (
                          <>
                            <b>{p.shares_owned}</b>
                            <small>{p.shares_owned === 1 ? "share" : "shares"}</small>
                          </>
                        ) : (
                          <span className="recap-none">&mdash;</span>
                        )}
                      </td>
                      <td>
                        {p.is_bankrupt ? "Bankrupt" : money(p.new_price)}
                        <small className="recap-was">was {money(p.old_price)}</small>
                      </td>
                      <td className={`is-${tone(p.change_pct, 0.05)}`}>{pct(p.change_pct)}</td>
                      <td
                        className={`recap-risk recap-risk--${p.risk_level}`}
                        title={`Bankruptcy risk: ${Math.round(p.risk_before * 100)}% last week, ${Math.round(
                          p.risk_after * 100,
                        )}% now`}
                      >
                        <span className="recap-risk__pill">
                          {Math.round(p.risk_after * 100)}%
                          {moved && (
                            <span className={riskMove > 0 ? "is-down" : "is-up"} aria-hidden="true">
                              {riskMove > 0 ? " \u25b2" : " \u25bc"}
                            </span>
                          )}
                        </span>
                        <small>{RISK_LABELS[p.risk_level]}</small>
                        {moved && <span className="sr-only">{riskMove > 0 ? " rising" : " falling"}</span>}
                      </td>
                    </tr>
                  );
                })}
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
              <li>
                <span>Savings interest ({ratePct(savings.rate_pct)} a week)</span>
                <b className={savings.interest > 0 ? "is-up" : ""}>{money(savings.interest)}</b>
              </li>
              {(fi.interest > 0 || fi.matured.length > 0 || fi.defaulted.length > 0) && (
                <li>
                  <span>Bond &amp; deposit interest</span>
                  <b className={fi.interest > 0 ? "is-up" : ""}>{money(fi.interest)}</b>
                </li>
              )}
              {fi.matured.map((m) => (
                <li key={m.holding_id} className="money-moves__sub">
                  <span>
                    {m.name} paid back {money(m.principal)} + {money(m.interest)} interest
                  </span>
                  <b className="is-up">{money(m.payout)}</b>
                </li>
              ))}
              {fi.defaulted.map((d) => (
                <li key={d.holding_id} className="money-moves__alert">
                  <span>
                    {d.name} defaulted &mdash; only {money(d.recovered)} of {money(d.principal)} came back
                  </span>
                  <b className="is-down">&minus;{money(d.lost)}</b>
                </li>
              ))}
              {savings.rate_changed && (
                <li className="money-moves__alert">
                  <span>
                    Savings rate changed {ratePct(savings.old_rate_pct)} &rarr; {ratePct(savings.rate_pct)}
                    {savings.rate_source_week && <> (news from Week {savings.rate_source_week})</>}
                  </span>
                  <b className={savings.rate_pct > savings.old_rate_pct ? "is-up" : "is-down"}>
                    {savings.rate_pct > savings.old_rate_pct ? "▲" : "▼"}
                  </b>
                </li>
              )}
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
                  {savings.rent_from_savings > 0 && (
                    <li className="money-moves__sub">
                      <span>Cash was short &mdash; moved automatically from savings</span>
                      <b>{money(savings.rent_from_savings)}</b>
                    </li>
                  )}
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
              <li className="money-moves__sub">
                <span>In savings</span>
                <b>{money(savings.balance_after)}</b>
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
