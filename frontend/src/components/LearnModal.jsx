import { useState } from "react";
import { api } from "../api/client.js";
import { LESSONS, markLessonDone, readLessonsDone } from "../utils/lessons.js";
import Modal from "./Modal.jsx";
import SpeakButton from "./SpeakButton.jsx";

export default function LearnModal({ sessionId, initialLesson = null, onClose, onProgress }) {
  const [done, setDone] = useState(readLessonsDone);
  const [active, setActive] = useState(
    () => initialLesson ?? LESSONS.find((l) => !readLessonsDone().includes(l.id))?.id ?? LESSONS[0].id,
  );
  const [picked, setPicked] = useState(null);
  const lesson = LESSONS.find((l) => l.id === active);
  const index = LESSONS.indexOf(lesson);

  const open = (id) => {
    setActive(id);
    setPicked(null);
  };

  const answer = (i) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === lesson.check.correct && !done.includes(lesson.id)) {
      const next = markLessonDone(lesson.id);
      setDone(next);
      onProgress?.(next.length);
      api.kpiEvent({ event: "lesson_completed", session_id: sessionId, detail: lesson.id });
    }
  };

  const answered = picked !== null;
  const right = answered && picked === lesson.check.correct;

  return (
    <Modal labelledBy="learn-title" onClose={onClose} className="help-modal learn-modal">
      <header className="help-modal__head">
        <div>
          <p className="eyebrow">
            Money basics &middot; {done.length} / {LESSONS.length} done
          </p>
          <h2 id="learn-title" className="section-title section-title--xl">
            Learn in one minute
          </h2>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          &times;
        </button>
      </header>

      <div className="learn">
        <ol className="learn__list">
          {LESSONS.map((l, i) => (
            <li key={l.id}>
              <button
                type="button"
                className={`${l.id === active ? "is-active" : ""} ${done.includes(l.id) ? "is-done" : ""}`}
                onClick={() => open(l.id)}
                aria-current={l.id === active ? "true" : undefined}
              >
                <span className="learn__num">{done.includes(l.id) ? "✓" : i + 1}</span>
                {l.title}
              </button>
            </li>
          ))}
        </ol>

        <article className="learn__lesson" aria-live="polite">
          <p className="learn__step">Lesson {index + 1} &middot; about 1 minute</p>
          <h3>{lesson.title}</h3>
          <SpeakButton text={`${lesson.title}. ${lesson.points.join(" ")} Example: ${lesson.example}`} />
          <ul className="learn__points">
            {lesson.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <p className="learn__box">
            <b>Example:</b> {lesson.example}
          </p>
          <p className="learn__box learn__box--game">
            <b>In the game:</b> {lesson.inGame}
          </p>
          <p className="learn__box learn__box--real">
            <b>In real life:</b> {lesson.realLife}
          </p>

          <div className="learn__check">
            <p className="learn__check-q">
              <b>Check yourself:</b> {lesson.check.q}
            </p>
            <div className="learn__options">
              {lesson.check.options.map((option, i) => {
                let state = "";
                if (answered && i === lesson.check.correct) state = "is-right";
                else if (answered && i === picked) state = "is-wrong";
                return (
                  <button key={option} type="button" className={state} onClick={() => answer(i)} disabled={answered}>
                    {option}
                  </button>
                );
              })}
            </div>
            {answered && (
              <p className={`learn__result ${right ? "is-right" : "is-wrong"}`}>
                {right ? "Correct - lesson complete!" : "Not quite - read the points again and try the next lesson."}
              </p>
            )}
          </div>

          <div className="learn__nav">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => open(LESSONS[Math.max(0, index - 1)].id)} disabled={index === 0}>
              &larr; Previous
            </button>
            {index < LESSONS.length - 1 ? (
              <button type="button" className="btn btn--yellow btn--sm" onClick={() => open(LESSONS[index + 1].id)}>
                Next lesson &rarr;
              </button>
            ) : (
              <button type="button" className="btn btn--yellow btn--sm" onClick={onClose}>
                Back to the game
              </button>
            )}
          </div>
        </article>
      </div>
    </Modal>
  );
}
