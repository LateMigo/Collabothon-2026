import { useEffect } from "react";
import { LESSONS } from "../utils/lessons.js";

export default function LessonNudge({ nudge, onOpen, onDismiss }) {
  useEffect(() => {
    if (!nudge) return undefined;
    const timer = window.setTimeout(onDismiss, 16000);
    return () => window.clearTimeout(timer);
  }, [nudge, onDismiss]);

  if (!nudge) return null;
  const lesson = LESSONS.find((l) => l.id === nudge.lessonId);
  if (!lesson) return null;

  return (
    <aside className="lesson-nudge" role="status" aria-live="polite">
      <span className="lesson-nudge__icon" aria-hidden="true">
        ✦
      </span>
      <div className="lesson-nudge__text">
        <p className="lesson-nudge__why">{nudge.why}</p>
        <p className="lesson-nudge__title">1-minute lesson: {lesson.title}</p>
      </div>
      <button type="button" className="btn btn--yellow btn--sm" onClick={() => onOpen(lesson.id)}>
        Open
      </button>
      <button type="button" className="lesson-nudge__close" onClick={onDismiss} aria-label="Dismiss">
        &times;
      </button>
    </aside>
  );
}

export function pickNudge(summary, quizScore, lessonsDone, alreadyNudged) {
  const candidates = [];
  if ((summary.expenses ?? []).some((e) => e.from_shares > 0)) {
    candidates.push({ lessonId: "emergency", why: "A surprise bill forced you to sell shares in a hurry." });
  }
  if ((summary.bankruptcies ?? []).some((b) => b.player_shares > 0)) {
    candidates.push({ lessonId: "diversify", why: "A company you owned just went bankrupt." });
  }
  if (summary.fixed_income?.defaulted?.length) {
    candidates.push({ lessonId: "bonds", why: "A bond you held defaulted." });
  }
  if (summary.rent?.paid && summary.cash_after < (summary.rent?.new_rent ?? 0)) {
    candidates.push({ lessonId: "budget", why: "After rent day there's less cash left than one month of rent." });
  }
  if ((summary.decisions ?? []).some((d) => d.reason === "gut" && !d.went_your_way)) {
    candidates.push({ lessonId: "shares", why: "A gut-feeling trade went against you this week." });
  }
  const quizLesson = { 3: "emergency", 4: "diversify", 6: "emergency", 9: "interest", 11: "bonds", 12: "accounts" };
  if (quizScore?.[summary.week] === false && quizLesson[summary.week]) {
    candidates.push({ lessonId: quizLesson[summary.week], why: "That quiz question was tricky." });
  }
  return candidates.find((c) => !lessonsDone.includes(c.lessonId) && !alreadyNudged.includes(c.lessonId)) ?? null;
}
