import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useProducts, useReference } from "../api/hooks";
import { Card, Empty, ErrorBox, Field, Loading, PageHead, Select } from "../components/ui";
import { useLang } from "../i18n/LangContext";
import { int } from "../lib/format";

const norm = (s) => (s || "").toLowerCase().replace(/[‘’ʼ'`"]/g, "");

export default function Products() {
  const { t } = useLang();
  const P = t.products;
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const category = sp.get("category") || "";
  const [search, setSearch] = useState("");
  const ref = useReference();
  const q = useProducts(category || undefined);

  const items = useMemo(() => {
    const s = norm(search.trim());
    const list = q.data ?? [];
    return (s ? list.filter((p) => norm(p.product).includes(s) || norm(p.product_uz).includes(s) || p.hs_code?.includes(s)) : list)
      .slice()
      .sort((a, b) => b.n_deals - a.n_deals);
  }, [q.data, search]);

  return (
    <div className="page">
      <div className="container">
        <PageHead title={P.title} sub={P.sub} />
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="filters">
            <Field label={P.search}>
              <input type="search" className="input" value={search} onChange={(e) => setSearch(e.target.value)} />
            </Field>
            <Select label={P.category} value={category} onChange={(val) => setSp(val ? { category: val } : {}, { replace: true })} options={ref.data?.category} />
          </div>
        </div>

        <Card flush>
          {q.isPending ? (
            <Loading />
          ) : q.isError ? (
            <div style={{ padding: 16 }}><ErrorBox error={q.error} onRetry={() => q.refetch()} /></div>
          ) : items.length === 0 ? (
            <Empty />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t.deal.product}</th>
                    <th>{P.category}</th>
                    <th>{P.units}</th>
                    <th>{P.hs}</th>
                    <th className="right">{P.nContracts}</th>
                    <th className="right">{P.nDeals}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => {
                    const open = () => navigate(`/products/${encodeURIComponent(p.product)}`);
                    return (
                      <tr key={p.product} className="clickable" tabIndex={0} onClick={open} onKeyDown={(e) => e.key === "Enter" && open()}>
                        <td>
                          <b style={{ fontWeight: 600 }}>{p.product_uz}</b>
                          <span className="sub">{p.product}</span>
                        </td>
                        <td>
                          {p.category}
                          <span className="sub">{p.industry}</span>
                        </td>
                        <td>{p.units}</td>
                        <td className="mono">{p.hs_code}</td>
                        <td className="num">{int(p.n_contracts)}</td>
                        <td className="num">{int(p.n_deals)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
