// Umumiy kichik UI komponentlari: holatlar, badge, sahifalash, maydonlar, KPI, ta'riflar ro'yxati.
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { useLang } from "../i18n/LangContext";
import { int } from "../lib/format";

export function Loading({ inline = false }) {
  const { t } = useLang();
  if (inline) return <span className="spinner" role="status" aria-label={t.common.loading} />;
  return (
    <div className="state" role="status">
      <span className="spinner" aria-hidden="true" /> {t.common.loading}
    </div>
  );
}

export function errorText(err, t) {
  if (err instanceof ApiError) {
    if (err.status === 0) return err.detail === "timeout" ? t.common.timeout : t.common.network;
    if (err.status === 401) return t.common.unauthorized;
    return err.message || t.common.error;
  }
  return err?.message || t.common.error;
}

export function ErrorBox({ error, onRetry }) {
  const { t } = useLang();
  const rid = error instanceof ApiError ? error.requestId : null;
  return (
    <div className="alert alert--error" role="alert">
      <div>
        {errorText(error, t)}
        {rid && (
          <small>
            {t.common.requestId}: {rid}
          </small>
        )}
      </div>
      {onRetry && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={onRetry}>
          {t.common.retry}
        </button>
      )}
    </div>
  );
}

export function Empty({ children }) {
  const { t } = useLang();
  return <div className="state">{children || t.common.empty}</div>;
}

/** react-query natijasini holatlarga ajratadi */
export function QueryState({ q, children, empty }) {
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  if (empty?.(q.data)) return <Empty />;
  return children(q.data);
}

const STATUS_TONE = {
  "Исполнен": "good",
  "Исполнен(Частично)": "info",
  "Оплачен": "info",
  "Ждёт оплату": "wait",
  "Заключен": "wait",
  "Не подписан": "wait",
  "Новый": "neutral",
  "Аннулирован(Не оплачен)": "bad",
};

export function StatusBadge({ status }) {
  const { v, hint } = useLang();
  return (
    <span className={`badge badge--${STATUS_TONE[status] || "neutral"}`} title={hint(status)}>
      {v(status)}
    </span>
  );
}

export function Pagination({ page, pages, total, pageSize, onPage, onPageSize }) {
  const { t } = useLang();
  return (
    <div className="pager">
      <span className="muted">
        {t.common.total}: <b className="mono">{int(total)}</b>
      </span>
      <div className="pager__btns">
        {onPageSize && (
          <label className="pager__btns">
            <span className="muted">{t.common.pageSize}</span>
            <select className="select" style={{ width: 84 }} value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
              {[20, 50, 100, 200].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="button" className="btn btn--ghost btn--sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ← {t.common.prev}
        </button>
        <span className="mono nowrap">
          {int(page)} / {int(Math.max(pages, 1))}
        </span>
        <button type="button" className="btn btn--ghost btn--sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          {t.common.next} →
        </button>
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

/** options: string[] yoki {value,label}[] */
export function Select({ label, value, onChange, options = [], allLabel, disabled }) {
  const { t } = useLang();
  return (
    <Field label={label}>
      <select className="select" value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel ?? t.common.all}</option>
        {options.map((o) => {
          const opt = typeof o === "string" ? { value: o, label: o } : o;
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          );
        })}
      </select>
    </Field>
  );
}

export function Kpi({ label, value, sub }) {
  return (
    <div className="card kpi">
      <span className="kpi__label">{label}</span>
      <span className="kpi__value">{value}</span>
      {sub && <span className="kpi__sub">{sub}</span>}
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="card kpi" aria-hidden="true">
      <span className="skeleton" style={{ height: 14, width: "50%" }} />
      <span className="skeleton" style={{ height: 30, width: "80%" }} />
    </div>
  );
}

/** rows: [label, value][] — value null bo'lsa qator ko'rsatilmaydi */
export function DetailList({ rows }) {
  return (
    <dl className="dl">
      {rows
        .filter(([, val]) => val !== null && val !== undefined && val !== "")
        .map(([label, val]) => (
          <div key={label} style={{ display: "contents" }}>
            <dt>{label}</dt>
            <dd>{val}</dd>
          </div>
        ))}
    </dl>
  );
}

export function Card({ title, note, actions, children, flush }) {
  return (
    <section className={`card${flush ? " card--flush" : ""}`}>
      {(title || actions) && (
        <div className="card__head" style={flush ? { padding: "18px 20px 0" } : undefined}>
          <div>
            {title && <h2 className="card__title">{title}</h2>}
            {note && <div className="card__note">{note}</div>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHead({ title, sub, crumbs, actions }) {
  return (
    <div className="page__head">
      <div style={{ minWidth: 0 }}>
        {crumbs && (
          <div className="crumbs">
            {crumbs.map(([to, label], i) => (
              <span key={to}>
                {i > 0 && " / "}
                <Link to={to}>{label}</Link>
              </span>
            ))}
          </div>
        )}
        <h1 className="page__title">{title}</h1>
        {sub && <p className="page__sub">{sub}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([val, text]) => (
        <button key={String(val)} type="button" aria-pressed={value === val} onClick={() => onChange(val)}>
          {text}
        </button>
      ))}
    </div>
  );
}
