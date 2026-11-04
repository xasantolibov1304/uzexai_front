import { useSearchParams } from "react-router-dom";
import { useReference, useStats } from "../api/hooks";
import { ColumnChart, RankBars } from "../components/Charts";
import { Card, ErrorBox, Kpi, KpiSkeleton, Loading, PageHead, Segmented } from "../components/ui";
import { useLang } from "../i18n/LangContext";
import { compact, compactMoney, int, money, periodLabel, pct } from "../lib/format";

const LAST_YEAR = 2026; // reyestr 30.10.2026 gacha — to'liq bo'lmagan yil

function yearsFromReference(ref) {
  const from = Number(ref?.period?.first_deal_date?.slice(0, 4) || 2022);
  const to = Number(ref?.period?.last_deal_date?.slice(0, 4) || LAST_YEAR);
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

export default function Dashboard() {
  const { t, lang, v } = useLang();
  const D = t.dashboard;
  const [sp, setSp] = useSearchParams();
  const year = sp.get("year") ? Number(sp.get("year")) : null;
  const ref = useReference();
  const years = yearsFromReference(ref.data);
  const base = year ? { year } : {};
  const yq = year ? `&year=${year}` : "";

  const kpi = useStats(base);
  const trend = useStats(year ? { ...base, group_by: "month" } : { group_by: "year" });
  const products = useStats({ ...base, group_by: "product", limit: 10 });
  const regions = useStats({ ...base, group_by: "region", limit: 20 });
  const sellers = useStats({ ...base, group_by: "seller", limit: 10 });
  const buyers = useStats({ ...base, group_by: "buyer", limit: 10 });
  const brokers = useStats({ ...base, group_by: "seller_broker", limit: 10 });
  const forms = useStats({ ...base, group_by: "contract_form" });

  const setYear = (y) => setSp(y ? { year: String(y) } : {}, { replace: true });
  const row = kpi.data?.rows?.[0];
  const uzs = (val) => compactMoney(val, "UZS", lang);
  const axis = (val) => compact(val, lang);

  const trendData = (trend.data?.rows ?? []).map((r) => ({
    key: r.key,
    label: periodLabel(r.key),
    value: r.amount_uzs,
    partial: !year && Number(r.key) === LAST_YEAR,
    extra: `${int(r.deal_count)} ${t.common.deals}`,
  }));

  return (
    <div className="page">
      <div className="container">
        <PageHead
          title={D.title}
          sub={`${D.sub}. ${D.excludeNote}`}
          actions={
            <Segmented
              label={D.year}
              value={year}
              onChange={setYear}
              options={[[null, D.allYears], ...years.map((y) => [y, String(y)])]}
            />
          }
        />

        {kpi.isError ? (
          <ErrorBox error={kpi.error} onRetry={() => kpi.refetch()} />
        ) : (
          <div className="grid grid--kpi">
            {!row ? (
              [0, 1, 2, 3].map((i) => <KpiSkeleton key={i} />)
            ) : (
              <>
                <Kpi label={D.kpiDeals} value={int(row.deal_count)} sub={year === LAST_YEAR || !year ? D.partial : null} />
                <Kpi label={D.kpiTurnover} value={uzs(row.amount_uzs)} sub={money(row.amount_uzs, "UZS", lang)} />
                <Kpi label={D.kpiTurnoverUsd} value={compactMoney(row.amount_usd, "USD", lang)} sub={money(row.amount_usd, "USD", lang)} />
                <Kpi label={D.kpiCancelled} value={pct(row.deal_count ? row.cancelled_count / row.deal_count : null)} sub={D.cancelledOf(int(row.cancelled_count))} />
              </>
            )}
          </div>
        )}

        <div className="grid" style={{ marginTop: 20 }}>
          <Card title={year ? `${D.monthly} · ${year}` : D.yearly} note={D.turnoverBln}>
            <Section q={trend}>
              <ColumnChart data={trendData} format={(val) => uzs(val)} axisFormat={axis} valueLabel={D.kpiTurnover} partialLabel={D.partial} />
            </Section>
          </Card>
        </div>

        <div className="grid grid--2" style={{ marginTop: 20 }}>
          <Card title={D.topProducts}>
            <Section q={products}>
              <RankBars
                format={uzs}
                rows={(products.data?.rows ?? []).map((r) => ({
                  key: r.key,
                  label: r.label || r.key,
                  title: `${r.label} (${r.key})`,
                  value: r.amount_uzs,
                  to: `/products/${encodeURIComponent(r.key)}`,
                }))}
              />
            </Section>
          </Card>
          <Card title={D.regions}>
            <Section q={regions}>
              <RankBars
                format={uzs}
                rows={(regions.data?.rows ?? []).map((r) => ({
                  key: r.key,
                  label: r.key,
                  value: r.amount_uzs,
                  to: `/deals?region=${encodeURIComponent(r.key)}${yq}`,
                }))}
              />
            </Section>
          </Card>
          <Card title={D.topSellers}>
            <Section q={sellers}>
              <RankBars
                format={uzs}
                rows={(sellers.data?.rows ?? []).map((r) => ({ key: r.key, label: r.label || r.key, value: r.amount_uzs, to: `/participants/${r.key}` }))}
              />
            </Section>
          </Card>
          <Card title={D.topBuyers}>
            <Section q={buyers}>
              <RankBars
                format={uzs}
                rows={(buyers.data?.rows ?? []).map((r) => ({ key: r.key, label: r.label || r.key, value: r.amount_uzs, to: `/participants/${r.key}` }))}
              />
            </Section>
          </Card>
          <Card title={D.brokers}>
            <Section q={brokers}>
              <RankBars
                format={uzs}
                rows={(brokers.data?.rows ?? []).map((r) => ({
                  key: r.key,
                  label: r.label || r.key,
                  sub: r.key,
                  value: r.amount_uzs,
                  to: `/brokers/${encodeURIComponent(r.key)}`,
                }))}
              />
            </Section>
          </Card>
          <Card title={D.contractForm}>
            <Section q={forms}>
              <RankBars
                format={(val, r) => `${uzs(val)} · ${int(r.count)} ${t.common.deals}`}
                rows={(forms.data?.rows ?? []).map((r) => ({
                  key: r.key,
                  label: v(r.key),
                  value: r.amount_uzs,
                  count: r.deal_count,
                  to: `/deals?contract_form=${encodeURIComponent(r.key)}${yq}`,
                }))}
              />
            </Section>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Section({ q, children }) {
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  return children;
}
