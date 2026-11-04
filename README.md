# Birja·AI — UZEX Deals frontend (React)

`docs/FRONTEND_API.md` dagi backend uchun React (Vite) frontend. Ma'lumotlar fiktiv test reyestri.

## Ishga tushirish

```bash
npm install
cp .env.example .env      # ixtiyoriy
npm run dev               # http://localhost:5173
```

Backend `http://localhost:8000` da ishlashi kerak. Dev-server `/api` va `/health` ni backendga proxy qiladi
(`vite.config.js`), shuning uchun CORS sozlash shart emas. Boshqa manzil uchun `.env` da `BACKEND_URL=...`.

Production build: `npm run build` → `dist/`. Backend boshqa domenda bo'lsa `VITE_API_URL` ni bering
(yoki nginx'da `/api` ni proxy qiling). **API kalitni brauzer kodiga qo'ymang** — kerak bo'lsa uni proxy/BFF qo'shadi.

## Netlify'ga joylash

Backend: `https://uzex-api.onrender.com` (API kalit yoqilgan, CORS yopiq). Shuning uchun brauzer faqat o'z domeniga
murojaat qiladi, `netlify/edge-functions/api-proxy.js` esa `/api/*` va `/health` ni kalit qo'shib backendga uzatadi.

1. Netlify → **Site configuration → Environment variables**:
   - `UZEX_API_KEY` = backenddagi `UZEX_API_KEYS` dan biri (**Secret** deb belgilang)
   - `UZEX_BACKEND_URL` — ixtiyoriy (default `https://uzex-api.onrender.com`)
2. Deploy (ikkisidan biri):
   - **CLI:** `npm i -g netlify-cli && netlify login && netlify init` (yoki `netlify link`), so'ng `netlify deploy --build --prod`
   - **Git:** loyihani GitHub'ga push qiling → Netlify'da *Import from Git*. Sozlamalar `netlify.toml` dan olinadi.
   - ⚠️ `dist/` ni drag-and-drop qilish **ishlamaydi** — edge function yuklanmaydi va `/api` 404 bo'ladi.

Cheklovlar: edge function javobni 40 soniyada boshlashi kerak (chat odatda 3–20 s). Render bepul tarifida
backend uxlab qolsa birinchi so'rov sekin bo'ladi.

## Sahifalar

| Yo'l | Nima | Endpoint'lar |
|---|---|---|
| `/` | Landing + ixcham AI-chat | `/health`, `POST /chat` |
| `/chat` | To'liq AI-chat ("Qanday hisoblandi?" — trace) | `POST /chat`, `GET/DELETE /chat/sessions/{id}` |
| `/dashboard` | KPI, oylik/yillik aylanma, top tovar/region/kompaniya/broker | `/deals/stats` |
| `/deals` | Bitimlar jadvali, filtrlar (URL'da saqlanadi), saralash, sahifalash | `/deals`, `/reference`, `/products`, `/products/{name}` |
| `/deals/:id` | Bitim kartochkasi, to'lov/yetkazish vaqt chizig'i | `/deals/{id}` |
| `/products`, `/products/:name` | Katalog; narx dinamikasi variant bo'yicha | `/products*`, `/deals/stats` |
| `/participants`, `/participants/:inn` | Kompaniyalar, kartochka, top tovar/kontragentlar | `/participants*`, `/deals`, `/deals/stats` |
| `/brokers`, `/brokers/:code` | Brokerlar | `/brokers*`, `/deals`, `/deals/stats` |
| header | Global qidiruv (300 ms debounce, ≥ 2 belgi) | `/search` |

## Tuzilma

```
src/
  api/        client.js (fetch + ApiError + timeout), endpoints.js, chat.js (sessiya, 404 → yangi sessiya), hooks.js (TanStack Query kesh)
  i18n/       dict.js (uz/ru/en matnlar + API qiymatlari tarjimasi), LangContext.jsx
  lib/        format.js (raqam, summa, sana DD.MM.YYYY)
  components/ Layout, GlobalSearch, ChatPanel, Markdown (GFM + sanitize), Charts (Recharts), DealsTable, ui
  pages/      har bir yo'l uchun sahifa
design-reference/  dizayn maketi (Main.dc.html) — ranglar, shriftlar, landing matnlari shundan olingan
```

## API qoidalari qanday hisobga olingan

- Filtr qiymatlari (holat, auksion, kategoriya…) `/reference` dan olinadi va API'ga **ruscha asl holida** yuboriladi; ekranda tanlangan tilga tarjima qilinadi.
- Turli valyutadagi `amount` qo'shilmaydi — jami summalar `amount_uzs` / `amount_usd` dan.
- `units_mixed: true` bo'lsa hajm/narx "—" / "turli birliklar".
- Narx grafigi `product_variant` bo'yicha chiziladi; 2026 — to'liq bo'lmagan yil sifatida belgilanadi.
- Chat: 120 s timeout, bir vaqtda bitta savol, 404 → `session_id: null` bilan qayta yuborish va "yangi suhbat" xabari, 502 → "Qayta urinish", 503 / `agent_available: false` → chat o'chiq.
- Xatolarda `X-Request-ID` ko'rsatiladi.
- `/reference`, `/products`, `/brokers` — cheksiz kesh; `/deals`, `/deals/stats` — parametrlar bo'yicha 6 soat; `/chat` keshlanmaydi.
