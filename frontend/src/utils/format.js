const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const money = (value) => usd.format(value ?? 0);

export const moneyCompact = (value) =>
  Number.isInteger(Math.round((value ?? 0) * 100) / 100) ? usdWhole.format(value ?? 0) : usd.format(value ?? 0);

export const signedMoney = (value) => `${value >= 0 ? "+" : "\u2212"}${usd.format(Math.abs(value ?? 0))}`;

export const pct = (value, digits = 1) => `${value >= 0 ? "+" : "\u2212"}${Math.abs(value ?? 0).toFixed(digits)}%`;

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const millions = (value) => {
  const v = value ?? 0;
  const text = v < 10 && !Number.isInteger(v) ? v.toFixed(1) : Math.round(v).toString();
  return `$${text}M`;
};

export const ratePct = (value) => `${Number((value ?? 0).toFixed(2))}%`;

export const tone = (value, epsilon = 0.0001) => (value > epsilon ? "up" : value < -epsilon ? "down" : "flat");

export const RISK_LABELS = { low: "Low", elevated: "Elevated", critical: "Critical" };

export const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

export const everyWeeks = (n) => (n === 1 ? "every week" : `every ${n} weeks`);

export const whenWeek = (week, current) => {
  if (week === null || week === undefined) return "no more this season";
  if (week === current) return "this week";
  if (week === current + 1) return "next week";
  return `in Week ${week}`;
};

export const readyForRent = (game) => game.cash + game.savings.balance + (game.fixed_income?.maturing_this_week ?? 0);

export function rentCheck(game) {
  const { rent, current_week: week } = game;
  const dueNow = rent.enabled && rent.next_due_week === week;
  const ready = readyForRent(game);
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
  }
}
