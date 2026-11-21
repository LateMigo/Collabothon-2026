import { useEffect, useState } from "react";

const KEY = "fq.ai.prefs";
const EVENT = "fq-ai-prefs";
const DEFAULTS = { level: "normal", language: "en" };

export const LEVELS = [
  { id: "simple", label: "Simple" },
  { id: "normal", label: "Normal" },
  { id: "detailed", label: "Detailed" },
];
export const LANGUAGES = [
  { id: "en", label: "EN", speech: "en-US" },
  { id: "de", label: "DE", speech: "de-DE" },
  { id: "pl", label: "PL", speech: "pl-PL" },
];

export function readAiPrefs() {
  try {
    return { ...DEFAULTS, ...JSON.parse(window.localStorage.getItem(KEY) || "{}"), language: "en" };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeAiPrefs(next) {
  const prefs = { ...readAiPrefs(), ...next };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: prefs }));
  return prefs;
}

export function useAiPrefs() {
  const [prefs, setPrefs] = useState(readAiPrefs);
  useEffect(() => {
    const onChange = (event) => setPrefs(event.detail ?? readAiPrefs());
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return prefs;
}

export function speechLang(language) {
  return LANGUAGES.find((l) => l.id === language)?.speech ?? "en-US";
}
