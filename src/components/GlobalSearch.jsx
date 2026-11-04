import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSearch } from "../api/hooks";
import { useDebounce } from "../hooks/useDebounce";
import { useLang } from "../i18n/LangContext";
import { int } from "../lib/format";

// Header'dagi global qidiruv / autocomplete: GET /api/v1/search (300 ms debounce, ≥ 2 belgi)
export default function GlobalSearch() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const debounced = useDebounce(q, 300);
  const res = useSearch(debounced);
  const boxRef = useRef(null);
  const listId = useId();
  const items = res.data ?? [];

  useEffect(() => {
    setActive(0);
  }, [debounced]);

  useEffect(() => {
    const onDoc = (e) => {
      if (!boxRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const go = (it) => {
    navigate(it.kind === "broker" ? `/brokers/${encodeURIComponent(it.id)}` : `/participants/${encodeURIComponent(it.id)}`);
    setOpen(false);
    setQ("");
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") return setOpen(false);
    if (!items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + items.length) % items.length);
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      go(items[active]);
    }
  };

  const trimmed = q.trim();
  return (
    <div className="gsearch" ref={boxRef}>
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        type="search"
        role="combobox"
        aria-label={t.search.label}
        aria-expanded={open && trimmed.length > 0}
        aria-controls={listId}
        aria-activedescendant={open && items[active] ? `${listId}-${active}` : undefined}
        placeholder={t.search.placeholder}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && trimmed.length > 0 && (
        <div className="gsearch__pop" id={listId} role="listbox">
          {trimmed.length < 2 ? (
            <div className="gsearch__note">{t.search.min}</div>
          ) : res.isFetching && !items.length ? (
            <div className="gsearch__note">
              <span className="spinner" aria-hidden="true" /> {t.common.loading}
            </div>
          ) : res.isError ? (
            <div className="gsearch__note">{t.common.error}</div>
          ) : items.length === 0 ? (
            <div className="gsearch__note">{t.search.noResults}</div>
          ) : (
            items.map((it, i) => (
              <div
                key={`${it.kind}-${it.id}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className="gsearch__item"
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(it);
                }}
              >
                <span>
                  <span className="kind">{it.kind === "broker" ? t.search.broker : t.search.participant}</span> {it.name}
                </span>
                <span className="gsearch__meta">
                  {it.id} · {it.region}
                  {it.deals_as_seller_side > 0 && ` · ${int(it.deals_as_seller_side)} ${t.search.asSeller}`}
                  {it.deals_as_buyer_side > 0 && ` · ${int(it.deals_as_buyer_side)} ${t.search.asBuyer}`}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
