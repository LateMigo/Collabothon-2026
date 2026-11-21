import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/*
 * First-week walkthrough: dims the screen, highlights one part of the game at a time and explains it in a small
 * card ("this is your money, this is the news, this is where you end the week..."). Steps whose element is not on
 * screen (for example the collapsed top bar on a phone) are skipped automatically.
 */

const STEPS = [
  {
    target: null,
    title: "Welcome to the exchange!",
    text: "This is your trading booth. Let's take a quick look around - it takes less than a minute. You can skip it at any time.",
  },
  {
    target: ".hud-stats",
    title: "Your money",
    text: "Cash you can spend right now, the value of your shares, your savings and bonds. Net worth adds it all up - that's your score.",
  },
  {
    target: ".hud-rent",
    title: "Rent",
    text: "Every few weeks you must pay rent. Keep enough cash or savings for it - if you can't pay, the game may end.",
  },
  {
    target: ".news-panel",
    title: "The news",
    text: "Each week brings new headlines. Some move prices right away, some only weeks later, and some are just noise. Read them before you trade.",
  },
  {
    target: ".chart-card",
    title: "The stock chart",
    text: "How every company's share price has moved so far. Watch for moves that come weeks after a story.",
  },
  {
    target: ".carousel",
    title: "The companies",
    text: "One card per company: price, dividend and bankruptcy risk. Flip a card for its hard data, and press Buy / Sell to trade. New companies join every 2 weeks.",
  },
  {
    target: ".news-board",
    title: "The old news board",
    text: "Every earlier headline gets pinned up here when a week ends. Come back to check what was said, and when - some stories only move prices weeks later.",
  },
  {
    target: ".vault:not(.bond-desk)",
    title: "Savings account",
    text: "A safe place for money you don't want to risk. It earns a little interest every week and pays the rent if your cash runs short.",
  },
  {
    target: ".bond-desk",
    title: "Bonds and deposits",
    text: "Lend money for a fixed time at a fixed interest rate. Safer than shares - but the money is locked until it pays back.",
  },
  {
    target: ".advisor",
    title: "The advisor",
    text: "Stuck? Ask the advisor for a hint. Careful: advisors can be wrong too.",
  },
  {
    target: ".holdings",
    title: "Your investments",
    text: "Everything you own and whether it's making or losing money right now.",
  },
  {
    target: ".lexo",
    title: "Berg",
    text: "Don't know a money word? Ask Berg - dividend, bond, inflation, anything. He explains ideas in plain words, but he never tells you what to buy.",
  },
  {
    target: ".market__help",
    title: "Learn and quizzes",
    text: "New to money words? Open Learn for one-minute lessons on budgeting, saving and bank products. And after every week you get one quick quiz question - collect knowledge points!",
  },
  {
    target: ".action-bar",
    title: "End the week",
    text: "When you're ready, press End Week. The market reacts, dividends and interest are paid, and a summary explains what happened and why. Good luck!",
  },
];

const PAD = 8;
const CARD_W = 340;
const GAP = 14;

function findTarget(selector) {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
}

export default function GuidedTour({ onClose }) {
  const steps = useRef(STEPS.filter((s) => !s.target || findTarget(s.target))).current;
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [cardPos, setCardPos] = useState(null);
  const cardRef = useRef(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  const measure = useCallback(() => {
    const el = findTarget(step.target);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({
      top: Math.max(PAD / 2, r.top - PAD),
      left: Math.max(PAD / 2, r.left - PAD),
      width: Math.min(window.innerWidth - PAD, r.width + PAD * 2),
      height: Math.min(window.innerHeight - PAD, r.height + PAD * 2),
    });
  }, [step]);

  // bring the highlighted part into view, then follow it while the page scrolls or resizes
  useEffect(() => {
    const el = findTarget(step.target);
    if (el) {
      const r = el.getBoundingClientRect();
      const fixed = getComputedStyle(el).position === "fixed";
      if (!fixed && (r.top < 90 || r.bottom > window.innerHeight)) {
        el.scrollIntoView({ block: r.height > window.innerHeight * 0.7 ? "start" : "center", behavior: "smooth" });
      }
    }
    measure();
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    const timer = window.setTimeout(measure, 450); // after the smooth scroll settles
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [step, measure]);

  // place the card next to the highlight: below, above, beside, or centred if nothing fits
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(CARD_W, vw - 16);
    const h = card.offsetHeight;
    let top;
    let left;
    if (!rect) {
      top = (vh - h) / 2;
      left = (vw - w) / 2;
    } else if (rect.top + rect.height + GAP + h <= vh - 8) {
      top = rect.top + rect.height + GAP;
      left = rect.left + rect.width / 2 - w / 2;
    } else if (rect.top - GAP - h >= 8) {
      top = rect.top - GAP - h;
      left = rect.left + rect.width / 2 - w / 2;
    } else if (rect.left + rect.width + GAP + w <= vw - 8) {
      left = rect.left + rect.width + GAP;
      top = rect.top + rect.height / 2 - h / 2;
    } else if (rect.left - GAP - w >= 8) {
      left = rect.left - GAP - w;
      top = rect.top + rect.height / 2 - h / 2;
    } else {
      top = vh - h - 12;
      left = (vw - w) / 2;
    }
    setCardPos({
      top: Math.max(8, Math.min(top, vh - h - 8)),
      left: Math.max(8, Math.min(left, vw - w - 8)),
      width: w,
    });
  }, [rect, index]);

  useEffect(() => {
    if (cardPos) cardRef.current?.focus({ preventScroll: true });
  }, [index, cardPos]);

  const next = () => (last ? onClose() : setIndex((i) => i + 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));

  // keyboard: arrows move through the tour, Escape closes it (listening on the window, so focus doesn't matter)
  const keys = useRef(null);
  keys.current = (event) => {
    if (event.key === "Escape") onClose();
    else if (event.key === "ArrowRight") next();
    else if (event.key === "ArrowLeft") back();
    else return;
    event.preventDefault();
  };
  useEffect(() => {
    const onKey = (event) => keys.current(event);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="tour">
      {/* blocks clicks on the game while the tour runs */}
      <div className="tour__blocker" onClick={next} aria-hidden="true" />
      {rect ? (
        <div
          className="tour__spotlight"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
          aria-hidden="true"
        />
      ) : (
        <div className="tour__dim" aria-hidden="true" />
      )}
      <div
        ref={cardRef}
        className="tour__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-text"
        tabIndex={-1}
        style={cardPos ? { top: cardPos.top, left: cardPos.left, width: cardPos.width } : { visibility: "hidden" }}
      >
        <p className="tour__count">
          Quick tour &middot; {index + 1} / {steps.length}
        </p>
        <h2 id="tour-title" className="tour__title">
          {step.title}
        </h2>
        <p id="tour-text" className="tour__text">
          {step.text}
        </p>
        <div className="tour__dots" aria-hidden="true">
          {steps.map((s, i) => (
            <span key={s.title} className={i === index ? "is-active" : ""} />
          ))}
        </div>
        <div className="tour__actions">
          <button type="button" className="tour__skip" onClick={onClose}>
            {last ? "Close" : "Skip tour"}
          </button>
          <span className="tour__nav">
            {index > 0 && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={back}>
                &larr; Back
              </button>
            )}
            <button type="button" className="btn btn--yellow btn--sm" onClick={next}>
              {last ? "Let's play!" : index === 0 ? "Show me" : "Next →"}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
