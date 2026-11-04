import { Link, useParams, useSearchParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { useProduct, useStats } from "../api/hooks";
import { ColumnChart, RankBars, TrendChart } from "../components/Charts";
import { Card, DetailList, ErrorBox, Kpi, Loading, PageHead, Select } from "../components/ui";
import { useLang } from "../i18n/LangContext";
import { compact, compactMoney, int, num, periodLabel } from "../lib/format";
import NotFound from "./NotFound";

const LAST_YEAR = 2026;

export default function ProductDetail() {
  const { name } = useParams();
  const { t, lang } = useLang();
  const P = t.products;
  const D = t.dashboard;
  const [sp, setSp] = useSearchParams();
  const q = useProduct(name);

  const variants = (q.data?.variants ?? []).slice().sort((a, b) => b.n_deals - a.n_deals);
  const variant = sp.get("variant") || variants[0]?.product_variant || "";

  const price = useStats({ product_variant: variant, group_by: "month", limit: 1000 }, { enabled: !!variant });
  const yearly = useStats({ product: name, group_by: "year" });
  const byVariant = useStats({ product: name, group_by: "product_variant", limit: 15 });
  const sellers = useStats({ product: name, group_by: "seller", limit: 10 });
  const total = useStats({ product: name });

  if (q.isPending) return <div className="page container"><Loading /></div>;
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.status === 404) return <NotFound />;
    return <div className="page container"><ErrorBox error={q.error} onRetry={() => q.refetch()} /></div>;
  }
  const p = q.data;
  const uzs = (v) => compactMoney(v, "UZS", lang);
  const row = total.data?.rows?.[0];
  const priceRows = price.data?.rows ?? [];
  const baseUnit = priceRows.find((r) => r.base_unit)?.base_unit;
  const priceData = priceRows.map((r) => ({
    key: r.key,
    label: periodLabel(r.key),
    value: r.units_mixed ? null : r.avg_price_uzs_per_base_unit,
    extra: `${int(r.deal_count)} ${t.common.deals}`,
  }));
  const hasPrice = priceData.some((d) => d.value != null);

  return (
    <div className="page">
      <div className="container">
        <PageHead
          crumbs={[["/products", t.nav.products]]}
          title={p.product_uz}
          sub={`${p.product} · ${p.category} · ${p.industry}`}
          actions={<Link className="btn btn--ghost" to={`/deals?product=${encodeURIComponent(p.product)}`}>{t.common.openDeals} →</Link>}
        />

        <div className="grid grid--kpi" style={{ marginBottom: 20 }}>
          <Kpi label={P.nDeals} value={int(p.n_deals)} />
          <Kpi label={P.nContracts} value={int(p.n_contracts)} />
          <Kpi label={D.kpiTurnover} value={row ? uzs(row.amount_uzs) : "…"} sub={D.excludeNote} />
          <Kpi
            label={t.deal.volumeBase}
            value={row ? (row.units_mixed ? t.common.mixedUnits : `${compact(row.volume_base, lang)} ${row.base_unit}`) : "…"}
            sub={`${P.units}: ${p.units}`}
          />
        </div>

        <Card
          title={P.priceDynamics}
          note={P.variantNote}
          actions={
            <div style={{ minWidth: 280 }}>
              <Select
                label={P.variant}
                value={variant}
                allLabel={P.pickVariant}
                onChange={(val) => setSp(val ? { variant: val } : {}, { replace: true })}
                options={variants.map((x) => ({ value: x.product_variant, label: `${x.product_variant} · ${int(x.n_deals)}` }))}
              />
            </div>
          }
        >
          {!variant ? null : price.isPending ? (
            <Loading />
          ) : price.isError ? (
            <ErrorBox error={price.error} onRetry={() => price.refetch()} />
          ) : !hasPrice ? (
            <div className="alert alert--warn">{P.noPrice}</div>
          ) : (
            <TrendChart
              data={priceData}
              format={(v) => (v == null ? "—" : `${num(v)} ${P.perUnit(baseUnit)}`)}
              axisFormat={(v) => compact(v, lang)}
              valueLabel={baseUnit ? P.perUnit(baseUnit) : P.avgPrice}
            />
          )}
        </Card>

        <div className="grid grid--2" style={{ marginTop: 20 }}>
          <Card title={P.turnoverByYear} note={D.turnoverBln}>
            {yearly.isPending ? <Loading /> : yearly.isError ? <ErrorBox error={yearly.error} onRetry={() => yearly.refetch()} /> : (
              <ColumnChart
                height={240}
                data={yearly.data.rows.map((r) => ({ key: r.key, label: r.key, value: r.amount_uzs, partial: Number(r.key) === LAST_YEAR, extra: `${int(r.deal_count)} ${t.common.deals}` }))}
                format={uzs}
                axisFormat={(v) => compact(v, lang)}
                valueLabel={D.kpiTurnover}
                partialLabel={D.partial}
              />
            )}
          </Card>
          <Card title={P.byVariant}>
            {byVariant.isPending ? <Loading /> : byVariant.isError ? <ErrorBox error={byVariant.error} /> : (
              <RankBars
                format={uzs}
                rows={byVariant.data.rows.map((r) => ({ key: r.key, label: r.key, value: r.amount_uzs, to: `/deals?product_variant=${encodeURIComponent(r.key)}` }))}
              />
            )}
          </Card>
          <Card title={D.topSellers}>
            {sellers.isPending ? <Loading /> : sellers.isError ? <ErrorBox error={sellers.error} /> : (
              <RankBars format={uzs} rows={sellers.data.rows.map((r) => ({ key: r.key, label: r.label || r.key, value: r.amount_uzs, to: `/participants/${r.key}` }))} />
            )}
          </Card>
          <Card title={P.variants}>
            <div className="table-wrap" style={{ maxHeight: 360, overflowY: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>{P.variant}</th>
                    <th>{t.deal.grade}</th>
                    <th>{t.deal.cls}</th>
                    <th>{t.deal.brand}</th>
                    <th className="right">{P.nDeals}</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((x) => (
                    <tr key={x.product_variant} className="clickable" onClick={() => setSp({ variant: x.product_variant }, { replace: true })}>
                      <td>{x.product_variant}</td>
                      <td>{x.product_grade ?? "—"}</td>
                      <td>{x.product_class ?? "—"}</td>
                      <td>{x.brand ?? "—"}</td>
                      <td className="num">{int(x.n_deals)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div style={{ marginTop: 20 }}>
          <Card title={P.rawNames}>
            <DetailList rows={[[t.deal.hs, <span key="h" className="mono">{p.hs_code}</span>], [P.units, p.units]]} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
              {(p.raw_name_variants ?? []).map((r) => (
                <span key={r} className="tag">{r}</span>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
