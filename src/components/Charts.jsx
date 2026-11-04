import { useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLang } from "../i18n/LangContext";
import { Segmented } from "./ui";

// Palitra validatsiyadan o'tgan (dataviz/validate_palette.js): asosiy seriya + "to'liq bo'lmagan davr" belgisi.
export const SERIES = "#0D9488";
export const PARTIAL = "#D97706";
const GRID = "#EEF1F5";
const AXIS = "#6B7280";
const axisTick = { fill: AXIS, fontSize: 12 };

function Tip({ active, payload, format, labelFormat }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="chart-tip">
      <b>{labelFormat ? labelFormat(p) : p.label}</b>
      <span className="mono">{format(p.value, p)}</span>
      {p.extra && <div className="muted">{p.extra}</div>}
    </div>
  );
}

/** Ko'rinishni grafik / jadval o'rtasida almashtirish (jadval — ekran o'quvchi va aniq qiymatlar uchun). */
function ChartOrTable({ data, format, valueLabel, children }) {
  const { t } = useLang();
  const [mode, setMode] = useState("chart");
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <Segmented value={mode} onChange={setMode} options={[["chart", t.common.chart], ["table", t.common.table]]} label={t.common.chart} />
      </div>
      {mode === "chart" ? (
        children
      ) : (
        <div className="table-wrap" style={{ maxHeight: 320, overflowY: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th />
                <th className="right">{valueLabel}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.key ?? d.label}>
                  <td>{d.label}</td>
                  <td className="num">{format(d.value, d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Vertikal ustunlar (vaqt bo'yicha). data: [{key,label,value,partial?,extra?}] */
export function ColumnChart({ data, format, axisFormat, valueLabel, height = 280, partialLabel }) {
  const hasPartial = data.some((d) => d.partial);
  return (
    <ChartOrTable data={data} format={format} valueLabel={valueLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "#E1E6ED" }} interval="preserveStartEnd" minTickGap={12} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={64} tickFormatter={axisFormat} />
          <Tooltip cursor={{ fill: "rgba(13,148,136,0.08)" }} content={<Tip format={format} />} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.key ?? d.label} fill={d.partial ? PARTIAL : SERIES} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {hasPartial && partialLabel && (
        <div className="legend">
          <span>
            <i style={{ background: PARTIAL }} />
            {partialLabel}
          </span>
        </div>
      )}
    </ChartOrTable>
  );
}

/** Chiziqli grafik (narx dinamikasi). data: [{key,label,value}] — value=null bo'lsa uzilish. */
export function TrendChart({ data, format, axisFormat, valueLabel, height = 300 }) {
  return (
    <ChartOrTable data={data} format={format} valueLabel={valueLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: "#E1E6ED" }} interval="preserveStartEnd" minTickGap={16} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={72} tickFormatter={axisFormat} domain={["auto", "auto"]} />
          <Tooltip cursor={{ stroke: AXIS, strokeDasharray: "3 3" }} content={<Tip format={format} />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={SERIES}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2, fill: SERIES }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartOrTable>
  );
}

/** Gorizontal reyting (top-N). rows: [{key,label,value,to?,sub?}] — HTML'da, nomlar uzun bo'lgani uchun. */
export function RankBars({ rows, format }) {
  const max = Math.max(...rows.map((r) => r.value || 0), 1);
  return (
    <div className="hbars">
      {rows.map((r) => {
        const inner = (
          <>
            <span className="hbar__label" title={r.title || r.label}>
              {r.label}
              {r.sub && <span className="muted"> · {r.sub}</span>}
            </span>
            <span className="hbar__value">{format(r.value, r)}</span>
            <span className="hbar__track" aria-hidden="true">
              <span className="hbar__fill" style={{ width: `${Math.max(((r.value || 0) / max) * 100, 0.5)}%`, display: "block" }} />
            </span>
          </>
        );
        return r.to ? (
          <Link key={r.key} to={r.to} className="hbar">
            {inner}
          </Link>
        ) : (
          <div key={r.key} className="hbar">
            {inner}
          </div>
        );
      })}
    </div>
  );
}
