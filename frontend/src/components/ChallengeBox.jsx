import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { money, pct } from "../utils/format.js";

export default function ChallengeBox({ seed, sessionId, nickname }) {
  const [board, setBoard] = useState([]);
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}${window.location.pathname}?challenge=${seed}${
    nickname ? `&from=${encodeURIComponent(nickname)}` : ""
  }`;

  useEffect(() => {
    if (seed == null) return undefined;
    let alive = true;
    const load = () =>
      api
        .challengeBoard(seed)
        .then((rows) => alive && setBoard(rows))
        .catch(() => {});
    load();
    const timer = window.setInterval(load, 8000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [seed]);

  if (seed == null) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
    api.kpiEvent({ event: "challenge_shared", session_id: sessionId });
  };

  return (
    <section className="paper-card challenge" aria-labelledby="challenge-title">
      <p className="eyebrow">Same season, same news</p>
      <h2 id="challenge-title" className="section-title">
        Challenge a friend
      </h2>
      <p className="challenge__text">
        Send this link: your friend plays exactly the same 12 weeks. Who ends with the higher net worth - and the
        better inspector stamp?
      </p>
      <div className="challenge__link">
        <input type="text" readOnly value={link} aria-label="Challenge link" onFocus={(e) => e.target.select()} />
        <button type="button" className="btn btn--yellow btn--sm" onClick={copy}>
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>

      {board.length > 0 && (
        <ol className="challenge__board" aria-label="Results for this season">
          {board.map((row, i) => (
            <li key={row.session_id} className={row.session_id === sessionId ? "is-you" : ""}>
              <span className="challenge__pos">{i + 1}</span>
              <span className="challenge__name">
                {row.session_id === sessionId ? `${row.nickname || "You"} (you)` : row.nickname || "Player"}
              </span>
              <span className={`challenge__stamp ${row.approved ? "is-ok" : "is-bad"}`}>{row.verdict}</span>
              <b>{money(row.final_net_worth)}</b>
              <small>{pct(row.roi_pct)}</small>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
