import { useState } from "react";
import { readAiPrefs } from "../utils/aiPrefs.js";

export default function CompanyResearch({ companies, currentWeek, onResearch }) {
  const listed = companies.filter((c) => !c.is_bankrupt || c.shares_owned > 0);
  const [companyId, setCompanyId] = useState(listed[0]?.id ?? "");
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const selected = listed.some((c) => c.id === companyId) ? companyId : listed[0]?.id ?? "";
  const current = report && report.week === currentWeek && report.company_id === selected ? report : null;

  const run = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      setReport(await onResearch(selected, readAiPrefs()));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="research">
      <p className="research__label">Research a company &middot; free, doesn&apos;t use a hint</p>
      <div className="research__controls">
        <label htmlFor="research-company" className="sr-only">
          Company to research
        </label>
        <select
          id="research-company"
          className="research__select"
          value={selected}
          onChange={(event) => setCompanyId(event.target.value)}
          disabled={busy}
        >
          {listed.map((c) => (
            <option key={c.id} value={c.id}>
              {c.ticker} &middot; {c.name}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn--ink btn--sm" onClick={run} disabled={busy || !selected}>
          {busy ? "Studying…" : "Research"}
        </button>
      </div>

      {error && <p className="research__error">{error}</p>}

      {current && (
        <article className="research__report" aria-live="polite">
          <p className="research__verdict">{current.verdict}</p>
          <p className="research__summary">{current.summary}</p>
          <div className="research__cols">
            <div>
              <h4>Strengths</h4>
              <ul>
                {current.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Risks</h4>
              <ul>
                {current.risks.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
          {current.news_to_watch.length > 0 && (
            <div className="research__news">
              <h4>News to keep in mind</h4>
              <ul>
                {current.news_to_watch.map((n) => (
                  <li key={`${n.week}-${n.title}`}>
                    <b>
                      Week {n.week}: {n.title}
                    </b>{" "}
                    &mdash; {n.why}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="research__question">
            <b>Ask yourself:</b> {current.question}
          </p>
          <footer>
            <span className={`source-badge source-badge--${current.ai_source}`}>
              {current.ai_source === "gemini" ? "AI research · Gemini" : "Offline research"}
            </span>
            <span>{current.disclaimer}</span>
          </footer>
        </article>
      )}
    </div>
  );
}
