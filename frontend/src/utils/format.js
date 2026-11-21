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

/** "every week" / "every 4 weeks" */
export const everyWeeks = (n) => (n === 1 ? "every week" : `every ${n} weeks`);

/** When something happens relative to the current week: "this week", "next week", "in Week 8". */
export const whenWeek = (week, current) => {
  if (week === null || week === undefined) return "no more this season";
  if (week === current) return "this week";
  if (week === current + 1) return "next week";
  return `in Week ${week}`;
};

/** Cash a player can count on at this week's close: cash + savings + bonds/deposits that mature now. */
export const readyForRent = (game) => game.cash + game.savings.balance + (game.fixed_income?.maturing_this_week ?? 0);

/** Is rent due at this week's close, and can the money the player can count on cover it? */
export function rentCheck(game) {
  const { rent, current_week: week } = game;
  const dueNow = rent.enabled && rent.next_due_week === week;
  const ready = readyForRent(game);
  // Dividends due at this week's close are paid before the rent - but news can still cut them.
  const dividends = game.modifiers.enable_dividends
    ? game.companies
        .filter((c) => c.pays_dividend_this_week && c.shares_owned > 0)
        .reduce((sum, c) => sum + c.shares_owned * c.dividend_per_share, 0)
    : 0;
  const short = dueNow && ready < rent.monthly_rent;
  return {
    dueNow,
    ready,
    dividends,
    short,
    // only the expected dividends would save the week: risky, but not a sure game over
    onlyIfDividends: short && ready + dividends >= rent.monthly_rent,
    shortfall: Math.max(0, rent.monthly_rent - ready),
  };
}

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
