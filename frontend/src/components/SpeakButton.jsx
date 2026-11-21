import { useEffect, useState } from "react";
import { speechLang, useAiPrefs } from "../utils/aiPrefs.js";

const supported = typeof window !== "undefined" && "speechSynthesis" in window;

export default function SpeakButton({ text, className = "" }) {
  const { language } = useAiPrefs();
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (supported) window.speechSynthesis.getVoices(); // warm up the voice list
    return () => supported && window.speechSynthesis.cancel();
  }, []);

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
    const lang = speechLang(language);
    utterance.lang = lang;
    // Windows/Chrome often ignores `lang` and keeps the system (e.g. Polish) voice,
    // so pick a matching voice explicitly.
    const voices = synth.getVoices();
    const prefix = lang.slice(0, 2).toLowerCase();
    const voice =
      voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(prefix));
    if (voice) utterance.voice = voice;
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
