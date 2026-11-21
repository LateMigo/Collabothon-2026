import { useId, useState } from "react";

/**
 * A small [?] button with one plain-language sentence. Opens on hover, keyboard focus
 * or tap; closes on blur, mouse leave or Escape. The bubble is positioned against the
 * nearest positioned ancestor (a stats row), so it never spills outside the card.
 */
export default function InfoTip({ term, children }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className="infotip" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="infotip__btn"
        aria-label={`What does “${term}” mean?`}
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
      <span role="tooltip" id={id} className={`infotip__bubble ${open ? "is-open" : ""}`}>
        {children}
      </span>
    </span>
  );
}
