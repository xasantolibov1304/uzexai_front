import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useParticipants, useReference } from "../api/hooks";
import { Card, Empty, ErrorBox, Field, Loading, PageHead, Pagination, Select } from "../components/ui";
import { useDebounce } from "../hooks/useDebounce";
import { useLang } from "../i18n/LangContext";

export default function Participants() {
  const { t, v } = useLang();
  const P = t.participants;
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const ref = useReference();
  const [search, setSearch] = useState(sp.get("search") || "");
  const debounced = useDebounce(search.trim(), 300);

  const params = {
    search: sp.get("search") || "",
    role: sp.get("role") || "",
    region: sp.get("region") || "",
    activity: sp.get("activity") || "",
    page: Number(sp.get("page") || 1),
    page_size: Number(sp.get("page_size") || 50),
  };

  const update = (patch, resetPage = true) => {
    const next = new URLSearchParams(sp);
    for (const [k, val] of Object.entries(patch)) (val === "" || val == null ? next.delete(k) : next.set(k, String(val)));
    if (resetPage) next.delete("page");
    setSp(next, { replace: true });
  };

  useEffect(() => {
    if (debounced !== params.search) update({ search: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const q = useParticipants(params);
  const R = ref.data;

  return (
    <div className="page">
      <div className="container">
        <PageHead title={P.title} sub={P.sub} />
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="filters">
            <Field label={P.search}>
              <input type="search" className="input" value={search} onChange={(e) => setSearch(e.target.value)} />
            </Field>
            <Select label={P.role} value={params.role} onChange={(val) => update({ role: val })} options={(R?.role ?? []).map((x) => ({ value: x, label: v(x) }))} />
            <Select label={P.region} value={params.region} onChange={(val) => update({ region: val })} options={(R?.regions ?? []).map((r) => r.region)} />
            <Select label={P.activity} value={params.activity} onChange={(val) => update({ activity: val })} options={R?.activity} />
          </div>
        </div>

        <Card flush>
          {q.isError ? (
            <div style={{ padding: 16 }}><ErrorBox error={q.error} onRetry={() => q.refetch()} /></div>
          ) : !q.data ? (
            <Loading />
          ) : q.data.items.length === 0 ? (
            <Empty />
          ) : (
            <>
              <div className="table-wrap">
                <table className={`table${q.isFetching ? " table--loading" : ""}`}>
                  <thead>
                    <tr>
                      <th>{P.inn}</th>
                      <th>{P.name}</th>
                      <th>{P.role}</th>
                      <th>{P.region}</th>
                      <th>{P.activity}</th>
                      <th>{P.vat}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.data.items.map((p) => {
                      const open = () => navigate(`/participants/${p.inn}`);
                      return (
                        <tr key={p.inn} className="clickable" tabIndex={0} onClick={open} onKeyDown={(e) => e.key === "Enter" && open()}>
                          <td className="mono">{p.inn}</td>
                          <td>{p.name}</td>
                          <td>{v(p.role)}</td>
                          <td>{p.region}</td>
                          <td>{p.activity}</td>
                          <td>{p.vat_payer ? t.common.yes : t.common.no}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={q.data.page}
                pages={q.data.pages}
                total={q.data.total}
                pageSize={params.page_size}
                onPage={(p) => update({ page: p }, false)}
                onPageSize={(n) => update({ page_size: n })}
              />
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
