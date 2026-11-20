import { useId, useMemo, useState } from "react";
import { money, pct } from "../utils/format.js";

const W = 680;
const PAD = { left: 58, right: 20, top: 18, bottom: 38 };

function niceStep(range, targetTicks) {
  const raw = range / Math.max(targetTicks - 1, 1);
  const magnitude = 10 ** Math.floor(Math.log10(raw || 1));
  const residual = raw / magnitude;
  const nice = residual >= 5 ? 10 : residual >= 2 ? 5 : residual >= 1 ? 2 : 1;
  return nice * magnitude;
}

function buildScale(values, mode) {
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (mode === "percent") {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (max - min < 1e-6) {
    min -= mode === "percent" ? 5 : Math.max(1, Math.abs(min) * 0.1);
    max += mode === "percent" ? 5 : Math.max(1, Math.abs(max) * 0.1);
  }
  const step = niceStep(max - min, 5);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  return { lo, hi, ticks };
}

/**
 * Lightweight line chart in plain SVG + React. Shows every company's price_history,
 * with a legend that highlights one company, week markers, a "coming weeks" zone,
 * a hover read-out and a screen-reader data table.
 */
export default function StockChart({ history, companies, totalWeeks, title = "Stock market", subtitle, height = 290 }) {
  const [mode, setMode] = useState("price");
  const [focusId, setFocusId] = useState(null);
  const [hoverWeek, setHoverWeek] = useState(null);
  const titleId = useId();

  const H = height;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const base = history[0]?.prices ?? {};
  const lastWeek = history[history.length - 1]?.week ?? 0;

  const valueOf = (point, id) => {
    const price = point.prices[id] ?? 0;
    if (mode === "price") return price;
    return base[id] ? (price / base[id] - 1) * 100 : 0;
  };

  const scale = useMemo(() => {
    const values = history.flatMap((point) => companies.map((c) => valueOf(point, c.id)));
    return buildScale(values.length ? values : [0], mode);
  }, [history, companies, mode]);

  const x = (week) => PAD.left + (week / totalWeeks) * innerW;
  const y = (value) => PAD.top + (1 - (value - scale.lo) / (scale.hi - scale.lo || 1)) * innerH;
  const formatTick = (v) => (mode === "price" ? `$${v % 1 === 0 ? v : v.toFixed(1)}` : `${v > 0 ? "+" : ""}${v}%`);
  const formatValue = (v) => (mode === "price" ? money(v) : pct(v));
  const weeks = Array.from({ length: totalWeeks + 1 }, (_, i) => i);
  const hoverPoint = hoverWeek !== null ? history.find((p) => p.week === hoverWeek) : null;

  return (
    <section className="chart-card" aria-labelledby={titleId}>
      <header className="chart-card__head">
        <div>
          <p className="eyebrow">Price history</p>
          <h2 id={titleId} className="chart-card__title">
            {title}
          </h2>
          {subtitle && <p className="chart-card__subtitle">{subtitle}</p>}
        </div>
        <div className="segmented" role="group" aria-label="Chart scale">
          <button type="button" aria-pressed={mode === "price"} onClick={() => setMode("price")}>
            $ Price
          </button>
          <button type="button" aria-pressed={mode === "percent"} onClick={() => setMode("percent")}>
            % Change
          </button>
        </div>
      </header>

      <div className="chart-card__plot">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="stock-chart"
          role="img"
          aria-label={`${title}: share prices of ${companies.length} companies from the start to week ${lastWeek}.`}
          onMouseLeave={() => setHoverWeek(null)}
        >
          {lastWeek < totalWeeks && (
            <g className="stock-chart__future">
              <rect x={x(lastWeek)} y={PAD.top} width={x(totalWeeks) - x(lastWeek)} height={innerH} />
              <text x={(x(lastWeek) + x(totalWeeks)) / 2} y={PAD.top + 18} textAnchor="middle">
                Coming weeks
              </text>
            </g>
          )}

          {scale.ticks.map((tick) => (
            <g key={tick} className={`stock-chart__grid ${tick === 0 && mode === "percent" ? "is-zero" : ""}`}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} />
              <text x={PAD.left - 10} y={y(tick)} dy="0.35em" textAnchor="end">
                {formatTick(tick)}
              </text>
            </g>
          ))}

          {weeks.map((week) => (
            <g key={week} className={`stock-chart__week ${week > lastWeek ? "is-future" : ""} ${week === hoverWeek ? "is-hover" : ""}`}>
              <line x1={x(week)} x2={x(week)} y1={PAD.top} y2={PAD.top + innerH} />
              <text x={x(week)} y={H - 12} textAnchor="middle">
                {week === 0 ? "Start" : `W${week}`}
              </text>
            </g>
          ))}

          {companies.map((company) => {
            const dimmed = focusId && focusId !== company.id;
            const focused = focusId === company.id;
            const d = history
              .map((point, i) => `${i === 0 ? "M" : "L"}${x(point.week).toFixed(1)},${y(valueOf(point, company.id)).toFixed(1)}`)
              .join(" ");
            return (
              <g
                key={company.id}
                className={`stock-chart__series ${dimmed ? "is-dimmed" : ""} ${focused ? "is-focused" : ""}`}
                style={{ "--series": company.color }}
              >
                {history.length > 1 && <path d={d} className="stock-chart__line" />}
                {history.map((point) => {
                  const bankrupt = (point.prices[company.id] ?? 0) <= 0;
                  const cx = x(point.week);
                  const cy = y(valueOf(point, company.id));
                  return bankrupt ? (
                    <g key={point.week} className="stock-chart__bust">
                      <line x1={cx - 6} y1={cy - 6} x2={cx + 6} y2={cy + 6} />
                      <line x1={cx - 6} y1={cy + 6} x2={cx + 6} y2={cy - 6} />
                    </g>
                  ) : (
                    <circle key={point.week} cx={cx} cy={cy} r={focused ? 5.5 : 4} className="stock-chart__dot" />
                  );
                })}
              </g>
            );
          })}

          {history.map((point) => (
            <rect
              key={point.week}
              className="stock-chart__hit"
              x={x(point.week) - innerW / totalWeeks / 2}
              y={PAD.top}
              width={innerW / totalWeeks}
              height={innerH}
              onMouseEnter={() => setHoverWeek(point.week)}
            />
          ))}
        </svg>

        {hoverPoint && (
          <div
            className={`chart-tooltip ${hoverPoint.week > totalWeeks / 2 ? "is-left" : ""}`}
            style={{ left: `${(x(hoverPoint.week) / W) * 100}%` }}
            aria-hidden="true"
          >
            <strong>{hoverPoint.week === 0 ? "Start" : `Week ${hoverPoint.week}`}</strong>
            {companies
              .map((c) => ({ ...c, value: valueOf(hoverPoint, c.id) }))
              .sort((a, b) => b.value - a.value)
              .map((c) => (
                <span key={c.id} className="chart-tooltip__row">
                  <i style={{ background: c.color }} />
                  {c.ticker}
                  <b>{(hoverPoint.prices[c.id] ?? 0) <= 0 ? "Bankrupt" : formatValue(c.value)}</b>
                </span>
              ))}
          </div>
        )}
      </div>

      <ul className="chart-legend" aria-label="Highlight a company">
        {companies.map((company) => {
          const latest = history[history.length - 1]?.prices[company.id] ?? 0;
          return (
            <li key={company.id}>
              <button
                type="button"
                aria-pressed={focusId === company.id}
                className={focusId && focusId !== company.id ? "is-dimmed" : ""}
                onClick={() => setFocusId((current) => (current === company.id ? null : company.id))}
              >
                <i style={{ background: company.color }} aria-hidden="true" />
                <span className="chart-legend__ticker">{company.ticker}</span>
                <span className="chart-legend__value">{latest <= 0 ? "Bankrupt" : money(latest)}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <table className="sr-only">
        <caption>{title} data</caption>
        <thead>
          <tr>
            <th scope="col">Week</th>
            {companies.map((c) => (
              <th key={c.id} scope="col">
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {history.map((point) => (
            <tr key={point.week}>
              <th scope="row">{point.week === 0 ? "Start" : `Week ${point.week}`}</th>
              {companies.map((c) => (
                <td key={c.id}>{money(point.prices[c.id] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
