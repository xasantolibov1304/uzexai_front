import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { LANGS, useLang } from "../i18n/LangContext";
import GlobalSearch from "./GlobalSearch";

export default function Layout() {
  const { t, lang, setLang } = useLang();
  const { pathname } = useLocation();

  // Qavs ichida: yangi brauzerlarda scrollTo Promise qaytaradi — useEffect undan cleanup kutmasligi kerak.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const nav = [
    ["/chat", t.nav.chat],
    ["/dashboard", t.nav.dashboard],
    ["/deals", t.nav.deals],
    ["/products", t.nav.products],
    ["/participants", t.nav.participants],
    ["/brokers", t.nav.brokers],
  ];

  return (
    <>
      <header className="header">
        <div className="header__inner">
          <Link to="/" className="logo" aria-label={t.nav.home}>
            Birja<span>·</span>AI
          </Link>
          <nav className="nav" aria-label="Main">
            {nav.map(([to, label]) => (
              <NavLink key={to} to={to}>
                {label}
              </NavLink>
            ))}
          </nav>
          <GlobalSearch />
          <div className="header__right">
            <div className="langs" role="group" aria-label="Language">
              {LANGS.map(([code, label]) => (
                <button key={code} type="button" aria-pressed={code === lang} onClick={() => setLang(code)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>
      {pathname !== "/" && <div className="testbar">{t.common.testData}</div>}
      <main>
        <Outlet />
      </main>
      <footer className="footer">
        <div className="footer__inner">
          <span>© 2026 Birja·AI</span>
          <span>{t.landing.footer}</span>
        </div>
      </footer>
    </>
  );
}
