// FRONTEND_API.md §2 va §8: ming xonalari bo'sh joy bilan, 2 kasr; sanalar DD.MM.YYYY.
const nf2 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });

export const num = (v, digits = 2) => {
  if (v == null || Number.isNaN(v)) return "—";
  return (digits === 0 ? nf0 : digits === 1 ? nf1 : nf2).format(v);
};

export const int = (v) => num(v, 0);

const CUR = { uz: "so‘m", ru: "сум", en: "UZS" };
export const money = (v, cur = "UZS", lang = "uz") => {
  if (v == null) return "—";
  return cur === "USD" ? `${nf2.format(v)} $` : `${nf2.format(v)} ${CUR[lang] ?? "so‘m"}`;
};

// Katta summalar uchun qisqa ko'rinish: 1,23 mlrd so'm
const SCALE = {
  uz: [[1e12, "trln"], [1e9, "mlrd"], [1e6, "mln"], [1e3, "ming"]],
  ru: [[1e12, "трлн"], [1e9, "млрд"], [1e6, "млн"], [1e3, "тыс."]],
  en: [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]],
};
export const compact = (v, lang = "uz") => {
  if (v == null) return "—";
  const abs = Math.abs(v);
  for (const [div, label] of SCALE[lang] ?? SCALE.uz) {
    if (abs >= div) return `${nf2.format(v / div)} ${label}`;
  }
  return nf2.format(v);
};
export const compactMoney = (v, cur = "UZS", lang = "uz") => {
  if (v == null) return "—";
  return cur === "USD" ? `${compact(v, lang)} $` : `${compact(v, lang)} ${CUR[lang] ?? "so‘m"}`;
};

export const pct = (v) => (v == null || !Number.isFinite(v) ? "—" : `${nf1.format(v * 100)} %`);

export const date = (iso) => (iso ? iso.split("-").reverse().join(".") : "—"); // 2025-04-16 → 16.04.2025

export const volume = (v, unit) => (v == null ? "—" : `${nf2.format(v)} ${unit ?? ""}`.trim());

// stats key → o'qiladigan yorliq: "2025-01" → "01.2025", "2025-Q1" → "Q1 2025"
export const periodLabel = (key) => {
  if (!key) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return date(key);
  if (/^\d{4}-\d{2}$/.test(key)) return `${key.slice(5)}.${key.slice(0, 4)}`;
  const q = key.match(/^(\d{4})-Q(\d)$/);
  if (q) return `Q${q[2]} ${q[1]}`;
  return key;
};
