import { useState } from "react";
import { api } from "../api/client.js";
import { WEEK_QUIZ, readQuizScore, saveQuizAnswer } from "../utils/quiz.js";

export default function WeekQuiz({ week, sessionId }) {
  const quiz = WEEK_QUIZ[week];
  const [picked, setPicked] = useState(() => {
    const saved = readQuizScore(sessionId);
    return week in saved ? (saved[week] ? quiz?.correct : -1) : null;
  });
  if (!quiz) return null;

  const answered = picked !== null;
  const right = answered && picked === quiz.correct;
  const points = Object.values(readQuizScore(sessionId)).filter(Boolean).length;

  const answer = (i) => {
    if (answered) return;
    setPicked(i);
    const correct = i === quiz.correct;
    saveQuizAnswer(sessionId, week, correct);
    api.kpiEvent({ event: "quiz_answered", session_id: sessionId, detail: `week-${week}` });
    if (correct) api.kpiEvent({ event: "quiz_correct", session_id: sessionId, detail: `week-${week}` });
  };

  return (
    <section className="week-quiz" aria-labelledby="week-quiz-title">
      <header className="week-quiz__head">
        <span className="week-quiz__badge">Quick check &middot; Week {week}</span>
        <span className="week-quiz__points">Knowledge points: {points}</span>
      </header>
      <h3 id="week-quiz-title" className="week-quiz__q">
        {quiz.q}
      </h3>
      <div className="week-quiz__options" role="group" aria-label="Answers">
        {quiz.options.map((option, i) => {
          let state = "";
          if (answered && i === quiz.correct) state = "is-right";
          else if (answered && i === picked) state = "is-wrong";
          return (
            <button
              key={option}
              type="button"
              className={`week-quiz__option ${state}`}
              onClick={() => answer(i)}
              disabled={answered}
              aria-pressed={picked === i}
            >
              {option}
            </button>
          );
        })}
      </div>
      {answered && (
        <p className={`week-quiz__why ${right ? "is-right" : "is-wrong"}`} aria-live="polite">
          <b>{right ? "Correct! +1 point." : "Not quite."}</b> {quiz.why}
        </p>
      )}
    </section>
  );
}
