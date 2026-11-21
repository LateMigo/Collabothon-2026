import { LEVELS, useAiPrefs, writeAiPrefs } from "../utils/aiPrefs.js";

export default function AiPrefsControl({ className = "" }) {
  const prefs = useAiPrefs();
  return (
    <div className={`ai-prefs ${className}`} role="group" aria-label="How the AI explains things">
      <span className="ai-prefs__label">AI answers</span>
      <span className="ai-prefs__seg">
        {LEVELS.map((level) => (
          <button
            key={level.id}
            type="button"
            className={prefs.level === level.id ? "is-on" : ""}
            aria-pressed={prefs.level === level.id}
            onClick={() => writeAiPrefs({ level: level.id })}
          >
            {level.label}
          </button>
        ))}
      </span>
    </div>
  );
}
