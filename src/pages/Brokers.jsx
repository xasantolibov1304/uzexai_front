import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useBrokers, useReference } from "../api/hooks";
import { Card, Empty, ErrorBox, Field, Loading, PageHead, Select } from "../components/ui";
import { useLang } from "../i18n/LangContext";

const norm = (s) => (s || "").toLowerCase().replace(/[‘’ʼ'`"«»]/g, "");

// Ro'yxat sahifalanmaydi (jami 120 ta) — qidiruv mijoz tomonida.
export default function Brokers() {
  const { t } = useLang();
  const B = t.brokers;
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const region = sp.get("region") || "";
  const [search, setSearch] = useState("");
  const ref = useReference();
  const q = useBrokers(region || undefined);

  const items = useMemo(() => {
    const s = norm(search.trim());
    const list = q.data ?? [];
    if (!s) return list;
    return list.filter((b) => norm(b.name).includes(s) || norm(b.name_latin).includes(s) || norm(b.broker_code).includes(s) || b.inn?.includes(s));
  }, [q.data, search]);

  return (
    <div className="page">
      <div className="container">
        <PageHead title={B.title} sub={B.sub} />
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="filters">
            <Field label={B.search}>
              <input type="search" className="input" value={search} onChange={(e) => setSearch(e.target.value)} />
            </Field>
            <Select label={B.region} value={region} onChange={(val) => setSp(val ? { region: val } : {}, { replace: true })} options={(ref.data?.regions ?? []).map((r) => r.region)} />
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
                    <th>{B.code}</th>
                    <th>{B.name}</th>
                    <th>{B.inn}</th>
                    <th>{B.region}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((b) => {
                    const open = () => navigate(`/brokers/${encodeURIComponent(b.broker_code)}`);
                    return (
                      <tr key={b.broker_code} className="clickable" tabIndex={0} onClick={open} onKeyDown={(e) => e.key === "Enter" && open()}>
                        <td className="mono">{b.broker_code}</td>
                        <td>{b.name}</td>
                        <td className="mono">{b.inn}</td>
                        <td>{b.region}</td>
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
