// Decides whether an answer's query results can be charted, and how.
// It prefers no chart to a misleading one: when in doubt, it returns null.

const MIN_POINTS = 2;
const MAX_BARS = 12;
const MAX_LINE_POINTS = 60;
const MIN_LINE_POINTS = 3;
const MAX_LINE_SERIES = 5; // One per colour in Chart.jsx. A sixth year means no chart, not a reused colour.

const TIME = /(^|_)(year|month|date|day|period)($|_)/i;
const IDENTIFIER = /(^|_)(id|inn|stir|code|hs)($|_)/i;
const NOT_A_METRIC = /cancel|rank|position|share|pct|percent|lot|diff|delta|change|growth/i;
const NOT_A_LABEL = /(^|_)(unit|currency|status)($|_)/i;
const YEAR_IN_NAME = /(?:^|_)(20\d\d)(?:_|$)/;

// In priority order: a result holding a price is about the price, not the volume beside it.
const METRICS = [
  ["price", /price/i],
  ["rate", /(^|_)rate($|_)/i],
  ["uzs", /uzs|turnover/i],
  ["usd", /usd/i],
  ["amount", /(^|_)amount($|_)/i],
  ["volume", /volume|tonn/i],
  ["count", /(^|_)(deals?|count|cnt|n)($|_)/i],
];

const kindOf = (column) => METRICS.find(([, pattern]) => pattern.test(column))?.[0] ?? null;
const distinct = (values) => new Set(values.filter((v) => v != null));
const isNumber = (v) => typeof v === "number" && Number.isFinite(v);

function columnValues(table, column) {
  const i = table.columns.indexOf(column);
  return table.rows.map((row) => row[i]);
}

const singleValue = (table, column) => {
  if (!table.columns.includes(column)) return null;
  const values = distinct(columnValues(table, column));
  return values.size === 1 ? [...values][0] : null;
};

// Tonnes next to kilograms, or so'm next to dollars, can't share one scale.
function resolveKind(table, kind) {
  const unitKnown = singleValue(table, "unit") != null;
  if (kind === "price" || kind === "volume") return unitKnown ? kind : null;
  if (kind === "amount") {
    const currency = singleValue(table, "currency");
    if (currency === "USD") return "usd";
    if (currency === "UZS") return "uzs";
    return null;
  }
  return kind;
}

function pickMetric(table, candidates) {
  const usable = candidates.filter((c) => !TIME.test(c) && !IDENTIFIER.test(c) && !NOT_A_METRIC.test(c));
  for (const [kind] of METRICS) {
    const column = usable.find((c) => kindOf(c) === kind);
    if (column) {
      const resolved = resolveKind(table, kind);
      return resolved ? { column, kind: resolved } : null;
    }
  }
  return null;
}

function pickLabel(table, lang) {
  const strings = table.columns.filter(
    (c) =>
      !TIME.test(c) &&
      !IDENTIFIER.test(c) &&
      !NOT_A_LABEL.test(c) &&
      columnValues(table, c).every((v) => typeof v === "string")
  );
  const uzVariant = lang === "uz" ? strings.find((c) => /_uz$/.test(c)) : null;
  if (uzVariant) return uzVariant;
  return strings.find((c) => !/_uz$/.test(c)) ?? strings[0] ?? null;
}

const isSortedDown = (values) => values.every((v, i) => i === 0 || v <= values[i - 1]);

// Numbers sort as numbers: as text, month 10 comes before month 2.
function compareTime(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return String(a).localeCompare(String(b));
}

// `read(time, seriesName)` returns the value, or null where a series has no point (a partial year).
function lineChart(times, seriesNames, read, kind, timeKind) {
  const labels = [...new Set(times)].sort(compareTime);
  if (labels.length < MIN_LINE_POINTS || labels.length > MAX_LINE_POINTS) return null;
  if (seriesNames.length < 1 || seriesNames.length > MAX_LINE_SERIES) return null;
  const series = seriesNames.map((name) => ({
    name,
    points: labels.map((label) => ({ label, value: read(label, name) ?? null })),
  }));
  const valid = series.every((s) => s.points.some((p) => isNumber(p.value)) && s.points.every((p) => p.value === null || isNumber(p.value)));
  return valid ? { type: "line", kind, timeKind, series } : null;
}

function barChart(table, labelColumn, metric) {
  const labels = columnValues(table, labelColumn);
  const values = columnValues(table, metric.column);
  if (distinct(labels).size !== labels.length) return null;
  if (!values.every((v) => isNumber(v) && v >= 0)) return null;
  // Only a ranked list can lose its tail and still mean "the top N".
  if (labels.length > MAX_BARS && !isSortedDown(values)) return null;
  const points = labels.slice(0, MAX_BARS).map((label, i) => ({ label, value: values[i] }));
  return {
    type: "bar",
    kind: metric.kind,
    truncated: labels.length > MAX_BARS,
    series: [{ name: metric.column, points }],
  };
}

function groupedChart(categories, seriesNames, read, kind) {
  if (seriesNames.length !== 2) return null;
  if (categories.length < 1 || categories.length > 8) return null;
  const series = seriesNames.map((name) => ({
    name,
    points: categories.map((label) => ({ label, value: read(label, name) })),
  }));
  const complete = series.every((s) => s.points.every((p) => isNumber(p.value) && p.value >= 0));
  return complete ? { type: "grouped", kind, series } : null;
}

const timeKindOf = (column) => (/month/i.test(column) ? "month" : /year/i.test(column) ? "year" : "other");

// One column per year (usd_2024, usd_2025), by category or by month.
function wideComparison(table, labelColumn, timeColumn) {
  const yearColumns = table.columns.filter((c) => YEAR_IN_NAME.test(c));
  const metric = pickMetric(table, yearColumns);
  if (!metric) return null;
  const pattern = metric.column.replace(YEAR_IN_NAME, "|");
  const same = yearColumns.filter((c) => c.replace(YEAR_IN_NAME, "|") === pattern);
  const years = same.map((c) => c.match(YEAR_IN_NAME)[1]).sort();
  const columnFor = (year) => same.find((c) => c.match(YEAR_IN_NAME)[1] === year);

  if (timeColumn) {
    const times = columnValues(table, timeColumn);
    if (distinct(times).size !== times.length) return null;
    const read = (time, year) => columnValues(table, columnFor(year))[times.indexOf(time)];
    return lineChart(times, years, read, metric.kind, timeKindOf(timeColumn));
  }
  if (!labelColumn) return null;
  const labels = columnValues(table, labelColumn);
  if (distinct(labels).size !== labels.length) return null;
  const read = (label, year) => columnValues(table, columnFor(year))[labels.indexOf(label)];
  return groupedChart(labels, years, read, metric.kind);
}

// One row per category and year: product, year, amount_usd.
function longComparison(table, labelColumn, timeColumn, metric) {
  const labels = columnValues(table, labelColumn);
  const times = columnValues(table, timeColumn).map(String);
  const values = columnValues(table, metric.column);
  const categories = [...distinct(labels)];
  const years = [...distinct(times)].sort(compareTime);
  if (categories.length * years.length !== labels.length) return null;
  const read = (label, year) => {
    const i = labels.findIndex((l, row) => l === label && times[row] === year);
    return i < 0 ? null : values[i];
  };
  return groupedChart(categories, years, read, metric.kind);
}

// One row per year and month: one line per year, so the same months sit above each other.
function yearMonthLines(table, yearColumn, monthColumn, metric) {
  const years = columnValues(table, yearColumn).map(String);
  const months = columnValues(table, monthColumn);
  const values = columnValues(table, metric.column);
  const keys = new Set(years.map((y, i) => `${y}|${months[i]}`));
  if (keys.size !== years.length) return null;
  const seriesNames = [...new Set(years)].sort(compareTime);
  const read = (month, year) => {
    const i = years.findIndex((y, row) => y === year && months[row] === month);
    return i < 0 ? null : values[i];
  };
  return lineChart(months, seriesNames, read, metric.kind, "month");
}

function chartFromTable(table, lang) {
  if (table.rows.length < MIN_POINTS) return null;
  const labelColumn = pickLabel(table, lang);
  const timeColumns = table.columns.filter((c) => TIME.test(c));

  // Comparing years column by column must show every year, or nothing: never one of them alone.
  if (table.columns.filter((c) => YEAR_IN_NAME.test(c)).length >= 2) {
    return timeColumns.length <= 1 ? wideComparison(table, labelColumn, timeColumns[0]) : null;
  }

  const numeric = table.columns.filter((c) => columnValues(table, c).every(isNumber));
  const metric = pickMetric(table, numeric);
  if (!metric) return null;

  if (timeColumns.length === 2) {
    const yearColumn = timeColumns.find((c) => /year/i.test(c));
    const monthColumn = timeColumns.find((c) => /month/i.test(c));
    if (!yearColumn || !monthColumn || labelColumn) return null; // Start and end dates, say: ambiguous.
    return yearMonthLines(table, yearColumn, monthColumn, metric);
  }
  if (timeColumns.length > 2) return null;

  const timeColumn = timeColumns[0];
  if (timeColumn && labelColumn) return longComparison(table, labelColumn, timeColumn, metric);
  if (timeColumn) {
    const times = columnValues(table, timeColumn);
    if (distinct(times).size !== times.length) return null;
    const values = columnValues(table, metric.column);
    const read = (time) => values[times.indexOf(time)];
    return lineChart(times, [metric.column], read, metric.kind, timeKindOf(timeColumn));
  }
  if (labelColumn) return barChart(table, labelColumn, metric);
  return null;
}

// A chart whose numbers aren't in the answer probably shows the wrong query.
// Answers may round, so "22.12 mln" counts as a match for 22 116 635.
function matchesAnswer(chart, answer) {
  const text = answer.replace(/[\s  ]/g, "").replace(/,/g, ".");
  const values = chart.series.flatMap((s) => s.points.map((p) => p.value)).filter(isNumber);
  return values.some((value) => {
    const whole = Math.abs(value);
    if ([Math.trunc(whole), Math.round(whole)].some((n) => n >= 100 && text.includes(String(n)))) return true;
    return [1e6, 1e9, 1e12].some((scale) => {
      const scaled = whole / scale;
      return scaled >= 1 && text.includes(scaled.toFixed(2));
    });
  });
}

export function buildChart(steps, answer, lang) {
  if (!steps?.length || !answer) return null;
  // Later queries tend to be the final ones; earlier ones are often checks.
  for (const step of [...steps].reverse()) {
    const { columns, rows } = step.result || {};
    if (step.result?.truncated || !Array.isArray(columns) || !Array.isArray(rows)) continue;
    const chart = chartFromTable({ columns, rows }, lang);
    if (chart && matchesAnswer(chart, answer)) return chart;
  }
  return null;
}
