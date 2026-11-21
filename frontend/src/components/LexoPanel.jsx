import { useEffect, useRef, useState } from "react";
import AiPrefsControl from "./AiPrefsControl.jsx";
import LexoCockpit from "./LexoCockpit.jsx";
import SpeakButton from "./SpeakButton.jsx";
import { readAiPrefs } from "../utils/aiPrefs.js";

const QUICK_TERMS = ["Dividend", "Bond", "Interest", "Diversification", "Inflation", "Bankruptcy"];
const EXAMPLE_QUESTIONS = [
  "Why do company bonds pay more than government bonds?",
  "What is compound interest?",
  "Why shouldn't I put all my money in one company?",
  "What does inflation do to my savings?",
  "How is a dividend different from a share price rise?",
];

export default function LexoPanel({ onAsk }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState(null);
  const [asked, setAsked] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [talking, setTalking] = useState(false);
  const talkTimer = useRef(null);

  useEffect(() => () => clearTimeout(talkTimer.current), []);

  const ask = async (text) => {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    setAsked(q);
    try {
      const result = await onAsk(q, readAiPrefs());
      setAnswer(result);
      setQuestion("");
      setTalking(true);
      clearTimeout(talkTimer.current);
      talkTimer.current = setTimeout(() => setTalking(false), 2600);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    ask(question);
  };

  return (
    <section className="lexo" aria-labelledby="lexo-title">
      <div className="lexo__frame">
        <LexoCockpit mode={busy ? "thinking" : talking ? "talking" : "idle"} />
      </div>

      <header className="lexo__head">
        <p className="lexo__channel">Cockpit 3 &middot; Money words</p>
        <h2 id="lexo-title">Berg</h2>
        <p className="lexo__sub">Ask me what any money word means. I explain ideas - I never pick shares for you.</p>
      </header>

      <AiPrefsControl />

      <div className="lexo__chips" role="group" aria-label="Quick questions">
        {QUICK_TERMS.map((term) => (
          <button key={term} type="button" onClick={() => ask(`What is ${term.toLowerCase()}?`)} disabled={busy}>
            {term}
          </button>
        ))}
      </div>

      <form className="lexo__form" onSubmit={submit}>
        <label htmlFor="lexo-question" className="sr-only">
          Your question for Berg
        </label>
        <input
          id="lexo-question"
          type="text"
          value={question}
          maxLength={300}
          placeholder="e.g. What is a dividend?"
          onChange={(event) => setQuestion(event.target.value)}
          disabled={busy}
        />
        <button type="submit" className="btn btn--yellow btn--sm" disabled={busy || !question.trim()}>
          {busy ? "…" : "Ask"}
        </button>
      </form>

      {busy && <p className="lexo__thinking">Berg is looking it up&hellip;</p>}
      {error && <p className="lexo__error">{error}</p>}

      {!answer && !busy && (
        <div className="lexo__examples">
          <p className="lexo__examples-title">Try asking Berg:</p>
          <ul>
            {EXAMPLE_QUESTIONS.map((q) => (
              <li key={q}>
                <button type="button" onClick={() => ask(q)}>
                  &ldquo;{q}&rdquo;
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {answer && !busy && (
        <article className="lexo__answer" aria-live="polite">
          <p className="lexo__q">&ldquo;{asked}&rdquo;</p>
          {answer.term && <h3 className="lexo__term">{answer.term}</h3>}
          <p>{answer.answer}</p>
          {answer.example && (
            <p className="lexo__example">
              <b>Example:</b> {answer.example}
            </p>
          )}
          {answer.related_terms?.length > 0 && (
            <div className="lexo__related">
              <span>Ask next:</span>
              {answer.related_terms.map((term) => (
                <button key={term} type="button" onClick={() => ask(`What is ${term.toLowerCase()}?`)}>
                  {term}
                </button>
              ))}
            </div>
          )}
          <footer className="lexo__answer-foot">
            <span className={`source-badge source-badge--${answer.ai_source}`}>
              {answer.ai_source === "gemini" ? "AI answer · Gemini" : "Offline notebook (English)"}
            </span>
            <SpeakButton text={`${answer.answer} ${answer.example ? `Example: ${answer.example}` : ""}`} />
          </footer>
        </article>
      )}
    </section>
  );
}
