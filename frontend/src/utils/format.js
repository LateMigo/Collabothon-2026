// Formatting helpers. The game uses a fictional dollar ($).
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const money = (value) => usd.format(value ?? 0);

/** "$480" for whole amounts, "$480.50" otherwise. */
export const moneyCompact = (value) =>
  Number.isInteger(Math.round((value ?? 0) * 100) / 100) ? usdWhole.format(value ?? 0) : usd.format(value ?? 0);

export const signedMoney = (value) => `${value >= 0 ? "+" : "\u2212"}${usd.format(Math.abs(value ?? 0))}`;

export const pct = (value, digits = 1) => `${value >= 0 ? "+" : "\u2212"}${Math.abs(value ?? 0).toFixed(digits)}%`;

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Company-sized money in millions: "$18M", "$0.4M". */
export const millions = (value) => {
  const v = value ?? 0;
  const text = v < 10 && !Number.isInteger(v) ? v.toFixed(1) : Math.round(v).toString();
  return `$${text}M`;
};

/** A weekly rate in percent: 0.3 -> "0.3%". */
export const ratePct = (value) => `${Number((value ?? 0).toFixed(2))}%`;

export const tone = (value, epsilon = 0.0001) => (value > epsilon ? "up" : value < -epsilon ? "down" : "flat");

export const RISK_LABELS = { low: "Low", elevated: "Elevated", critical: "Critical" };

export const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

export function readStorage(kind, key) {
  try {
    return window[kind].getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(kind, key, value) {
  try {
    if (value === null || value === undefined) window[kind].removeItem(key);
    else window[kind].setItem(key, value);
  } catch {
    /* storage can be blocked (private mode) - the game works without it */
  }
}
