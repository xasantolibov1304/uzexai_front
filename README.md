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

Faqat bitta sahifa: AI-chat. Istalgan yo'l chatni ochadi.

Endpoint'lar: `/health`, `POST /api/v1/chat`, `GET/DELETE /api/v1/chat/sessions/{id}`.

## Tuzilma

```
src/
  main.jsx    kirish nuqtasi
  Chat.jsx    chat sahifasi (bo'sh holat kartalari, suhbat, kiritish maydoni)
  api.js      fetch + ApiError + timeout, sessiya (404 → yangi sessiya)
  i18n.jsx    uz/ru/en matnlar, LangProvider
  styles.css  barcha uslublar
```

## API qoidalari qanday hisobga olingan

- Chat: 120 s timeout, bir vaqtda bitta savol, 404 → `session_id: null` bilan qayta yuborish va "yangi suhbat" xabari, 502 → "Qayta urinish", 503 / `agent_available: false` → chat o'chiq.
- Xatolarda `X-Request-ID` ko'rsatiladi.
