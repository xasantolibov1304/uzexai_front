import { useEffect, useRef, useState } from "react";
import { fetchRecords } from "./api.js";
import { useLang } from "./i18n.jsx";
import { useFitRows } from "./useFitRows.js";

// Column titles are the ones in UZEX's CSV files, so a reader can line the two up.
// `product_variant` is the backend's tidied name, so it gets its own title rather than the file's.
const COLUMNS = {
  deals: [
    ["deal_id", "Номер сделки"],
    ["deal_date", "Дата сделки"],
    ["product_variant", "Товар"],
    ["quantity_lots", "Количество"],
    ["amount", "Сумма сделки"],
    ["currency", "Валюта"],
    ["region", "Регион"],
    ["contract_type", "Тип контракта"],
    ["status", "Состояние сделки"],
    ["seller_inn", "ИНН продавца"],
    ["buyer_inn", "ИНН покупателя"],
    ["seller_broker", "Брокер продавца"],
    ["buyer_broker", "Брокер покупателя"],
  ],
  participants: [
    ["inn", "ИНН"],
    ["name", "Наименование"],
    ["region", "Регион"],
    ["activity", "Вид деятельности"],
    ["role", "Роль"],
    ["vat_payer", "Плательщик НДС"],
  ],
  brokers: [
    ["broker_code", "Код брокера"],
    ["name", "Наименование"],
    ["inn", "ИНН"],
    ["region", "Регион"],
  ],
  usd_rates: [
    ["date", "Дата"],
    ["rate", "Курс"],
  ],
};

export const hasRecords = (dataset) => Boolean(COLUMNS[dataset]);

const IDENTIFIER = /(^|_)(id|inn)($|_)/;

function formatValue(value, key, t) {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  if (key.endsWith("date") && typeof value === "string") {
    // Same DD.MM.YYYY as the files.
    const [y, m, d] = value.split("-");
    return d ? `${d}.${m}.${y}` : value;
  }
  if (typeof value === "number" && !IDENTIFIER.test(key)) return t.num(value);
  return String(value);
}

export function Pager({ total, page, pages, disabled, onPage }) {
  const { t } = useLang();
  return (
    <div className="records__pager">
      <span>{t.recordsTotal(total)}</span>
      <div>
        <button
          type="button"
          aria-label={t.prevPage}
          title={t.prevPage}
          disabled={page <= 1 || disabled}
          onClick={() => onPage(page - 1)}
        >
          ‹
        </button>
        <span>
          {t.num(page)} / {t.num(pages)}
        </span>
        <button
          type="button"
          aria-label={t.nextPage}
          title={t.nextPage}
          disabled={page >= pages || disabled}
          onClick={() => onPage(page + 1)}
        >
          ›
        </button>
      </div>
    </div>
  );
}

export default function Records({ dataset }) {
  const { t } = useLang();
  const areaRef = useRef(null);
  const rows = useFitRows(areaRef);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("loading");
  const [attempt, setAttempt] = useState(0);

  // A resize changes the page size, so the old page number would point at different rows.
  useEffect(() => setPage(1), [rows]);

  useEffect(() => {
    if (!rows) return undefined;
    const controller = new AbortController();
    setStatus("loading");
    fetchRecords(dataset, page, rows, controller.signal)
      .then((data) => {
        setResult(data);
        setStatus("ready");
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error("[records] load failed", { dataset, page, error: err });
        setStatus("error");
      });
    return () => controller.abort();
  }, [dataset, page, rows, attempt]);

  const columns = COLUMNS[dataset];
  return (
    <>
      <p>{t.recordsNote}</p>
      <div className="source-preview__fit" ref={areaRef}>
        {status === "error" ? (
          <div className="alert alert--error records__status" role="alert">
            {t.error}
            <button type="button" className="alert__action" onClick={() => setAttempt((n) => n + 1)}>
              {t.retry}
            </button>
          </div>
        ) : !result ? (
          <div className="records__status">…</div>
        ) : (
          <div className="trace__table" aria-busy={status === "loading"}>
            <table>
              <thead>
                <tr>
                  {columns.map(([key, label]) => (
                    <th key={key}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.items.slice(0, rows).map((item, i) => (
                  <tr key={i}>
                    {columns.map(([key]) => (
                      <td key={key}>{formatValue(item[key], key, t)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {result && (
        <Pager
          total={result.total}
          page={page}
          pages={result.pages}
          disabled={status === "loading"}
          onPage={setPage}
        />
      )}
    </>
  );
}
