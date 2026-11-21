import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GLOSSARY } from "../utils/glossary.js";

const BUBBLE_WIDTH = 320;
const MARGIN = 8;

export default function InfoTip({ term, entry, children }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const bubbleRef = useRef(null);
  const id = useId();
  const info = entry ? GLOSSARY[entry] : null;
  const title = info?.title ?? term;

  const place = useCallback(() => {
    const btn = btnRef.current;
    const bubble = bubbleRef.current;
    if (!btn || !bubble) return;
    const r = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxWidth = vw - MARGIN * 2;

    const measure = (width) => {
      bubble.style.width = `${width}px`;
      return bubble.offsetHeight;
    };
    const widths = [BUBBLE_WIDTH, 400, 480, 560, 640].map((w) => Math.min(w, maxWidth));
    const spaceAbove = r.top - MARGIN - 6;
    const spaceBelow = vh - r.bottom - MARGIN - 6;
    let width = widths[widths.length - 1];
    let height = measure(width);
    let fitsNext = false;
    for (const w of widths) {
      const h = measure(w);
      if (h <= Math.max(spaceAbove, spaceBelow)) {
        width = w;
        height = h;
        fitsNext = true;
        break;
      }
    }
    if (!fitsNext) {
      for (const w of widths) {
        const h = measure(w);
        if (h <= vh - MARGIN * 2) {
          width = w;
          height = h;
          break;
        }
      }
    }
    measure(width);

    let left = r.left + r.width / 2 - width / 2;
    let top;
    if (fitsNext) {
      top = height <= spaceAbove ? r.top - height - 6 : r.bottom + 6;
    } else {
      top = Math.max(MARGIN, Math.min(r.top + r.height / 2 - height / 2, vh - height - MARGIN));
      left = r.right + 10 + width <= vw - MARGIN ? r.right + 10 : r.left - 10 - width;
    }
    left = Math.max(MARGIN, Math.min(left, vw - width - MARGIN));
    const scroll = height > vh - MARGIN * 2;
    setPos({ left, top: scroll ? MARGIN : top, width, scroll });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    const onScroll = (event) => {
      if (!bubbleRef.current?.contains(event.target)) close();
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const bubble = (
    <span
      ref={bubbleRef}
      role="tooltip"
      id={id}
      className={`infotip__bubble ${open && pos ? "is-open" : ""} ${info ? "infotip__bubble--rich" : ""} ${pos?.scroll ? "infotip__bubble--scroll" : ""}`}
      style={pos ? { left: pos.left, top: pos.top, width: pos.width } : { left: -9999, top: 0, width: BUBBLE_WIDTH }}
    >
      {info ? (
        <>
          <strong className="infotip__title">{title}</strong>
          <span className="infotip__what">{info.what}</span>
          {children && <span className="infotip__here">{children}</span>}
          <span className="infotip__row">
            <b>Example</b>
            {info.example}
          </span>
          <span className="infotip__row">
            <b>Why it matters</b>
            {info.why}
          </span>
          <span className="infotip__row infotip__row--tip">
            <b>Tip</b>
            {info.tip}
          </span>
        </>
      ) : (
        children
      )}
    </span>
  );

  return (
    <span className="infotip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        ref={btnRef}
        type="button"
        className="infotip__btn"
        aria-label={`What does “${title}” mean?`}
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.stopPropagation();
            setOpen(false);
          }
        }}
      >
        ?
      </button>
      {typeof document !== "undefined" ? createPortal(bubble, document.body) : null}
    </span>
  );
}
