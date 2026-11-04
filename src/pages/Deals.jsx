import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDeals, useProduct, useProducts, useReference } from "../api/hooks";
import { Card, ErrorBox, Field, Loading, PageHead, Pagination, Select, Empty } from "../components/ui";
import { DealRow } from "../components/DealsTable";
import { useDebounce } from "../hooks/useDebounce";
import { useLang } from "../i18n/LangContext";
import { int } from "../lib/format";

// URL query ↔ API parametrlari (bir xil nomlar). Filtrlar URL'da saqlanadi — havolani ulashish mumkin.
const FILTER_KEYS = [
  "date_from", "date_to", "year", "category", "product", "product_variant", "region", "status",
  "contract_type", "contract_form", "auction_type", "currency", "min_amount_uzs", "max_amount_uzs",
  "participant_inn", "seller_inn", "buyer_inn", "broker", "seller_broker", "buyer_broker", "contract_id",
  "industry", "brand", "product_grade", "product_class", "include_cancelled",
];
const TEXT_KEYS = ["min_amount_uzs", "max_amount_uzs", "participant_inn", "broker"];
const HIDDEN_KEYS = ["seller_inn", "buyer_inn", "seller_broker", "buyer_broker", "contract_id", "industry", "brand", "product_grade", "product_class"];

export default function Deals() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const page = Number(sp.get("page") || 1);
  const pageSize = Number(sp.get("page_size") || 50);
  const sort = sp.get("sort") || "deal_id";
  const order = sp.get("order") || "desc";

  const filters = useMemo(() => Object.fromEntries(FILTER_KEYS.map((k) => [k, sp.get(k) || ""])), [sp]);
  const dateInvalid = filters.date_from && filters.date_to && filters.date_from > filters.date_to;

  const query = useMemo(
    () => ({ ...filters, page, page_size: pageSize, sort, order }),
    [filters, page, pageSize, sort, order],
  );
  const deals = useDeals(query);

  const update = (patch, { resetPage = true } = {}) => {
    const next = new URLSearchParams(sp);
    for (const [k, val] of Object.entries(patch)) {
      if (val === "" || val == null) next.delete(k);
      else next.set(k, String(val));
    }
    if (resetPage) next.delete("page");
    setSp(next, { replace: true });
  };

  const toggleSort = (field) => {
    if (sort === field) update({ order: order === "asc" ? "desc" : "asc" });
    else update({ sort: field, order: "desc" });
  };

  const C = t.deals.col;
  const SortTh = ({ field, children, right }) => (
    <th className={right ? "right" : undefined} aria-sort={sort === field ? (order === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className="th-sort" aria-pressed={sort === field} onClick={() => toggleSort(field)}>
        {children}
        <span aria-hidden="true">{sort === field ? (order === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );

  const data = deals.data;
  return (
    <div className="page">
      <div className="container">
        <PageHead title={t.deals.title} sub={data ? t.deals.found(int(data.total)) : t.deals.sub} />

        <FilterPanel filters={filters} update={update} />
        {dateInvalid && (
          <div className="alert alert--warn" style={{ marginTop: 12 }}>
            {t.deals.dateError}
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <Card flush>
            {deals.isError ? (
              <div style={{ padding: 16 }}>
                <ErrorBox error={deals.error} onRetry={() => deals.refetch()} />
              </div>
            ) : !data ? (
              <Loading />
            ) : data.items.length === 0 ? (
              <Empty />
            ) : (
              <>
                <div className="table-wrap">
                  <table className={`table${deals.isFetching ? " table--loading" : ""}`}>
                    <thead>
                      <tr>
                        <SortTh field="deal_id">{C.id}</SortTh>
                        <SortTh field="deal_ts">{C.date}</SortTh>
                        <th>{C.product}</th>
                        <SortTh field="volume" right>
                          {C.volume}
                        </SortTh>
                        <SortTh field="amount_uzs" right>
                          {C.amount}
                        </SortTh>
                        <SortTh field="unit_price_uzs" right>
                          {C.price}
                        </SortTh>
                        <th>{C.status}</th>
                        <th>{C.seller}</th>
                        <th>{C.buyer}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((d) => (
                        <DealRow key={d.deal_id} d={d} onOpen={() => navigate(`/deals/${d.deal_id}`)} />
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={data.page}
                  pages={data.pages}
                  total={data.total}
                  pageSize={pageSize}
                  onPage={(p) => update({ page: p }, { resetPage: false })}
                  onPageSize={(n) => update({ page_size: n })}
                />
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function FilterPanel({ filters, update }) {
  const { t, v } = useLang();
  const F = t.deals.f;
  const ref = useReference();
  const products = useProducts(filters.category || undefined);
  const product = useProduct(filters.product || null);
  const [open, setOpen] = useState(true);

  // Matnli maydonlar — debounce bilan URL'ga yoziladi
  const [text, setText] = useState(() => Object.fromEntries(TEXT_KEYS.map((k) => [k, filters[k]])));
  const debounced = useDebounce(text, 500);
  useEffect(() => {
    const patch = {};
    for (const k of TEXT_KEYS) if ((debounced[k] || "") !== (filters[k] || "")) patch[k] = debounced[k];
    if (Object.keys(patch).length) update(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  // Tashqi o'zgarish (masalan "Tozalash") bo'lsa, lokal holatni sinxronlash
  useEffect(() => {
    setText(Object.fromEntries(TEXT_KEYS.map((k) => [k, filters[k]])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [TEXT_KEYS.map((k) => filters[k]).join("|")]);

  const R = ref.data;
  const period = R?.period;
  const years = period
    ? Array.from({ length: Number(period.last_deal_date.slice(0, 4)) - Number(period.first_deal_date.slice(0, 4)) + 1 }, (_, i) => String(Number(period.first_deal_date.slice(0, 4)) + i))
    : [];
  const tr = (arr) => (arr ?? []).map((x) => ({ value: x, label: v(x) }));
  const activeCount = FILTER_KEYS.filter((k) => filters[k]).length;

  const reset = () => update(Object.fromEntries(FILTER_KEYS.map((k) => [k, ""])));
  const set = (k) => (val) => update({ [k]: val });

  return (
    <Card
      title={`${t.common.filters}${activeCount ? ` · ${activeCount}` : ""}`}
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          {activeCount > 0 && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={reset}>
              {t.common.reset}
            </button>
          )}
          <button type="button" className="btn btn--ghost btn--sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? t.common.hide : t.common.show}
          </button>
        </div>
      }
    >
      {ref.isError && <ErrorBox error={ref.error} onRetry={() => ref.refetch()} />}
      {open && (
        <>
          <div className="filters">
            <Field label={F.dateFrom}>
              <input type="date" className="input" min={period?.first_deal_date} max={period?.last_deal_date} value={filters.date_from} onChange={(e) => update({ date_from: e.target.value })} />
            </Field>
            <Field label={F.dateTo}>
              <input type="date" className="input" min={period?.first_deal_date} max={period?.last_deal_date} value={filters.date_to} onChange={(e) => update({ date_to: e.target.value })} />
            </Field>
            <Select label={F.year} value={filters.year} onChange={set("year")} options={years} />
            <Select
              label={F.category}
              value={filters.category}
              onChange={(val) => update({ category: val, product: "", product_variant: "" })}
              options={R?.category}
            />
            <Select
              label={F.product}
              value={filters.product}
              onChange={(val) => update({ product: val, product_variant: "" })}
              options={(products.data ?? []).map((p) => ({ value: p.product, label: `${p.product_uz} (${p.product})` }))}
            />
            <Select
              label={F.variant}
              value={filters.product_variant}
              disabled={!filters.product}
              onChange={set("product_variant")}
              options={(product.data?.variants ?? []).map((x) => ({ value: x.product_variant, label: `${x.product_variant} · ${int(x.n_deals)}` }))}
            />
            <Select label={F.region} value={filters.region} onChange={set("region")} options={(R?.regions ?? []).map((r) => r.region)} />
            <Select label={F.status} value={filters.status} onChange={set("status")} options={tr(R?.status)} />
            <Select label={F.contractType} value={filters.contract_type} onChange={set("contract_type")} options={tr(R?.contract_type)} />
            <Select label={F.contractForm} value={filters.contract_form} onChange={set("contract_form")} options={tr(R?.contract_form)} />
            <Select label={F.auctionType} value={filters.auction_type} onChange={set("auction_type")} options={tr(R?.auction_type)} />
            <Select label={F.currency} value={filters.currency} onChange={set("currency")} options={R?.currency ?? ["UZS", "USD"]} />
            <Field label={F.minAmount}>
              <input type="number" min="0" inputMode="numeric" className="input" value={text.min_amount_uzs} onChange={(e) => setText((s) => ({ ...s, min_amount_uzs: e.target.value }))} />
            </Field>
            <Field label={F.maxAmount}>
              <input type="number" min="0" inputMode="numeric" className="input" value={text.max_amount_uzs} onChange={(e) => setText((s) => ({ ...s, max_amount_uzs: e.target.value }))} />
            </Field>
            <Field label={F.participant}>
              <input className="input" inputMode="numeric" value={text.participant_inn} onChange={(e) => setText((s) => ({ ...s, participant_inn: e.target.value.trim() }))} />
            </Field>
            <Field label={F.broker}>
              <input className="input" placeholder="BK003" value={text.broker} onChange={(e) => setText((s) => ({ ...s, broker: e.target.value.trim().toUpperCase() }))} />
            </Field>
          </div>
          <div className="filters__foot">
            {/* Boshqa sahifalardan havola orqali kelgan, panelda maydoni yo'q filtrlar */}
            {HIDDEN_KEYS.some((k) => filters[k]) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {HIDDEN_KEYS.filter((k) => filters[k]).map((k) => (
                  <button key={k} type="button" className="chip" onClick={() => update({ [k]: "" })} aria-label={`${k} ×`}>
                    <span className="mono">{k}</span>: {filters[k]} ×
                  </button>
                ))}
              </div>
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={filters.include_cancelled !== "false"}
                onChange={(e) => update({ include_cancelled: e.target.checked ? "" : "false" })}
              />
              {F.includeCancelled}
            </label>
          </div>
        </>
      )}
    </Card>
  );
}
