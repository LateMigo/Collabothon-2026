import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import StockChart from "./StockChart.jsx";
import { money, pct, signedMoney, tone } from "../utils/format.js";

function headlineFor(stats) {
  if (stats.end_reason === "liquidity") return "Out of cash.";
  if (stats.roi_pct >= 10) return "Nice work, space shark.";
  if (stats.roi_pct >= 0) return "Solid season.";
  return "Lesson learned.";
}

// The stamp the review board slams on your file.
function verdictFor(stats) {
  if (stats.end_reason === "liquidity") return { text: "Evicted", tone: "red" };
  if (stats.roi_pct >= 10) return { text: "Promoted", tone: "green" };
  if (stats.roi_pct >= 0) return { text: "Approved", tone: "green" };
  return { text: "Probation", tone: "red" };
}

function TradeHistory({ trades }) {
  if (trades.length === 0) {
    return <p className="empty-note">You didn&apos;t buy or sell any shares this season.</p>;
  }
  return (
    <ol className="trade-history">
      {trades.map((t) => (
        <li key={t.seq} className={`trade-history__item is-${t.action_type}`}>
          <span className="trade-history__week">W{t.week}</span>
          <span className="trade-history__action">{t.action_type === "buy" ? "Buy" : "Sell"}</span>
          <span className="trade-history__what">
            {t.shares} &times; <b>{t.ticker}</b> @ {money(t.price)}
          </span>
          <span className="trade-history__total">
            {t.action_type === "buy" ? "−" : "+"}
            {money(t.amount)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Coach({ analysis }) {
  const gemini = analysis.ai_source === "gemini";
  return (
    <section className="coach" aria-labelledby="coach-title">
      <header className="coach__head">
        <div>
          <p className="eyebrow">Post-game review</p>
          <h2 id="coach-title" className="section-title section-title--xl">
            Move Analysis &amp; Financial Coaching
          </h2>
        </div>
        <span className={`source-badge source-badge--${analysis.ai_source}`}>
          {gemini ? "AI Coach · Gemini" : "Smart Offline Analysis"}
        </span>
      </header>

      <div className="coach__style">
        <span className="eyebrow">Your investing style</span>
        <strong>{analysis.play_style}</strong>
        <p>{analysis.play_style_summary}</p>
      </div>
      <p className="coach__overall">{analysis.overall_message}</p>

      <div className="coach__columns">
        <div className="coach-list coach-list--good">
          <h3>What You Did Well</h3>
          <ul>
            {analysis.strengths.map((item, i) => (
              <li key={i}>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="coach-list coach-list--change">
          <h3>What You Could Change</h3>
          <ul>
            {analysis.improvements.map((item, i) => (
              <li key={i}>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h3 className="coach__tips-title">Practical Investing Tips</h3>
      <div className="tip-cards">
        {analysis.actionable_tips.map((tip, i) => (
          <article key={i} className="tip-card">
            <h4>{tip.title}</h4>
            <p>{tip.tip}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function MarketTimeline({ timeline }) {
  const weeks = [...new Set(timeline.map((t) => t.week))];
  return (
    <ol className="timeline">
      {weeks.map((week) => (
        <li key={week} className="timeline__week">
          <span className="timeline__label">Week {week}</span>
          <ul>
            {timeline
              .filter((t) => t.week === week)
              .map((t) => (
                <li key={t.event_id} className={t.is_noise ? "is-noise" : "is-real"}>
                  <span className={`badge ${t.is_noise ? "badge--noise" : "badge--real"}`}>
                    {t.is_noise ? "Noise" : "Real news"}
                  </span>
                  <strong>{t.title}</strong>
                  {t.is_noise ? (
                    <p>{t.noise_explanation}</p>
                  ) : (
                    <p>{t.effects.join(" · ")}</p>
                  )}
                </li>
              ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

export default function GameOverScreen({ game, onPlayAgain }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .finalAnalysis(game.session_id)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [game.session_id, attempt]);

  const retry = () => {
    setError(null);
    setAttempt((n) => n + 1);
  };

  if (!data) {
    return (
      <main className="gameover">
        <div className="gameover-card gameover-card--loading" role="status" aria-live="polite">
          {error ? (
            <>
              <h1 className="gameover-card__title">Hmm.</h1>
              <p className="error-note">{error}</p>
              <button type="button" className="btn btn--red btn--xl" onClick={retry}>
                <span>Try again</span>
                <span aria-hidden="true">&rarr;</span>
              </button>
            </>
          ) : (
            <>
              <span className="loader" aria-hidden="true" />
              <h1 className="gameover-card__title">Final bell&hellip;</h1>
              <p>Your coach is reviewing every move you made.</p>
            </>
          )}
        </div>
      </main>
    );
  }

  const { stats, analysis } = data;
  const roiTone = tone(stats.roi_pct);
  const verdict = verdictFor(stats);

  return (
    <main className="gameover">
      <section className="gameover-card" aria-labelledby="gameover-title">
        <span className={`stamp stamp--${verdict.tone} stamp--drop gameover-card__verdict`}>{verdict.text}</span>
        <span className="pill">Performance review</span>
        <p className="eyebrow">
          {stats.end_reason === "liquidity"
            ? `Out of cash · Week ${stats.weeks_played} / ${game.total_weeks}`
            : `Season complete · ${stats.weeks_played} / ${game.total_weeks} weeks`}
        </p>
        <h1 id="gameover-title" className="gameover-card__title">
          {headlineFor(stats)}
        </h1>
        <p className="gameover-card__sub">{game.scenario.title}</p>

        <div className={`result-box is-${tone(stats.final_net_worth - stats.starting_cash)}`}>
          <p className="eyebrow">Final net worth</p>
          <p className="result-box__value">{money(stats.final_net_worth)}</p>
          <p className="result-box__sub">
            Started with {money(stats.starting_cash)} &middot; cash {money(stats.final_cash)} + shares{" "}
            {money(stats.final_stocks_value)}
          </p>
        </div>

        <dl className="final-metrics">
          <div>
            <dt>ROI %</dt>
            <dd className={`is-${roiTone}`}>{pct(stats.roi_pct)}</dd>
            <small>investments, before rent</small>
          </div>
          <div>
            <dt>Dividends earned</dt>
            <dd className={stats.total_dividends > 0 ? "is-up" : ""}>{money(stats.total_dividends)}</dd>
          </div>
          <div>
            <dt>Rent paid</dt>
            <dd className={stats.total_rent_paid > 0 ? "is-down" : ""}>{money(stats.total_rent_paid)}</dd>
          </div>
          <div>
            <dt>Trades</dt>
            <dd>{stats.trades_count}</dd>
          </div>
        </dl>

        <ol className="week-strip" aria-label="Net worth change per week">
          {data.weekly_results.map((w) => (
            <li key={w.week}>
              <span>W{w.week}</span>
              <b className={`is-${tone(w.change)}`}>{signedMoney(w.change)}</b>
            </li>
          ))}
        </ol>

        <blockquote className="quote">
          &ldquo;The galaxy is a great teacher. It just sends the bill first.&rdquo;
          <footer>&mdash; Grandma Odette, retired asteroid bookkeeper</footer>
        </blockquote>

        <button type="button" className="btn btn--red btn--xl" onClick={onPlayAgain}>
          <span>Play Again</span>
          <span aria-hidden="true">&rarr;</span>
        </button>
      </section>

      <div className="gameover__grid">
        <Coach analysis={analysis} />

        <div className="gameover__side">
          <StockChart
            history={data.price_history}
            companies={data.companies}
            totalWeeks={game.total_weeks}
            title="Final market chart"
            height={260}
          />
          <section className="paper-card" aria-labelledby="history-title">
            <p className="eyebrow">Every order you placed</p>
            <h2 id="history-title" className="section-title">
              Your Trade History
            </h2>
            <TradeHistory trades={data.trade_history} />
          </section>
        </div>
      </div>

      <section className="paper-card gameover__timeline" aria-labelledby="timeline-title">
        <p className="eyebrow">Behind the headlines</p>
        <h2 id="timeline-title" className="section-title">
          What really happened each week
        </h2>
        <MarketTimeline timeline={data.market_timeline} />
      </section>

      <div className="gameover__again">
        <button type="button" className="btn btn--yellow btn--xl" onClick={onPlayAgain}>
          <span>Play Again</span>
          <span aria-hidden="true">&rarr;</span>
        </button>
      </div>
    </main>
  );
}
