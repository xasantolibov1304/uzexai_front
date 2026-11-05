import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { buildChart } from "./chartData.js";
import { useLang } from "./i18n.jsx";

// Checked with the colour-blind validator against the white card. Fixed order, never cycled:
// chartData.js gives up beyond this many lines. Text never uses these.
const SERIES_COLORS = ["#d97a2b", "#2f7fc1", "#2e9e6b", "#b04fb0", "#8d8a1f"];

const LINE_HEIGHT = 240;
const PLOT = { top: 22, right: 16, bottom: 26, left: 58 };
const END_LABEL_MIN_GAP = 16;
const MULTI_LABEL_MIN_WIDTH = 400;

const exactFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const exact = (value) => (value == null ? "—" : exactFormat.format(value));

function compact(value, t) {
  const abs = Math.abs(value);
  const steps = [
    [1e12, t.chartUnits.trillion],
    [1e9, t.chartUnits.billion],
    [1e6, t.chartUnits.million],
    [1e3, t.chartUnits.thousand],
  ];
  const step = steps.find(([size]) => abs >= size);
  if (!step) return exactFormat.format(value);
  const scaled = value / step[0];
  const digits = Math.abs(scaled) >= 100 ? 0 : 1;
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }).format(scaled)} ${step[1]}`;
}

// Month numbers read as names: 2024 and 2025 share the same "Yan ... Dek" axis.
function timeLabel(label, timeKind, t) {
  const text = String(label);
  if (timeKind !== "month") return text;
  const yearMonth = text.match(/^(\d{4})-(\d{1,2})/);
  if (yearMonth) return `${t.months[Number(yearMonth[2]) - 1] ?? yearMonth[2]} ${yearMonth[1]}`;
  return t.months[Number(text) - 1] ?? text;
}

function niceTicks(min, max, count = 4) {
  const span = max - min || Math.abs(max) || 1;
  const rough = span / count;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough);
  const start = Math.floor(min / step) * step;
  const ticks = [];
  for (let v = start; v < max + step; v += step) ticks.push(v);
  return ticks;
}

function Tooltip({ tip }) {
  if (!tip) return null;
  return (
    <div className="chart__tip" style={{ left: tip.x, top: tip.y }} role="status">
      <div className="chart__tip-title">{tip.title}</div>
      {tip.rows.map((row) => (
        <div className="chart__tip-row" key={row.name || "value"}>
          {row.color && <i style={{ background: row.color }} />}
          <b>{row.value}</b>
          {row.name && <span>{row.name}</span>}
        </div>
      ))}
    </div>
  );
}

function BarChart({ chart }) {
  const { t } = useLang();
  const boxRef = useRef(null);
  const [tip, setTip] = useState(null);
  const grouped = chart.series.length > 1;
  const max = Math.max(...chart.series.flatMap((s) => s.points.map((p) => p.value))) || 1;
  const categories = chart.series[0].points.map((p) => p.label);

  const show = (e, label, index) => {
    const box = boxRef.current.getBoundingClientRect();
    const row = e.currentTarget.getBoundingClientRect();
    const pointerX = e.clientX || row.left + row.width / 2;
    setTip({
      x: Math.max(0, Math.min(pointerX - box.left + 12, box.width - 180)),
      y: row.top - box.top + row.height + 4,
      title: label,
      rows: chart.series.map((s, i) => ({
        name: grouped ? s.name : "",
        color: grouped ? SERIES_COLORS[i] : null,
        value: exact(s.points[index].value),
      })),
    });
  };

  return (
    <div className="chart__bars" ref={boxRef} onPointerLeave={() => setTip(null)}>
      {categories.map((label, index) => (
        <div
          key={label}
          className="chart__row"
          tabIndex={0}
          aria-label={`${label}: ${chart.series.map((s) => `${grouped ? `${s.name} ` : ""}${exact(s.points[index].value)}`).join(", ")}`}
          onPointerMove={(e) => show(e, label, index)}
          onFocus={(e) => show(e, label, index)}
          onBlur={() => setTip(null)}
        >
          <span className="chart__label" title={label}>
            {label}
          </span>
          <span className="chart__tracks">
            {chart.series.map((s, i) => (
              <span className="chart__track" key={s.name}>
                <i
                  className="chart__bar"
                  style={{
                    width: `${Math.max(0.5, (s.points[index].value / max) * 100)}%`,
                    background: SERIES_COLORS[i],
                  }}
                />
                <span className="chart__value">{compact(s.points[index].value, t)}</span>
              </span>
            ))}
          </span>
        </div>
      ))}
      <Tooltip tip={tip} />
    </div>
  );
}

// Gaps stay gaps: a line must not be drawn across months a series doesn't have.
function linePath(points, x, y) {
  let path = "";
  let drawing = false;
  points.forEach((p, i) => {
    if (p.value == null) {
      drawing = false;
      return;
    }
    path += `${drawing ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)} `;
    drawing = true;
  });
  return path;
}

function LineChart({ chart }) {
  const { t } = useLang();
  const boxRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(null);
  const { series } = chart;
  const multiple = series.length > 1;
  const labels = series[0].points.map((p) => p.label);
  const lastIndex = labels.length - 1;

  useLayoutEffect(() => {
    const el = boxRef.current;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const values = series.flatMap((s) => s.points.map((p) => p.value)).filter((v) => v != null);
  const low = Math.min(...values);
  const high = Math.max(...values);
  // Prices sit far from zero, so a zero baseline would flatten them; amounts keep it when near.
  const floor = low >= 0 && low < high * 0.5 ? 0 : low;
  const ticks = niceTicks(floor, high);
  const bottom = ticks[0];
  const top = ticks[ticks.length - 1];
  const plotWidth = Math.max(0, width - PLOT.left - PLOT.right);
  const plotHeight = LINE_HEIGHT - PLOT.top - PLOT.bottom;
  const x = (i) => PLOT.left + (lastIndex > 0 ? (i / lastIndex) * plotWidth : 0);
  const y = (v) => PLOT.top + (1 - (v - bottom) / (top - bottom || 1)) * plotHeight;
  const labelEvery = Math.max(1, Math.ceil(labels.length / Math.max(2, Math.floor(plotWidth / 56))));

  // Each line's latest value goes above its point, or below if another label is already there.
  // On a phone several lines leave no clear spot, so their values stay in the tooltip and table.
  const labelsFit = series.length === 1 || plotWidth >= MULTI_LABEL_MIN_WIDTH;
  const ends = series
    .map((s, i) => {
      const index = s.points.reduce((found, p, at) => (p.value != null ? at : found), -1);
      return { key: s.name, color: SERIES_COLORS[i], index, value: s.points[index].value };
    })
    .sort((a, b) => b.value - a.value)
    .reduce((kept, end) => {
      const labelY = (offset) => y(end.value) + offset;
      const clearAt = (at) =>
        kept.every((k) => k.labelY == null || k.index !== end.index || Math.abs(k.labelY - at) >= END_LABEL_MIN_GAP);
      const spot = [labelY(-10), labelY(18)].find(clearAt);
      kept.push({ ...end, labelY: labelsFit ? spot : undefined });
      return kept;
    }, []);

  const nearest = (clientX) => {
    const box = boxRef.current.getBoundingClientRect();
    const ratio = (clientX - box.left - PLOT.left) / (plotWidth || 1);
    return Math.max(0, Math.min(lastIndex, Math.round(ratio * lastIndex)));
  };

  const onKey = (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const step = e.key === "ArrowRight" ? 1 : -1;
    setActive((i) => Math.max(0, Math.min(lastIndex, (i ?? (step > 0 ? -1 : lastIndex + 1)) + step)));
  };

  const tip =
    active != null && width
      ? {
          x: x(active) + 192 > width ? Math.max(0, x(active) - 192) : x(active) + 12,
          y: PLOT.top,
          title: timeLabel(labels[active], chart.timeKind, t),
          rows: series.map((s, i) => ({
            name: multiple ? s.name : "",
            color: multiple ? SERIES_COLORS[i] : null,
            value: exact(s.points[active].value),
          })),
        }
      : null;

  const summary = series
    .map((s) => {
      const known = s.points.filter((p) => p.value != null);
      const first = known[0];
      const final = known[known.length - 1];
      return `${multiple ? `${s.name}: ` : ""}${timeLabel(first.label, chart.timeKind, t)} ${exact(first.value)}, ${timeLabel(final.label, chart.timeKind, t)} ${exact(final.value)}`;
    })
    .join("; ");

  return (
    <div
      className="chart__line"
      ref={boxRef}
      tabIndex={0}
      role="img"
      aria-label={summary}
      onPointerMove={(e) => setActive(nearest(e.clientX))}
      onPointerLeave={() => setActive(null)}
      onKeyDown={onKey}
      onBlur={() => setActive(null)}
    >
      {width > 0 && (
        <svg width={width} height={LINE_HEIGHT} aria-hidden="true">
          {ticks.map((tick) => (
            <g key={tick}>
              <line className="chart__grid" x1={PLOT.left} x2={width - PLOT.right} y1={y(tick)} y2={y(tick)} />
              <text className="chart__axis" x={PLOT.left - 8} y={y(tick) + 4} textAnchor="end">
                {compact(tick, t)}
              </text>
            </g>
          ))}
          {labels.map((label, i) =>
            i % labelEvery === 0 ? (
              <text className="chart__axis" key={label} x={x(i)} y={LINE_HEIGHT - 6} textAnchor={i === 0 ? "start" : "middle"}>
                {timeLabel(label, chart.timeKind, t)}
              </text>
            ) : null
          )}
          {active != null && (
            <line className="chart__crosshair" x1={x(active)} x2={x(active)} y1={PLOT.top} y2={LINE_HEIGHT - PLOT.bottom} />
          )}
          {series.map((s, i) => (
            <path className="chart__path" key={s.name} d={linePath(s.points, x, y)} stroke={SERIES_COLORS[i]} />
          ))}
          {active != null
            ? series.map((s, i) =>
                s.points[active].value != null ? (
                  <circle
                    className="chart__dot"
                    key={s.name}
                    cx={x(active)}
                    cy={y(s.points[active].value)}
                    r="4.5"
                    fill={SERIES_COLORS[i]}
                  />
                ) : null
              )
            : ends.map((end) => (
                <circle className="chart__dot" key={end.key} cx={x(end.index)} cy={y(end.value)} r="4.5" fill={end.color} />
              ))}
          {ends
            .filter((end) => end.labelY != null)
            .map((end) => (
              <text className="chart__end" key={end.key} x={x(end.index) - 8} y={end.labelY} textAnchor="end">
                {compact(end.value, t)}
              </text>
            ))}
        </svg>
      )}
      <Tooltip tip={tip} />
    </div>
  );
}

function ChartTable({ chart }) {
  const { t } = useLang();
  const grouped = chart.series.length > 1;
  return (
    <div className="trace__table chart__table">
      <table>
        <thead>
          <tr>
            <th>{chart.type === "line" ? t.chartPeriod : t.chartCategory}</th>
            {chart.series.map((s) => (
              <th key={s.name}>{grouped ? s.name : t.chartMetric[chart.kind]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.series[0].points.map((point, i) => (
            <tr key={point.label}>
              <td>{chart.type === "line" ? timeLabel(point.label, chart.timeKind, t) : point.label}</td>
              {chart.series.map((s) => (
                <td key={s.name}>{exact(s.points[i].value)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AnswerChart({ steps, answer }) {
  const { t, lang } = useLang();
  const [view, setView] = useState("chart");
  const chart = useMemo(() => buildChart(steps, answer, lang), [steps, answer, lang]);
  if (!chart) return null;

  return (
    <figure className="chart">
      <figcaption className="chart__head">
        <span className="chart__title">
          {t.chartMetric[chart.kind]}
          {chart.truncated && <small> · {t.chartTop(chart.series[0].points.length)}</small>}
        </span>
        <span className="chart__views" role="group" aria-label={t.chartView}>
          <button type="button" aria-pressed={view === "chart"} onClick={() => setView("chart")}>
            {t.chartViewChart}
          </button>
          <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>
            {t.chartViewTable}
          </button>
        </span>
      </figcaption>
      {chart.series.length > 1 && (
        <div className="chart__legend">
          {chart.series.map((s, i) => (
            <span key={s.name}>
              <i style={{ background: SERIES_COLORS[i] }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      {view === "table" ? (
        <ChartTable chart={chart} />
      ) : chart.type === "line" ? (
        <LineChart chart={chart} />
      ) : (
        <BarChart chart={chart} />
      )}
    </figure>
  );
}
