import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDeals } from "../api/hooks";
import { useLang } from "../i18n/LangContext";
import { date, money, num, volume } from "../lib/format";
import { Empty, ErrorBox, Loading, Pagination, StatusBadge } from "./ui";

export function DealRow({ d, onOpen }) {
  const { lang } = useLang();
  return (
    <tr className="clickable" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()}>
      <td className="mono">{d.deal_id}</td>
      <td className="nowrap">
        {date(d.deal_date)}
        <span className="sub mono">{d.deal_time}</span>
      </td>
      <td className="cell-clip" title={d.product_variant}>
        {d.product_variant}
      </td>
      <td className="num">{volume(d.volume, d.unit)}</td>
      <td className="num">
        {money(d.amount, d.currency, lang)}
        {d.currency === "USD" && <span className="sub">{money(d.amount_uzs, "UZS", lang)}</span>}
      </td>
      <td className="num">{num(d.unit_price)}</td>
      <td>
        <StatusBadge status={d.status} />
      </td>
      <td className="cell-clip" title={d.seller_name}>
        {d.seller_name}
      </td>
      <td className="cell-clip" title={d.buyer_name}>
        {d.buyer_name}
      </td>
    </tr>
  );
}

export function DealsHeadCells() {
  const { t } = useLang();
  const C = t.deals.col;
  return (
    <>
      <th>{C.id}</th>
      <th>{C.date}</th>
      <th>{C.product}</th>
      <th className="right">{C.volume}</th>
      <th className="right">{C.amount}</th>
      <th className="right">{C.price}</th>
      <th>{C.status}</th>
      <th>{C.seller}</th>
      <th>{C.buyer}</th>
    </>
  );
}

/** Kartochka ichidagi bitimlar jadvali (kompaniya / broker sahifalari). filter — /deals parametrlari. */
export default function DealsTable({ filter }) {
  const { t } = useLang();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const q = useDeals({ ...filter, page, page_size: 20, sort: "deal_ts", order: "desc" });
  const all = new URLSearchParams(filter).toString();

  if (q.isError) return <div style={{ padding: 16 }}><ErrorBox error={q.error} onRetry={() => q.refetch()} /></div>;
  if (!q.data) return <Loading />;
  if (!q.data.items.length) return <Empty />;
  return (
    <>
      <div className="table-wrap">
        <table className={`table${q.isFetching ? " table--loading" : ""}`}>
          <thead>
            <tr>
              <DealsHeadCells />
            </tr>
          </thead>
          <tbody>
            {q.data.items.map((d) => (
              <DealRow key={d.deal_id} d={d} onOpen={() => navigate(`/deals/${d.deal_id}`)} />
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={q.data.page} pages={q.data.pages} total={q.data.total} onPage={setPage} />
      <div style={{ padding: "0 16px 14px" }}>
        <Link to={`/deals?${all}`}>{t.common.openDeals} →</Link>
      </div>
    </>
  );
}
