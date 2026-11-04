import { Link } from "react-router-dom";
import ChatPanel from "../components/ChatPanel";
import { useHealth } from "../api/hooks";
import { useLang } from "../i18n/LangContext";
import { int } from "../lib/format";

export default function Landing() {
  const { t } = useLang();
  const L = t.landing;
  const health = useHealth();
  const stats = [
    [health.data?.deals ?? 500000, L.sDeals],
    [6616, L.sContracts],
    [14392, L.sCompanies],
    [120, L.sBrokers],
  ];

  return (
    <>
      <section className="hero" id="top">
        <div className="container hero__inner">
          <div className="hero__copy">
            <div className="hero__badge">{L.badge}</div>
            <h1>{L.h1}</h1>
            <p className="hero__sub">{L.sub}</p>
            <div className="hero__stats">
              {stats.map(([n, label]) => (
                <div key={label} className="hero__stat">
                  <b>{int(n)}</b>
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <div className="hero__cta">
              <Link to="/dashboard" className="btn btn--accent">
                {L.ctaDash}
              </Link>
              <Link to="/deals" className="btn btn--ghost" style={{ background: "transparent", color: "#fff", borderColor: "#2A3547" }}>
                {t.nav.deals}
              </Link>
            </div>
          </div>
          <div className="hero__chat" id="ask">
            <ChatPanel variant="hero" />
          </div>
        </div>
      </section>

      <section className="section" id="features" style={{ paddingTop: 96, paddingBottom: 40 }}>
        <div className="container">
          <h2>{L.featTitle}</h2>
          <div className="features">
            {L.features.map(([title, body], i) => (
              <div key={title} className="feature">
                <span className="feature__n">0{i + 1}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="container">
          <h2>{L.howTitle}</h2>
          <div className="steps">
            {L.steps.map(([title, body], i) => (
              <div key={title} className="step">
                <span className="step__n">{i + 1}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="data" style={{ paddingBottom: 96 }}>
        <div className="container data">
          <div className="data__copy">
            <h2>{L.dataTitle}</h2>
            <p>{L.dataSub}</p>
            <p className="fict">{L.fictional}</p>
          </div>
          <div className="data__list">
            {L.files.map(([file, desc, to]) =>
              to ? (
                <Link key={file} to={to} className="data__row">
                  <b>{file}</b>
                  <span>{desc}</span>
                </Link>
              ) : (
                <div key={file} className="data__row">
                  <b>{file}</b>
                  <span>{desc}</span>
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      <section style={{ padding: "0 24px 96px" }}>
        <div className="cta">
          <div style={{ flex: "1 1 420px", minWidth: 0 }}>
            <h2>{L.ctaTitle}</h2>
            <p>{L.ctaSub}</p>
          </div>
          <Link to="/chat" className="btn">
            {L.cta}
          </Link>
        </div>
      </section>
    </>
  );
}
