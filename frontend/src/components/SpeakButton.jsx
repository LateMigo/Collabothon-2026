import { useEffect, useState } from "react";

const supported = typeof window !== "undefined" && "speechSynthesis" in window;

// Voices load asynchronously in Chrome; keep a fresh copy.
let cachedVoices = [];
if (supported) {
  const load = () => (cachedVoices = window.speechSynthesis.getVoices());
  load();
  window.speechSynthesis.addEventListener?.("voiceschanged", load);
}

export default function SpeakButton({ text, className = "" }) {
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
    // Always use an English voice (never the Polish system voice).
    const voices = (cachedVoices.length ? cachedVoices : synth.getVoices()).filter((v) =>
      v.lang.toLowerCase().replace("_", "-").startsWith("en")
    );
    const voice =
      voices.find((v) => /Google UK English/i.test(v.name)) ||
      voices.find((v) => v.lang.toLowerCase().replace("_", "-") === "en-gb") ||
      voices.find((v) => /Google US English/i.test(v.name)) ||
      voices[0];
    utterance.lang = voice?.lang || "en-GB";
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
