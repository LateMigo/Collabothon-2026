import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useAiPrefs } from "../utils/aiPrefs.js";
import { money, pct } from "../utils/format.js";
import SpeakButton from "./SpeakButton.jsx";

const COLORS = { you: "#e0503a", saver: "#ffcc00", spread: "#5fae6a" };
const W = 560;
const H = 220;
const PAD = { l: 52, r: 14, t: 14, b: 26 };

function Chart({ lines }) {
  const all = lines.flatMap((l) => l.history.map((p) => p.net_worth));
  const lo = Math.min(...all) * 0.95;
  const hi = Math.max(...all) * 1.03;
  const weeks = Math.max(...lines.map((l) => l.history[l.history.length - 1].week), 1);
  const x = (w) => PAD.l + (w / weeks) * (W - PAD.l - PAD.r);
  const y = (v) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.t - PAD.b);
  const ticks = [lo, (lo + hi) / 2, hi];

  return (
    <svg className="what-if__chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Net worth week by week for your season and the two replays">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="what-if__grid" />
          <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" className="what-if__tick">
            ${Math.round(t).toLocaleString("en-US")}
          </text>
        </g>
      ))}
      {[0, Math.round(weeks / 2), weeks].map((w) => (
        <text key={w} x={x(w)} y={H - 6} textAnchor="middle" className="what-if__tick">
          {w === 0 ? "Start" : `W${w}`}
        </text>
      ))}
      {lines.map((l) => (
        <g key={l.key}>
          <polyline
            fill="none"
            stroke={COLORS[l.key] ?? "#ccc"}
            strokeWidth={l.key === "you" ? 4 : 3}
            strokeDasharray={l.key === "you" ? undefined : "8 5"}
            points={l.history.map((p) => `${x(p.week)},${y(p.net_worth)}`).join(" ")}
          />
          {l.end_reason === "liquidity" && (
            <text
              x={x(l.history[l.history.length - 1].week) + 4}
              y={y(l.history[l.history.length - 1].net_worth) - 6}
              className="what-if__out"
            >
              out of rent money
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export default function WhatIfPanel({ sessionId }) {
  const prefs = useAiPrefs();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    api
      .whatIf(sessionId, prefs)
      .then((result) => alive && setData(result))
      .catch((err) => alive && setError(err.message));
    return () => {
      alive = false;
    };
  }, [sessionId, prefs.level, prefs.language]);

  return (
    <section className="paper-card what-if" aria-labelledby="what-if-title">
      <p className="eyebrow">Same season, same news, replayed</p>
      <h2 id="what-if-title" className="section-title">
        What if you had played it differently?
      </h2>
      {error && <p className="error-note">{error}</p>}
      {!data && !error && <p className="what-if__loading">Replaying your season with two other strategies&hellip;</p>}
      {data && (
        <>
          <Chart lines={data.lines} />
          <ul className="what-if__legend">
            {data.lines.map((l) => (
              <li key={l.key}>
                <span className="what-if__swatch" style={{ background: COLORS[l.key] }} aria-hidden="true" />
                <div>
                  <b>{l.label}</b>
                  <small>{l.description}</small>
                </div>
                <span className="what-if__result">
                  {money(l.final_net_worth)}
                  <small>{l.end_reason === "liquidity" ? "ran out of rent money" : `investing ${pct(l.roi_pct)}`}</small>
                </span>
              </li>
            ))}
          </ul>
          <div className="what-if__story">
            <p className="what-if__headline">{data.headline}</p>
            <p>{data.explanation}</p>
            <p className="what-if__takeaway">
              <b>Take this into real life:</b> {data.takeaway}
            </p>
            <footer>
              <span className={`source-badge source-badge--${data.ai_source}`}>
                {data.ai_source === "gemini" ? "AI Coach · Gemini" : "Offline coach"}
              </span>
              <SpeakButton text={`${data.headline} ${data.explanation} ${data.takeaway}`} />
            </footer>
          </div>
        </>
      )}
    </section>
  );
}
