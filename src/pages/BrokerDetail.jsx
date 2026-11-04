import { useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { useBroker, useStats } from "../api/hooks";
import { RankBars } from "../components/Charts";
import DealsTable from "../components/DealsTable";
import { Card, ErrorBox, Kpi, Loading, PageHead } from "../components/ui";
import { useLang } from "../i18n/LangContext";
import { compactMoney, date, int } from "../lib/format";
import NotFound from "./NotFound";

export default function BrokerDetail() {
  const { code } = useParams();
  const { t, lang } = useLang();
  const B = t.brokers;
  const q = useBroker(code);
  const topProducts = useStats({ broker: code, group_by: "product", limit: 10 }, { enabled: !!q.data });
  const topSellers = useStats({ seller_broker: code, group_by: "seller", limit: 10 }, { enabled: !!q.data });

  if (q.isPending) return <div className="page container"><Loading /></div>;
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.status === 404) return <NotFound />;
    return <div className="page container"><ErrorBox error={q.error} onRetry={() => q.refetch()} /></div>;
  }
  const b = q.data;
  const tr = b.trading;
  const uzs = (val) => compactMoney(val, "UZS", lang);

  return (
    <div className="page">
      <div className="container">
        <PageHead crumbs={[["/brokers", t.nav.brokers]]} title={b.name} sub={`${b.broker_code} · ${B.inn} ${b.inn} · ${b.region}`} />

        <div className="grid grid--kpi" style={{ marginBottom: 20 }}>
          <Kpi label={B.sellerSide} value={int(tr.deals_seller_side)} sub={uzs(tr.seller_side_amount_uzs)} />
          <Kpi label={B.buyerSide} value={int(tr.deals_buyer_side)} sub={uzs(tr.buyer_side_amount_uzs)} />
          <Kpi label={B.period} value={date(tr.first_deal_date)} sub={`→ ${date(tr.last_deal_date)}`} />
        </div>

        <div className="grid grid--2" style={{ marginBottom: 20 }}>
          <Card title={B.topProducts}>
            {topProducts.isPending ? <Loading /> : topProducts.isError ? <ErrorBox error={topProducts.error} /> : (
              <RankBars format={uzs} rows={topProducts.data.rows.map((r) => ({ key: r.key, label: r.label || r.key, value: r.amount_uzs, to: `/products/${encodeURIComponent(r.key)}` }))} />
            )}
          </Card>
          <Card title={t.participants.topSellers}>
            {topSellers.isPending ? <Loading /> : topSellers.isError ? <ErrorBox error={topSellers.error} /> : (
              <RankBars format={uzs} rows={topSellers.data.rows.map((r) => ({ key: r.key, label: r.label || r.key, value: r.amount_uzs, to: `/participants/${r.key}` }))} />
            )}
          </Card>
        </div>

        <Card title={B.deals} flush>
          <DealsTable filter={{ broker: code }} />
        </Card>
      </div>
    </div>
  );
}
