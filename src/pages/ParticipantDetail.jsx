import { Link, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { useParticipant, useStats } from "../api/hooks";
import { RankBars } from "../components/Charts";
import DealsTable from "../components/DealsTable";
import { Card, ErrorBox, Kpi, Loading, PageHead } from "../components/ui";
import { useLang } from "../i18n/LangContext";
import { compactMoney, date, int, money } from "../lib/format";
import NotFound from "./NotFound";

export default function ParticipantDetail() {
  const { inn } = useParams();
  const { t, v, lang } = useLang();
  const P = t.participants;
  const q = useParticipant(inn);

  const tr = q.data?.trading;
  const isSeller = tr ? tr.deals_as_seller >= tr.deals_as_buyer : true;
  const side = isSeller ? "seller_inn" : "buyer_inn";
  const enabled = !!tr;
  const topProducts = useStats({ [side]: inn, group_by: "product", limit: 10 }, { enabled });
  const counterparts = useStats({ [side]: inn, group_by: isSeller ? "buyer" : "seller", limit: 10 }, { enabled });

  if (q.isPending) return <div className="page container"><Loading /></div>;
  if (q.isError) {
    if (q.error instanceof ApiError && q.error.status === 404) return <NotFound />;
    return <div className="page container"><ErrorBox error={q.error} onRetry={() => q.refetch()} /></div>;
  }
  const p = q.data;
  const uzs = (val) => compactMoney(val, "UZS", lang);
  const totalDeals = tr.deals_as_seller + tr.deals_as_buyer;

  return (
    <div className="page">
      <div className="container">
        <PageHead
          crumbs={[["/participants", t.nav.participants]]}
          title={p.name}
          sub={`${P.inn} ${p.inn} · ${p.region} · ${p.activity} · ${v(p.role)}${p.vat_payer ? ` · ${P.vat}` : ""}`}
        />

        <div className="grid grid--kpi" style={{ marginBottom: 20 }}>
          <Kpi label={P.asSeller} value={int(tr.deals_as_seller)} sub={`${P.sold}: ${uzs(tr.sold_amount_uzs)}`} />
          <Kpi label={P.asBuyer} value={int(tr.deals_as_buyer)} sub={`${P.bought}: ${uzs(tr.bought_amount_uzs)}`} />
          <Kpi label={P.cancelled} value={int(tr.cancelled_deals)} sub={totalDeals ? `${((tr.cancelled_deals / totalDeals) * 100).toFixed(1)} %` : null} />
          <Kpi label={P.period} value={`${date(tr.first_deal_date)}`} sub={`→ ${date(tr.last_deal_date)}`} />
        </div>

        <div className="grid grid--2" style={{ marginBottom: 20 }}>
          <Card title={P.topProducts} note={money(isSeller ? tr.sold_amount_uzs : tr.bought_amount_uzs, "UZS", lang)}>
            {topProducts.isPending ? <Loading /> : topProducts.isError ? <ErrorBox error={topProducts.error} /> : (
              <RankBars
                format={uzs}
                rows={topProducts.data.rows.map((r) => ({ key: r.key, label: r.label || r.key, value: r.amount_uzs, to: `/deals?${side}=${inn}&product=${encodeURIComponent(r.key)}` }))}
              />
            )}
          </Card>
          <Card title={isSeller ? P.topBuyers : P.topSellers}>
            {counterparts.isPending ? <Loading /> : counterparts.isError ? <ErrorBox error={counterparts.error} /> : (
              <RankBars
                format={uzs}
                rows={counterparts.data.rows.map((r) => ({ key: r.key, label: r.label || r.key, value: r.amount_uzs, to: `/participants/${r.key}` }))}
              />
            )}
          </Card>
        </div>

        <Card title={P.deals} flush>
          <DealsTable filter={{ participant_inn: inn }} />
        </Card>
        <p className="muted" style={{ fontSize: 13 }}>
          <Link to="/participants">← {t.common.back}</Link>
        </p>
      </div>
    </div>
  );
}
