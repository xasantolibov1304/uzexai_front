import { Link, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { useDeal } from "../api/hooks";
import { Card, DetailList, ErrorBox, Loading, PageHead, StatusBadge } from "../components/ui";
import { useLang } from "../i18n/LangContext";
import { date, int, money, num, volume } from "../lib/format";
import NotFound from "./NotFound";

export default function DealDetail() {
  const { id } = useParams();
  const { t, v, lang } = useLang();
  const T = t.deal;
  const q = useDeal(id);

  if (q.isPending) return <div className="page container"><Loading /></div>;
  if (q.isError) {
    if (q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 422)) return <NotFound message={T.notFound} />;
    return <div className="page container"><ErrorBox error={q.error} onRetry={() => q.refetch()} /></div>;
  }
  const d = q.data;
  const m = (val, cur) => money(val, cur, lang);
  const party = (inn, name) => <Link to={`/participants/${inn}`}>{name}</Link>;
  const broker = (code, name) => code && <Link to={`/brokers/${code}`}>{name || code} <span className="tag">{code}</span></Link>;

  return (
    <div className="page">
      <div className="container">
        <PageHead
          crumbs={[["/deals", t.nav.deals]]}
          title={T.title(d.deal_id)}
          sub={`${d.product_uz} · ${date(d.deal_date)} ${d.deal_time}`}
          actions={<StatusBadge status={d.status} />}
        />
        {d.is_cancelled && <div className="alert alert--error" style={{ marginBottom: 20 }}>{T.cancelled}</div>}

        <div className="grid grid--kpi" style={{ marginBottom: 20 }}>
          <div className="card kpi"><span className="kpi__label">{T.amount}</span><span className="kpi__value">{m(d.amount, d.currency)}</span>{d.currency === "USD" && <span className="kpi__sub">{m(d.amount_uzs, "UZS")}</span>}</div>
          <div className="card kpi"><span className="kpi__label">{T.volume}</span><span className="kpi__value">{volume(d.volume, d.unit)}</span><span className="kpi__sub">{int(d.quantity_lots)} × {num(d.lot_size)} {d.unit}</span></div>
          <div className="card kpi"><span className="kpi__label">{T.unitPrice}</span><span className="kpi__value">{m(d.unit_price, d.currency)}</span><span className="kpi__sub">{T.startPrice}: {m(d.start_price, d.currency)}</span></div>
        </div>

        <div className="grid grid--2">
          <Card title={T.product}>
            <DetailList
              rows={[
                [T.productUz, <Link key="p" to={`/products/${encodeURIComponent(d.product)}`}>{d.product_uz} <span className="muted">({d.product})</span></Link>],
                [T.variant, d.product_variant],
                [T.rawName, <span key="r" className="mono" style={{ fontSize: 13 }}>{d.product_name_raw}</span>],
                [T.brand, d.brand],
                [T.grade, d.product_grade],
                [T.cls, d.product_class],
                [T.type, d.product_type],
                [T.size, d.product_size],
                [T.hs, <span key="h" className="mono">{d.hs_code}</span>],
                [T.group, d.product_group],
                [T.category, d.category],
                [T.industry, d.industry],
              ]}
            />
          </Card>

          <Card title={T.parties}>
            <DetailList
              rows={[
                [T.seller, party(d.seller_inn, d.seller_name)],
                [`${T.seller} · ${T.broker}`, broker(d.seller_broker, d.seller_broker_name)],
                [T.buyer, party(d.buyer_inn, d.buyer_name)],
                [`${T.buyer} · ${T.broker}`, broker(d.buyer_broker, d.buyer_broker_name)],
                [T.region, d.region],
              ]}
            />
          </Card>

          <Card title={T.money}>
            <DetailList
              rows={[
                [T.amount, m(d.amount, d.currency)],
                [T.amountUzs, m(d.amount_uzs, "UZS")],
                [T.amountUsd, m(d.amount_usd, "USD")],
                [T.usdRate, `${num(d.usd_rate)} ${lang === "ru" ? "сум" : lang === "en" ? "UZS" : "so‘m"} / 1 USD`],
                [T.unitPrice, m(d.unit_price, d.currency)],
                [T.startPrice, m(d.start_price, d.currency)],
                [T.basePrice, d.base_unit_price_uzs != null ? `${num(d.base_unit_price_uzs)} / ${d.base_unit}` : null],
                [T.lots, int(d.quantity_lots)],
                [T.lotSize, volume(d.lot_size, d.unit)],
                [T.volumeBase, volume(d.volume_base, d.base_unit)],
              ]}
            />
          </Card>

          <Card title={T.contract}>
            <DetailList
              rows={[
                [T.contractId, <Link key="c" to={`/deals?contract_id=${d.contract_id}`} className="mono">{d.contract_id}</Link>],
                [T.contractType, v(d.contract_type)],
                [T.contractForm, v(d.contract_form)],
                [T.auction, v(d.auction_type)],
                [t.deals.f.currency, d.currency],
                [T.dateTime, `${date(d.deal_date)} ${d.deal_time}`],
              ]}
            />
          </Card>

          <Card title={T.timeline}>
            <Timeline d={d} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Timeline({ d }) {
  const { t } = useLang();
  const T = t.deal;
  const paidLate = d.payment_date && d.payment_due_date && d.payment_date > d.payment_due_date;
  return (
    <div className="timeline">
      <div className="tl tl--done">
        <div className="tl__title">{T.dealDate}</div>
        <div className="tl__body">{date(d.deal_date)} {d.deal_time}</div>
      </div>
      <div className={`tl ${d.payment_date ? (paidLate ? "tl--late" : "tl--done") : ""}`}>
        <div className="tl__title">{T.payment}</div>
        <div className="tl__body">
          {T.due}: {date(d.payment_due_date)} ({T.termDays(d.payment_term_days)})
          <br />
          {T.paid}: {d.payment_date ? `${date(d.payment_date)} (${T.inDays(d.days_to_payment)})` : T.notYet}
        </div>
      </div>
      <div className={`tl ${d.delivery_date ? "tl--done" : ""}`}>
        <div className="tl__title">{T.delivery}</div>
        <div className="tl__body">
          {T.due}: {T.termDays(d.delivery_term_days)}
          <br />
          {T.delivered}: {d.delivery_date ? `${date(d.delivery_date)} (${T.inDays(d.days_to_delivery)})` : T.notYet}
          {d.delivered_lots != null && (
            <>
              <br />
              {T.deliveredLots}: {int(d.delivered_lots)} · {T.deliveredVolume}: {volume(d.delivered_volume, d.unit)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
