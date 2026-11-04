import { Link } from "react-router-dom";
import { useLang } from "../i18n/LangContext";

export default function NotFound({ message }) {
  const { t } = useLang();
  return (
    <div className="page">
      <div className="container" style={{ textAlign: "center", padding: "60px 24px" }}>
        <div className="page__title" style={{ fontSize: 56, color: "var(--teal-700)" }}>
          404
        </div>
        <p className="page__sub" style={{ marginBottom: 20 }}>
          {message || t.common.notFound}
        </p>
        <Link to="/" className="btn btn--primary">
          {t.common.toHome}
        </Link>
      </div>
    </div>
  );
}
