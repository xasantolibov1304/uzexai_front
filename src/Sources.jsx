import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLang } from "./i18n.jsx";
import Records, { hasRecords, Pager } from "./Records.jsx";
import { useFitRows } from "./useFitRows.js";

// UZEX's official data folder, linked from hackathon.uzex.uz/saralash. It holds one ZIP.
const UZEX_DATA_URL = "https://drive.google.com/drive/folders/1BcjcDi1N0ym1MwX3OrgZYfDqsWLOkVeL?usp=sharing";

const DATASET_ORDER = ["deals", "contracts", "products", "participants", "brokers", "usd_rates"];

// Exact file names from the UZEX data folder, so a reader can find the source themselves.
const SOURCE_FILES = {
  deals: "deals_2022.csv … deals_2026.csv",
  contracts: "contracts.csv",
  participants: "participants.csv",
  brokers: "brokers.csv",
  usd_rates: "usd_rates.csv",
};

// Identifiers must stay exact: "2 024" or a spaced-out STIR would be wrong.
const IDENTIFIER_COLUMN = /(^|_)(inn|stir|id|code|year|month|date)($|_)/i;
function formatCell(value, column, t) {
  if (value == null) return "—";
  if (typeof value === "number" && !IDENTIFIER_COLUMN.test(column)) return t.num(value);
  return String(value);
}

// Column names come from the agent's SQL. Known ones get an interface-language header, with suffixes such as
// _uzs, _usd, _uz or a year read off the end; anything unknown keeps its own name rather than a guess.
const COLUMN_SUFFIX = /_(uzs|usd|uz|ru|pct|\d{4})$/i;

function columnLabel(column, t) {
  let core = String(column).toLowerCase();
  const notes = [];
  let match;
  while (!t.columns[core] && (match = core.match(COLUMN_SUFFIX))) {
    const suffix = match[1];
    notes.unshift(/^\d{4}$/.test(suffix) ? suffix : t.columnSuffixes[suffix]);
    core = core.slice(0, -match[0].length);
  }
  if (!t.columns[core]) return column;
  const years = notes.filter((n) => /^\d{4}$/.test(n));
  const others = notes.filter((n) => !/^\d{4}$/.test(n));
  return [t.columns[core], ...years].join(" ") + (others.length ? ` (${others.join(", ")})` : "");
}

// Only known tables become labels; CTE names and "EXTRACT(year FROM x)" must not.
function datasetsIn(step) {
  if (step.tool === "find_entity") {
    return (step.result?.matches || []).map((m) => (m.kind === "broker" ? "brokers" : "participants"));
  }
  const sql = step.args?.sql;
  if (!sql) return [];
  return [...sql.matchAll(/\b(?:from|join)\s+([a-z_]+)/gi)].map((m) => m[1].toLowerCase());
}

// Lookups return objects and queries return rows, so both become one table shape.
function resultTable(step) {
  const { result } = step;
  if (!result) return null;
  if (Array.isArray(result.columns) && Array.isArray(result.rows)) {
    return { columns: result.columns, rows: result.rows };
  }
  if (Array.isArray(result.matches) && result.matches.length > 0) {
    const columns = ["name", "id", "region"];
    return { columns, rows: result.matches.map((m) => columns.map((c) => m[c])) };
  }
  return null;
}

// The agent's own step notes are in English whatever the question's language, so titles are built here.
function stepTitle(step, t) {
  if (step.tool === "find_entity" && step.args?.query) return `${t.search}: ${step.args.query}`;
  const found = new Set(datasetsIn(step));
  const labels = DATASET_ORDER.filter((d) => found.has(d)).map((d) => t.datasets[d]);
  return labels.length > 0 ? `${t.query}: ${labels.join(", ")}` : t.query;
}

// The query as the agent ran it. Copy falls back to selecting the text where the clipboard API is blocked.
function SqlBlock({ sql }) {
  const { t } = useLang();
  const preRef = useRef(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  const selectText = () => {
    const range = document.createRange();
    range.selectNodeContents(preRef.current);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const copy = () => {
    if (!navigator.clipboard) return selectText();
    navigator.clipboard.writeText(sql).then(() => setCopied(true), selectText);
  };

  return (
    <div className="sql">
      <div className="sql__head">
        <span>{t.sqlLabel}</span>
        <button type="button" className="sql__copy" onClick={copy} aria-live="polite">
          {copied ? t.copied : t.copy}
        </button>
      </div>
      <pre ref={preRef}>{sql}</pre>
    </div>
  );
}

function ResultTable({ table, rows = table.rows }) {
  const { t } = useLang();
  return (
    <div className="trace__table">
      <table>
        <thead>
          <tr>
            {table.columns.map((c) => (
              <th key={c} title={c}>
                {columnLabel(c, t)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{formatCell(cell, table.columns[j], t)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Shows as many rows as fit; the pager replaces scrolling inside the panel.
function PagedResult({ table }) {
  const areaRef = useRef(null);
  const fit = useFitRows(areaRef);
  const [page, setPage] = useState(1);
  const size = fit || table.rows.length;
  const pages = Math.max(1, Math.ceil(table.rows.length / size));
  const current = Math.min(page, pages);
  return (
    <>
      <div className="source-preview__fit" ref={areaRef}>
        <ResultTable table={table} rows={table.rows.slice((current - 1) * size, current * size)} />
      </div>
      {pages > 1 && <Pager total={table.rows.length} page={current} pages={pages} onPage={setPage} />}
    </>
  );
}

function SourcePreview({ dataset, steps, onClose, onShowAll }) {
  const { t } = useLang();
  const closeRef = useRef(null);
  const used = steps.filter((s) => datasetsIn(s).includes(dataset));
  // The last query is the one the answer most likely rests on; earlier ones are often checks.
  const lastWithRows = [...used].reverse().find((s) => resultTable(s)?.rows.length > 0);
  const table = lastWithRows && resultTable(lastWithRows);

  // A ref, because onClose changes on every chat render and must not re-trigger the effects.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [tab, setTab] = useState("result");

  useEffect(() => {
    setTab("result");
    closeRef.current?.focus({ preventScroll: true });
  }, [dataset]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Portal: the panel belongs to the window, not to the scrolling conversation.
  return createPortal(
    <aside className="source-preview" aria-label={t.datasets[dataset]}>
      <div className="source-preview__head">
        <b>{t.datasets[dataset]}</b>
        <div className="source-preview__actions">
          <a
            className="source-preview__download"
            href={UZEX_DATA_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={t.openFiles}
          >
            <span className="source-preview__download-full">{t.openFiles}</span>
            <span className="source-preview__download-short">{t.openFilesShort}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
          </a>
          <button
            type="button"
            ref={closeRef}
            className="source-preview__close"
            aria-label={t.close}
            title={t.close}
            onClick={onClose}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>
      {SOURCE_FILES[dataset] && <code className="source-preview__file">{SOURCE_FILES[dataset]}</code>}

      <div className="source-preview__tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "result"} onClick={() => setTab("result")}>
          {t.tabResult}
        </button>
        <button type="button" role="tab" aria-selected={tab === "records"} onClick={() => setTab("records")}>
          {t.tabRecords}
        </button>
      </div>

      {tab === "records" ? (
        hasRecords(dataset) ? <Records key={dataset} dataset={dataset} /> : <p>{t.recordsNone}</p>
      ) : (
        <>
          {table ? (
            <>
              <div className="source-preview__label">{t.previewLabel}</div>
              <PagedResult key={dataset} table={table} />
            </>
          ) : (
            <p>{t.previewEmpty}</p>
          )}
          <button type="button" className="source-preview__all" onClick={onShowAll}>
            {t.previewAll}
          </button>
        </>
      )}
    </aside>,
    document.body
  );
}

export default function Sources({ steps, selected, onSelect }) {
  const { t } = useLang();
  const detailsRef = useRef(null);
  if (!steps?.length) return null;

  const found = new Set(steps.flatMap(datasetsIn));
  const datasets = DATASET_ORDER.filter((d) => found.has(d));

  const showAll = () => {
    const details = detailsRef.current;
    if (!details) return;
    onSelect(null);
    details.open = true;
    details.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  return (
    <div className="sources">
      {datasets.length > 0 && (
        <div className="sources__list">
          <span className="sources__label">{t.sources}</span>
          {datasets.map((d) => (
            <button
              key={d}
              type="button"
              className="sources__chip"
              aria-expanded={selected === d}
              onClick={() => onSelect(selected === d ? null : d)}
            >
              {t.datasets[d]}
            </button>
          ))}
        </div>
      )}
      {selected && (
        <SourcePreview dataset={selected} steps={steps} onClose={() => onSelect(null)} onShowAll={showAll} />
      )}
      <details className="trace" ref={detailsRef}>
        <summary>{t.trace}</summary>
        {steps.map((step, i) => {
          const table = resultTable(step);
          return (
            <div key={i} className="trace__item">
              <div>
                <b>{i + 1}.</b> {stepTitle(step, t)}
                {step.row_count != null && <span className="trace__rows"> · {t.rows(step.row_count)}</span>}
                {step.result?.truncated && <span className="trace__rows"> · {t.truncated}</span>}
              </div>
              {step.args?.sql && (
                <>
                  {step.args.purpose && (
                    <p className="trace__purpose">
                      <span>{t.purpose}:</span> {String(step.args.purpose)}
                    </p>
                  )}
                  <SqlBlock sql={String(step.args.sql)} />
                </>
              )}
              {table && <ResultTable table={table} />}
              {step.error && <div className="alert alert--error">{t.stepFailed}</div>}
            </div>
          );
        })}
      </details>
    </div>
  );
}
