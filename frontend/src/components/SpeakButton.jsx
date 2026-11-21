import { useEffect, useState } from "react";
import { speechLang, useAiPrefs } from "../utils/aiPrefs.js";

const supported = typeof window !== "undefined" && "speechSynthesis" in window;

export default function SpeakButton({ text, className = "" }) {
  const { language } = useAiPrefs();
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => () => supported && window.speechSynthesis.cancel(), []);

  if (!supported || !text) return null;

  const toggle = () => {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = speechLang(language);
    utterance.rate = 0.95;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(utterance);
  };

  return (
    <button
      type="button"
      className={`speak-btn ${speaking ? "is-on" : ""} ${className}`}
      onClick={toggle}
      aria-pressed={speaking}
      aria-label={speaking ? "Stop reading" : "Read aloud"}
      title={speaking ? "Stop reading" : "Read aloud"}
    >
      <span aria-hidden="true">{speaking ? "■" : "🔊"}</span> {speaking ? "Stop" : "Read aloud"}
    </button>
  );
}
