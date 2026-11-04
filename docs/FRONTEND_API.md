# UZEX Deals API — frontend uchun qo‘llanma

Backend ikki xil imkoniyat beradi:

1. **AI-chat** (`POST /api/v1/chat`) — foydalanuvchi o‘zbek, rus yoki ingliz tilida savol beradi. Agent
   (Gemini) ma’lumotlar bazasidan hisoblab, **markdown** formatida javob qaytaradi.
2. **Oddiy REST endpoint’lar** — bitimlar jadvali, filtrlar, grafiklar uchun agregatlar, kompaniya va broker
   kartochkalari, dollar kursi.

Ma’lumotlar o‘ylab topilgan (fiktiv) birja reyestri: 500 000 bitim, **2022-01-03 – 2026-10-30**.
UI’da buni “birja bitimlari reyestri (test ma’lumotlari)” deb ko‘rsating, haqiqiy birja deb emas.

---

## 1. Ulanish

| | |
|---|---|
| Base URL (lokal) | `http://localhost:8000` |
| Prefiks | barcha biznes endpoint’lar `/api/v1/...` ostida, `/health` — prefikssiz |
| Format | JSON, UTF-8 |
| Interaktiv hujjat | `http://localhost:8000/docs` (Swagger), sxema: `/openapi.json` |

Backendni ishga tushirish (backend papkasida):

```bash
.venv/bin/uvicorn uzex_agent.api.app:app --host 0.0.0.0 --port 8000 --workers 1
```

### CORS

Brauzerdan to‘g‘ridan-to‘g‘ri so‘rov yuborish uchun backend `.env` fayliga frontend manzilini yozing:

```
UZEX_CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

Yoki dev-serverda proxy ishlating (Vite: `server.proxy['/api'] = 'http://localhost:8000'`).

### Autentifikatsiya

- Backendda `UZEX_API_KEYS` bo‘sh bo‘lsa, autentifikatsiya yo‘q (lokal ishlab chiqish uchun).
- Kalit berilgan bo‘lsa, `/api/v1/*` uchun `X-API-Key: <kalit>` sarlavhasi kerak, aks holda **401** qaytadi.
- ⚠️ **Kalitni brauzer kodiga qo‘ymang** (`VITE_*` / `NEXT_PUBLIC_*` o‘zgaruvchilari foydalanuvchiga ko‘rinadi).
  Production’da so‘rovlarni o‘z serveringiz (Next.js route handler, BFF, nginx) orqali o‘tkazing va kalitni
  o‘sha yerda qo‘shing.

### OpenAPI’dan tiplarni avtomatik yaratish (ixtiyoriy)

```bash
npx openapi-typescript http://localhost:8000/openapi.json -o src/api/schema.d.ts
```

Quyidagi 9-bo‘limda qo‘lda yozilgan tiplar ham bor.

---

## 2. Umumiy qoidalar (UI’da to‘g‘ri ko‘rsatish uchun muhim)

### Sana va vaqt
- Sanalar `YYYY-MM-DD` (masalan `"2025-04-16"`), vaqt `HH:MM:SS`, Toshkent vaqti. Query parametrlarda ham shu format.
- UI’da `DD.MM.YYYY` ko‘rinishida ko‘rsatish tavsiya etiladi.

### Raqamlar
- Summalar `number` (float). Ekranda ming xonalarini bo‘sh joy bilan ajrating va 2 kasr qoldiring:
  `new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 2 })` yoki `'ru-RU'` (bo‘sh joy bilan ajratadi).
- `amount_usd`, o‘rtacha narxlar 4 kasrgacha yaxlitlangan keladi; ko‘rsatishda 2 kasr yetarli.

### Valyuta
- `amount`, `unit_price`, `start_price` — **shartnoma valyutasida** (`currency`: `"UZS"` yoki `"USD"`;
  USD faqat eksport bitimlarida).
- Turli valyutadagi `amount` larni **qo‘shmang**. Jami summalar uchun `amount_uzs` yoki `amount_usd` dan foydalaning
  (bitim kunidagi kurs bo‘yicha hisoblangan).

### O‘lchov birliklari
- `volume` = `quantity_lots × lot_size`, birligi `unit` da (`тонна`, `килограмм`, `литр`, `штука`, …).
- Bitta tovar turli birlikda bo‘lishi mumkin (dizel — kg va tonna; benzin — litr va tonna). Hajmlarni qo‘shishda
  `volume_base` / `base_unit` dan foydalaning (kg → tonna). Litr va tonnani qo‘shib bo‘lmaydi.
- `/deals/stats` da guruh ichida birliklar aralash bo‘lsa, `units_mixed: true` va `volume_base`, `base_unit`,
  `avg_price_uzs_per_base_unit` = `null`. UI’da “—” yoki “turli birliklar” deb ko‘rsating.

### Bekor qilingan bitimlar
- `status = "Аннулирован(Не оплачен)"` (`is_cancelled: true`) — bitim amalga oshmagan.
- `/deals` ro‘yxatida ular sukut bo‘yicha **bor** (`include_cancelled=true`).
- `/deals/stats` da `deal_count` barcha bitimlarni sanaydi, `cancelled_count` alohida, summa/hajm/narx esa
  sukut bo‘yicha bekor qilinganlarsiz.

### Filtr qiymatlari ruscha/lotincha — aniq yozilishi shart
- Holat, auksion turi, kategoriya, tovar nomi kabi qiymatlar ma’lumotdagi kabi (ruscha) keladi va filtrda **aynan
  shunday** yuborilishi kerak. Qiymatlar ro‘yxatini `GET /api/v1/reference` va `GET /api/v1/products` dan oling,
  qo‘lda yozmang.
- Regionlar lotin o‘zbekchada, `‘` belgisi bilan: `"Farg‘ona viloyati"`, `"Qoraqalpog‘iston Respublikasi"`.
- Kirill harfli qiymatlarni URL’da kodlang: `URLSearchParams` / `encodeURIComponent` buni avtomatik qiladi.
- Ko‘rsatish uchun tarjima lug‘ati (UI matni):

| Qiymat (API) | UI’da (uz) |
|---|---|
| `Новый` | Yangi (30.10.2026 da tuzilgan) |
| `Не подписан` | Imzolanmagan |
| `Заключен` | Tuzilgan (forvard/fyuchers, to‘lov kutilmoqda) |
| `Ждёт оплату` | To‘lov kutilmoqda |
| `Оплачен` | To‘langan, yetkazilmagan |
| `Исполнен` | Bajarilgan |
| `Исполнен(Частично)` | Qisman bajarilgan |
| `Аннулирован(Не оплачен)` | Bekor qilingan (to‘lanmagan) |
| `Английский аукцион` / `Обратный аукцион` / `Двусторонний аукцион` | Ingliz / Teskari / Ikki tomonlama auksion |
| `Внутренний` / `Экспортный` | Ichki / Eksport |
| `Спот` / `Форвард` / `Фьючерс` | Spot / Forvard / Fyuchers |

Tovarlarning o‘zbekcha nomi API’da tayyor: `product_uz`.

### Xatolar

Barcha xatolar JSON:

| Kod | Qachon | `detail` |
|---|---|---|
| 400 | Mantiqiy xato (masalan `date_from > date_to`) | matn |
| 401 | `X-API-Key` noto‘g‘ri yoki yo‘q | matn |
| 404 | Bitim/kompaniya/tovar/sessiya topilmadi | matn |
| 422 | Parametr formati noto‘g‘ri (FastAPI validatsiyasi) | massiv: `[{loc, msg, type, ...}]` |
| 502 | AI xizmati (Gemini) xatosi | matn |
| 503 | AI-agent sozlanmagan (backendda `GEMINI_API_KEY` yo‘q) | matn |

```json
{ "detail": "Bitim 1 topilmadi." }
```
```json
{ "detail": [ { "type": "literal_error", "loc": ["query", "sort"], "msg": "Input should be 'amount_usd', ... or 'volume'", "input": "foo" } ] }
```

Har bir javobda `X-Request-ID` sarlavhasi bor. Xato haqida xabar berishda shu ID’ni ko‘rsating; so‘rovda o‘zingiz ham
`X-Request-ID` yuborishingiz mumkin.

---

## 3. AI-chat

### `POST /api/v1/chat`

So‘rov:

```json
{
  "question": "2025-yilda jami necha tonna dizel yoqilg'isi sotilgan?",
  "session_id": null,
  "include_trace": false
}
```

| Maydon | Tip | |
|---|---|---|
| `question` | string, 1–2000 belgi | majburiy |
| `session_id` | string \| null | birinchi savolda `null`, keyingilarida javobdagi `session_id` |
| `include_trace` | boolean | `true` bo‘lsa agent bajargan SQL so‘rovlar va natijalari qaytadi (debug/“qanday hisoblandi?” paneli uchun) |

Javob (200):

```json
{
  "session_id": "e4d7683ad01b4b809821043d97346e74",
  "answer": "2025-yilda birja savdolarida jami **176 179.86 tonna** dizel yoqilg‘isi (*Дизельное топливо*) sotilgan.\n\n**Hisob asosi:**\n* **Davr:** 01.01.2025 – 31.12.2025\n...\n\n| Shartnoma o‘lchov birligi | Bitimlar soni | ... |\n| :--- | :---: | ... |",
  "tool_calls": 4,
  "duration_sec": 15.8,
  "usage": { "input_tokens": 31250, "output_tokens": 1830 }
}
```

`include_trace: true` bo‘lsa, qo‘shimcha:

```json
"trace": [
  {
    "tool": "run_sql",
    "args": { "sql": "SELECT unit, sum(volume_base) ... FROM deals WHERE product = 'Дизельное топливо' AND year = 2025 AND NOT is_cancelled GROUP BY unit", "purpose": "2025 dizel hajmi birliklar bo'yicha" },
    "error": null,
    "row_count": 2,
    "result": { "columns": ["unit", "volume_t"], "rows": [["тонна", 116337.0], ["килограмм", 59842.859]], "row_count": 2, "truncated": false }
  },
  {
    "tool": "find_entity",
    "args": { "query": "Pudexiz Plast" },
    "error": null,
    "row_count": 1,
    "result": { "matches": [ { "kind": "participant", "id": "975923536", "name": "\"Pudexiz Plast\" MChJ", "...": "..." } ] }
  }
]
```

### Chat UI talablari

- **Javobni markdown sifatida render qiling**: qalin matn, ro‘yxatlar va **jadvallar** (GFM) keladi.
  React: `react-markdown` + `remark-gfm`. Vue: `markdown-it`. HTML’ni sanitizatsiya qiling (`rehype-sanitize` / DOMPurify).
- **Javob vaqti 3–20 soniya** (agent bir nechta SQL so‘rov bajaradi), streaming yo‘q. Shuning uchun:
  - “Hisoblanmoqda…” indikatori ko‘rsating, yuborish tugmasini bloklang;
  - fetch timeout’ini kamida **90 soniya** qiling;
  - bitta sessiyada bir vaqtda faqat bitta savol yuboring (backend baribir navbatga qo‘yadi).
- `session_id` ni saqlang (state yoki `sessionStorage`) va keyingi savollarda yuboring. Shunda agent oldingi
  savollarni eslaydi (“endi shuni 2024 bilan solishtir”).
- Sessiya **1 soat** faol bo‘lmasa o‘chadi; backend qayta ishga tushganda ham o‘chadi. Eski `session_id` bilan
  so‘rov **404** qaytaradi. Bunday holda `session_id: null` bilan savolni qayta yuboring va foydalanuvchiga
  “yangi suhbat boshlandi” deb ko‘rsating.
- **502** — vaqtinchalik xato: “Qayta urinish” tugmasini ko‘rsating, sessiya buzilmaydi.
- **503** — chat o‘chirilgan. `GET /health` dagi `agent_available: false` bo‘lsa, chat oynasini yashiring yoki
  o‘chiq holatda ko‘rsating.
- “Yangi suhbat” tugmasi: `DELETE /api/v1/chat/sessions/{id}` (ixtiyoriy) va `session_id = null`.
- Ixtiyoriy “Qanday hisoblandi?” paneli: `include_trace: true` bilan so‘rang va `trace[].args.purpose` +
  `trace[].args.sql` ni ko‘rsating.
- Namuna savollar (bo‘sh chat ekrani uchun):
  - “2025-yilda eng ko‘p sotilgan 5 ta tovar (so‘mda)?”
  - “Paxta xomashyosi 1-sort 1-klassning 2026-yil sentabrdagi o‘rtacha narxi?”
  - “Pudexiz Plast qaysi xaridorlarga eng ko‘p sotgan?”
  - “2024 va 2025 yillarda eksport hajmini solishtir”

### `GET /api/v1/chat/sessions/{session_id}`

```json
{
  "session_id": "e4d7...",
  "created_at": 1793785200.12,
  "messages": [
    { "question": "2024-yilda nechta bitim?", "answer": "…markdown…", "at": 1793785206.5 }
  ]
}
```
`created_at`, `at` — Unix soniyalar (`new Date(at * 1000)`).

### `DELETE /api/v1/chat/sessions/{session_id}` → 204 (topilmasa 404)

---

## 4. Bitimlar

### `GET /api/v1/deals` — ro‘yxat (jadval)

Query parametrlar (hammasi ixtiyoriy, birlashtirib ishlatiladi — AND):

| Parametr | Misol | Izoh |
|---|---|---|
| `date_from`, `date_to` | `2025-01-01` | bitim sanasi oralig‘i (ikkalasi ham kiradi) |
| `year` | `2025` | |
| `product` | `Хлопок-сырец` | kanonik nom — `/products` dan |
| `product_variant` | `Хлопок-сырец, сорт 1, класс 1` | `/products/{name}` → `variants` dan |
| `product_grade` | `высший`, `1`, `2`, `3` | sort |
| `product_class` | `1`…`4`, `А500С` | klass |
| `brand` | `АИ-92`, `ДТ-Е-К5` | marka (normallashtirilgan) |
| `category`, `industry` | `Нефтепродукты` | `/reference` dan |
| `region` | `Toshkent shahri` | sotuvchi omborining regioni |
| `status`, `contract_type`, `contract_form`, `auction_type` | `Исполнен` | `/reference` dan |
| `currency` | `UZS` \| `USD` | |
| `contract_id` | `100469` | |
| `seller_inn`, `buyer_inn` | `975923536` | |
| `participant_inn` | `975923536` | sotuvchi **yoki** xaridor sifatida |
| `seller_broker`, `buyer_broker`, `broker` | `BK003` | `broker` — ikkala tomondan biri |
| `min_amount_uzs`, `max_amount_uzs` | `1000000000` | |
| `include_cancelled` | `true` (default) | `false` — bekor qilinganlarsiz |
| `page` | `1` (default) | ≥ 1 |
| `page_size` | `50` (default) | 1–500 |
| `sort` | `deal_id` (default) | `deal_id`, `deal_ts`, `deal_date`, `amount_uzs`, `amount_usd`, `volume`, `unit_price_uzs`, `quantity_lots` |
| `order` | `asc` (default) \| `desc` | |

Misol: `GET /api/v1/deals?product=Карбамид&year=2025&page_size=20&sort=amount_uzs&order=desc`

```json
{
  "items": [
    {
      "deal_id": 409277,
      "deal_date": "2025-04-16",
      "deal_time": "10:37:03",
      "product": "Карбамид",
      "product_variant": "Карбамид, марка Б",
      "quantity_lots": 657,
      "lot_size": 1.0,
      "unit": "тонна",
      "volume": 657.0,
      "currency": "UZS",
      "amount": 3437823456.0,
      "unit_price": 5232608.0,
      "amount_uzs": 3437823456.0,
      "amount_usd": 272598.8742,
      "region": "Samarqand viloyati",
      "status": "Исполнен",
      "contract_type": "Внутренний",
      "contract_form": "Спот",
      "auction_type": "Английский аукцион",
      "seller_inn": "977584284",
      "seller_name": "TANA CHEM MCHJ",
      "buyer_inn": "923972854",
      "buyer_name": "\"Ruzol Trade\" MChJ",
      "seller_broker": "BK108",
      "buyer_broker": "BK067"
    }
  ],
  "total": 2565,
  "page": 1,
  "page_size": 20,
  "pages": 129
}
```

Tavsiya etilgan jadval ustunlari: № (`deal_id`), sana, tovar (`product_variant`), hajm (`volume` + `unit`),
summa (`amount` + `currency`), birlik narxi (`unit_price`), holat (rangli badge), sotuvchi, xaridor.
Qator bosilganda → `GET /api/v1/deals/{deal_id}`.

### `GET /api/v1/deals/{deal_id}` — bitim kartochkasi

Ro‘yxatdagi barcha maydonlar + qo‘shimcha:

```json
{
  "deal_id": 178577,
  "...": "ro‘yxatdagi maydonlar",
  "year": 2022, "quarter": 4, "month": 12,
  "is_cancelled": false,
  "contract_id": 100469,
  "product_uz": "Polivinilxlorid (PVX)",
  "brand": "SG-5", "product_size": null, "product_grade": null, "product_class": null,
  "product_type": "суспензионный",
  "hs_code": "390410",
  "product_group": "Высоколиквидные товары",
  "category": "Полимерная продукция",
  "industry": "Химическая промышленность",
  "product_name_raw": "Поливинилхлорид Марка SG-5 Тип суспензионный",
  "base_unit": "тонна", "volume_base": 11.0,
  "start_price": 12547796.0,
  "usd_rate": 11067.78,
  "unit_price_uzs": 12547796.0,
  "base_unit_price_uzs": 12547796.0,
  "seller_broker_name": "RAMI BROKER MCHJ",
  "buyer_broker_name": "\"Dubufe Broker\" MChJ",
  "payment_term_days": 8,
  "delivery_term_days": 17,
  "payment_due_date": "2022-12-14",
  "payment_date": "2022-12-13",
  "days_to_payment": 7,
  "delivery_date": "2022-12-22",
  "days_to_delivery": 9,
  "delivered_lots": 11,
  "delivered_volume": 11.0
}
```

`payment_date`, `delivery_date`, `delivered_lots`, `days_to_*` — hali bo‘lmagan bo‘lsa `null`.
Kartochkada “To‘lov: muddat `payment_due_date`, to‘langan `payment_date` (`days_to_payment` kunda)” kabi
vaqt chizig‘i qulay. `product_name_raw` — reyestrdagi asl yozuv (sotuvchi qanday yozgan bo‘lsa).

### `GET /api/v1/deals/stats` — grafik va KPI uchun agregatlar

`/deals` dagi barcha filtrlar + quyidagilar:

| Parametr | Default | Qiymatlar |
|---|---|---|
| `group_by` | yo‘q (bitta “all” qatori) | `year`, `quarter`, `month`, `date`, `product`, `product_variant`, `category`, `industry`, `region`, `status`, `contract_type`, `contract_form`, `auction_type`, `currency`, `seller`, `buyer`, `seller_broker`, `buyer_broker` |
| `include_cancelled` | `false` | summa/hajm/narxga bekor qilinganlarni qo‘shish |
| `order_by` | `amount_uzs` | `amount_uzs`, `amount_usd`, `deal_count`, `volume_base`, `key`. Vaqt bo‘yicha guruhlar (`year`, `quarter`, `month`, `date`) avtomatik xronologik tartibda |
| `limit` | `100` | 1–1000 |

Misol: `GET /api/v1/deals/stats?year=2025&product=Сахар&group_by=month`

```json
{
  "group_by": "month",
  "money_and_volume_include_cancelled": false,
  "rows": [
    {
      "key": "2025-01",
      "label": null,
      "deal_count": 210,
      "cancelled_count": 17,
      "amount_uzs": 100944600477.0,
      "amount_usd": 8114446.6708,
      "base_unit": "тонна",
      "volume_base": 7562.0,
      "avg_price_uzs_per_base_unit": 13348928.9179,
      "units_mixed": false
    }
  ]
}
```

| Maydon | Ma’nosi |
|---|---|
| `key` | guruh qiymati: `"2025"`, `"2025-Q1"`, `"2025-01"`, `"2025-01-15"`, tovar nomi, STIR, broker kodi… Guruhsiz — `"all"` |
| `label` | odam o‘qiydigan nom: `product` → o‘zbekcha nom, `seller`/`buyer` → kompaniya nomi, `*_broker` → broker nomi; boshqalarida `null` |
| `deal_count` | barcha bitimlar (bekor qilinganlar ham) |
| `cancelled_count` | shundan bekor qilinganlar |
| `amount_uzs`, `amount_usd` | summa (sukut bo‘yicha bekor qilinganlarsiz) |
| `volume_base`, `base_unit` | hajm asosiy birlikda (kg → tonna); birliklar aralash bo‘lsa `null` |
| `avg_price_uzs_per_base_unit` | hajm bo‘yicha tortilgan o‘rtacha narx, so‘m / `base_unit` |
| `units_mixed` | guruhda turli birliklar bor (hajm va narxni ko‘rsatmang) |

Tipik ishlatilishi:

| UI elementi | So‘rov |
|---|---|
| KPI kartochkalar (jami bitim, aylanma, bekor qilish ulushi) | `/deals/stats?year=2025` → `rows[0]`; ulush = `cancelled_count / deal_count` |
| Oylik aylanma grafigi | `/deals/stats?year=2025&group_by=month` |
| Yillar bo‘yicha dinamika | `/deals/stats?group_by=year` (2026 — 30-oktabrgacha, to‘liq bo‘lmagan yil — grafikda belgilang) |
| Top-10 tovar | `/deals/stats?year=2025&group_by=product&limit=10` |
| Regionlar xaritasi | `/deals/stats?year=2025&group_by=region` |
| Top sotuvchilar / xaridorlar | `group_by=seller` / `group_by=buyer`, `label` = nom |
| Brokerlar reytingi | `group_by=seller_broker` yoki `buyer_broker` |
| Tovar narxi dinamikasi | `/deals/stats?product_variant=Хлопок-сырец, сорт 1, класс 1&group_by=month` → `avg_price_uzs_per_base_unit` |

Narx grafigini **variant** (`product_variant`) bo‘yicha chizing — bir tovarning turli sort va markalari narxi
sezilarli farq qiladi.

---

## 5. Katalog va qidiruv

### `GET /api/v1/reference` — filtr dropdown’lari uchun (ilova ochilganda bir marta oling va keshlang)

```json
{
  "period": { "first_deal_date": "2022-01-03", "last_deal_date": "2026-10-30", "deals": 500000 },
  "regions": [ { "region": "Andijon viloyati", "region_ru": "Андижанская область" } ],
  "status": ["Аннулирован(Не оплачен)", "Ждёт оплату", "Заключен", "Исполнен", "Исполнен(Частично)", "Не подписан", "Новый", "Оплачен"],
  "auction_type": ["Английский аукцион", "Двусторонний аукцион", "Обратный аукцион"],
  "contract_type": ["Внутренний", "Экспортный"],
  "contract_form": ["Спот", "Форвард", "Фьючерс"],
  "currency": ["USD", "UZS"],
  "unit": ["кв.метр", "килограмм", "куб.метр", "литр", "метр", "тонна", "штука"],
  "category": ["Металлопродукция", "Нефтепродукты", "..."],
  "industry": ["Лесная промышленность", "..."],
  "product_group": ["Высоколиквидные товары", "Прочие товары"],
  "activity": ["Кластер", "Перерабатывающее предприятие", "..."],
  "role": ["Покупатель", "Продавец"]
}
```

`period` dan sana tanlagichning `min`/`max` chegaralarini oling.

### `GET /api/v1/products?category=...` — tovarlar ro‘yxati (41 ta)

```json
[
  {
    "product": "Дизельное топливо",
    "product_uz": "Dizel yoqilg‘isi",
    "hs_code": "271019",
    "category": "Нефтепродукты",
    "industry": "Нефтегазовая промышленность",
    "units": "тонна, килограмм",
    "n_contracts": 74,
    "n_deals": 28747
  }
]
```

Dropdown’da `product_uz (product)` ko‘rsatib, filtrga `product` ni yuboring.

### `GET /api/v1/products/{product}` — tovar va uning variantlari

`GET /api/v1/products/Пшеница` (yo‘ldagi kirill matnni `encodeURIComponent` bilan kodlang):

```json
{
  "product": "Пшеница",
  "product_uz": "Bug‘doy",
  "...": "…",
  "raw_name_variants": ["ПШЕНИЦА ПРОДОВОЛЬСТВЕННАЯ", "Пшеница", "Пшеница 3-класс", "..."],
  "variants": [
    { "product_variant": "Пшеница, класс 3", "product_grade": null, "product_class": "3", "brand": null, "product_size": null, "product_type": null, "n_deals": 17152 },
    { "product_variant": "Пшеница, класс 4", "product_grade": null, "product_class": "4", "brand": null, "product_size": null, "product_type": null, "n_deals": 21471 }
  ]
}
```

`variants` — ikkinchi darajali filtr (“Variant”) uchun. `raw_name_variants` sotuvchilar shu tovarni qanday
turlicha yozganini ko‘rsatadi (ma’lumot uchun).

### `GET /api/v1/search?q=...&kind=any|participant|broker&limit=10` — global qidiruv / autocomplete

Kirill va lotin yozuviga, katta-kichik harfga, qo‘shtirnoqlarga, “MChJ/XK” kabi shakllarga e’tibor bermaydi va
kichik xatolarni kechiradi. STIR (9 raqam) yoki broker kodi (`BK003`) bo‘yicha ham ishlaydi.

```json
[
  {
    "kind": "participant",
    "id": "915688255",
    "name": "\"ҲАРАЙЎМ КИМЁ\" МЧЖ",
    "region": "Qashqadaryo viloyati",
    "info": "Продавец, Торговая компания",
    "similarity": 0.917,
    "deals_as_seller_side": 10608,
    "deals_as_buyer_side": 0
  }
]
```

`kind = "participant"` → `/participants/{id}` sahifasiga, `kind = "broker"` → `/brokers/{id}` sahifasiga o‘ting.
Autocomplete uchun 250–300 ms debounce va kamida 2 belgi tavsiya etiladi.

### `GET /api/v1/participants` — kompaniyalar ro‘yxati

Parametrlar: `search` (nom bo‘lagi yoki STIR), `role` (`Продавец` | `Покупатель`), `region`, `activity`,
`page`, `page_size` (≤ 500). Javob: `{ items: Participant[], total, page, page_size, pages }`.

### `GET /api/v1/participants/{inn}` — kompaniya kartochkasi

```json
{
  "inn": "915688255",
  "name": "\"ҲАРАЙЎМ КИМЁ\" МЧЖ",
  "name_latin": "\"harayom kimyo\" mchj",
  "region": "Qashqadaryo viloyati",
  "activity": "Торговая компания",
  "role": "Продавец",
  "vat_payer": true,
  "trading": {
    "deals_as_seller": 10608,
    "deals_as_buyer": 0,
    "cancelled_deals": 780,
    "sold_amount_uzs": 4252147381976.0,
    "bought_amount_uzs": 0.0,
    "first_deal_date": "2022-01-03",
    "last_deal_date": "2026-10-30"
  }
}
```

Kartochka ichidagi bitimlar jadvali: `/deals?participant_inn={inn}`. Top tovarlari:
`/deals/stats?seller_inn={inn}&group_by=product`. Top xaridorlari: `/deals/stats?seller_inn={inn}&group_by=buyer`.

### `GET /api/v1/brokers?region=...` va `GET /api/v1/brokers/{code}`

```json
{
  "broker_code": "BK003",
  "name": "\"ҚОПУР БРОКЕР\" МЧЖ",
  "name_latin": "\"qopur broker\" mchj",
  "inn": "951560029",
  "region": "Andijon viloyati",
  "trading": {
    "deals_seller_side": 526,
    "deals_buyer_side": 3261,
    "seller_side_amount_uzs": 216583459209.1048,
    "buyer_side_amount_uzs": 1505417795440.304,
    "first_deal_date": "2022-01-05",
    "last_deal_date": "2026-10-30"
  }
}
```

Ro‘yxat endpoint’i sahifalanmaydi (jami 120 ta broker). Broker bitimlari: `/deals?broker=BK003`.

### Dollar kursi

- `GET /api/v1/usd-rates/{date}` → `{ "date": "2023-06-15", "rate": 11372.66 }` (so‘m / 1 USD)
- `GET /api/v1/usd-rates?date_from=2026-10-28&date_to=2026-10-30` → `[{ "date": "...", "rate": ... }]` (oraliq ≤ 10 yil)

### `GET /health` (autentifikatsiyasiz)

```json
{ "status": "ok", "deals": 500000, "agent_available": true, "model": "gemini-3.5-flash", "active_sessions": 3 }
```

---

## 6. Tavsiya etilgan sahifalar

| Sahifa | Endpoint’lar |
|---|---|
| **AI-chat** (asosiy) | `POST /chat`, `GET /health` (chat yoqilganmi) |
| **Dashboard** | `/deals/stats` (KPI, `group_by=month`, `product`, `region`), `/reference` |
| **Bitimlar** | `/deals` + filtr paneli (`/reference`, `/products`, `/products/{name}` → variantlar), `/deals/{id}` |
| **Tovar** | `/products/{name}`, `/deals/stats?product=…&group_by=month` (narx dinamikasi), `group_by=product_variant` |
| **Kompaniya** | `/participants/{inn}`, `/deals?participant_inn=…`, `/deals/stats?seller_inn=…&group_by=buyer` |
| **Broker** | `/brokers/{code}`, `/deals?broker=…` |
| **Global qidiruv** (header) | `/search?q=…` |

---

## 7. Keshlash

Ma’lumotlar faqat o‘qiladi va backend qayta qurilmaguncha o‘zgarmaydi:

- `/reference`, `/products`, `/brokers` — ilova ishlayotgan vaqt davomida keshlang.
- `/deals`, `/deals/stats` — so‘rov parametrlari bo‘yicha keshlang (TanStack Query: `staleTime: Infinity` yoki bir necha soat).
- `/chat` — keshlamang.

---

## 8. Misollar (TypeScript)

### API klient

```ts
const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, public detail: unknown, public requestId?: string | null) {
    super(typeof detail === "string" ? detail : `HTTP ${status}`);
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

function toSearch(q?: Query): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q ?? {})) {
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function api<T>(
  path: string,
  opts: { method?: string; query?: Query; body?: unknown; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30_000);
  opts.signal?.addEventListener("abort", () => ctrl.abort());
  try {
    const res = await fetch(`${BASE_URL}${path}${toSearch(opts.query)}`, {
      method: opts.method ?? "GET",
      headers: opts.body ? { "Content-Type": "application/json" } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
    });
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, data?.detail ?? data, res.headers.get("X-Request-ID"));
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}
```

### Chat (sessiya muddati o‘tganini avtomatik hal qilish bilan)

```ts
let sessionId: string | null = sessionStorage.getItem("uzex_session");

export async function ask(question: string, includeTrace = false): Promise<ChatResponse> {
  const send = (sid: string | null) =>
    api<ChatResponse>("/api/v1/chat", {
      method: "POST",
      body: { question, session_id: sid, include_trace: includeTrace },
      timeoutMs: 90_000,
    });
  let res: ChatResponse;
  try {
    res = await send(sessionId);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404 && sessionId) {
      res = await send(null);               // sessiya o‘chgan — yangisini boshlaymiz
    } else {
      throw e;                               // 502 → "Qayta urinish", 503 → chat o‘chiq
    }
  }
  sessionId = res.session_id;
  sessionStorage.setItem("uzex_session", sessionId);
  return res;
}

export function newConversation() {
  if (sessionId) api(`/api/v1/chat/sessions/${sessionId}`, { method: "DELETE" }).catch(() => {});
  sessionId = null;
  sessionStorage.removeItem("uzex_session");
}
```

### Markdown render (React)

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

export const Answer = ({ text }: { text: string }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{text}</ReactMarkdown>
);
```

### Bitimlar va statistika

```ts
const page = await api<Page<DealSummary>>("/api/v1/deals", {
  query: { product: "Карбамид", year: 2025, page: 1, page_size: 50, sort: "amount_uzs", order: "desc" },
});

const monthly = await api<StatsResponse>("/api/v1/deals/stats", {
  query: { year: 2025, product: "Сахар", group_by: "month" },
});
const chartData = monthly.rows.map(r => ({
  month: r.key,
  turnoverBln: r.amount_uzs / 1e9,
  price: r.units_mixed ? null : r.avg_price_uzs_per_base_unit,
}));

const product = await api<ProductDetail>(`/api/v1/products/${encodeURIComponent("Хлопок-сырец")}`);
```

### Formatlash

```ts
const nf = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });   // 1 234 567,89
export const money = (v: number, cur: "UZS" | "USD") => `${nf.format(v)} ${cur === "UZS" ? "so‘m" : "$"}`;
export const date = (iso: string) => iso.split("-").reverse().join(".");    // 2025-04-16 → 16.04.2025
export const volume = (v: number, unit: string) => `${nf.format(v)} ${unit}`;
```

---

## 9. TypeScript tiplari

```ts
export interface Page<T> { items: T[]; total: number; page: number; page_size: number; pages: number }

// ---- chat ----
export interface ChatRequest { question: string; session_id?: string | null; include_trace?: boolean }
export interface ToolTrace {
  tool: "run_sql" | "find_entity";
  args: Record<string, unknown>;          // run_sql: { sql, purpose }, find_entity: { query, kind? }
  error?: string | null;
  row_count?: number | null;
  result: Record<string, unknown>;
}
export interface ChatResponse {
  session_id: string;
  answer: string;                          // markdown
  tool_calls: number;
  duration_sec: number;
  usage: { input_tokens: number; output_tokens: number };
  trace?: ToolTrace[];
}
export interface ChatHistory {
  session_id: string;
  created_at: number;                      // unix seconds
  messages: { question: string; answer: string; at: number }[];
}

// ---- deals ----
export type Currency = "UZS" | "USD";
export type SortField = "deal_id" | "deal_ts" | "deal_date" | "amount_uzs" | "amount_usd" | "volume" | "unit_price_uzs" | "quantity_lots";
export type GroupBy = "year" | "quarter" | "month" | "date" | "product" | "product_variant" | "category" | "industry"
  | "region" | "status" | "contract_type" | "contract_form" | "auction_type" | "currency"
  | "seller" | "buyer" | "seller_broker" | "buyer_broker";

export interface DealQuery {
  date_from?: string; date_to?: string; year?: number;
  product?: string; product_variant?: string; product_grade?: string; product_class?: string; brand?: string;
  category?: string; industry?: string; region?: string; status?: string;
  contract_type?: string; contract_form?: string; auction_type?: string; currency?: Currency;
  contract_id?: number; seller_inn?: string; buyer_inn?: string; participant_inn?: string;
  seller_broker?: string; buyer_broker?: string; broker?: string;
  min_amount_uzs?: number; max_amount_uzs?: number;
}

export interface DealSummary {
  deal_id: number; deal_date: string; deal_time: string;
  product: string; product_variant: string;
  quantity_lots: number; lot_size: number; unit: string; volume: number;
  currency: Currency; amount: number; unit_price: number; amount_uzs: number; amount_usd: number;
  region: string; status: string; contract_type: string; contract_form: string; auction_type: string;
  seller_inn: string; seller_name: string; buyer_inn: string; buyer_name: string;
  seller_broker: string; buyer_broker: string;
}

export interface DealDetail extends DealSummary {
  year: number; quarter: number; month: number; is_cancelled: boolean; contract_id: number;
  product_uz: string; brand: string | null; product_size: string | null; product_grade: string | null;
  product_class: string | null; product_type: string | null; hs_code: string; product_group: string;
  category: string; industry: string; product_name_raw: string;
  base_unit: string; volume_base: number; start_price: number; usd_rate: number;
  unit_price_uzs: number; base_unit_price_uzs: number;
  seller_broker_name: string; buyer_broker_name: string;
  payment_term_days: number; delivery_term_days: number; payment_due_date: string;
  payment_date: string | null; days_to_payment: number | null;
  delivery_date: string | null; days_to_delivery: number | null;
  delivered_lots: number | null; delivered_volume: number | null;
}

export interface StatsRow {
  key: string; label: string | null;
  deal_count: number; cancelled_count: number;
  amount_uzs: number; amount_usd: number;
  base_unit: string | null; volume_base: number | null; avg_price_uzs_per_base_unit: number | null;
  units_mixed: boolean;
}
export interface StatsResponse { group_by: GroupBy | null; money_and_volume_include_cancelled: boolean; rows: StatsRow[] }

// ---- catalog ----
export interface Product {
  product: string; product_uz: string; hs_code: string; category: string; industry: string;
  units: string; n_contracts: number; n_deals: number;
}
export interface ProductVariant {
  product_variant: string; product_grade: string | null; product_class: string | null; brand: string | null;
  product_size: string | null; product_type: string | null; n_deals: number;
}
export interface ProductDetail extends Product { raw_name_variants: string[]; variants: ProductVariant[] }

export interface Participant {
  inn: string; name: string; name_latin: string; region: string; activity: string;
  role: "Продавец" | "Покупатель"; vat_payer: boolean;
}
export interface ParticipantDetail extends Participant {
  trading: {
    deals_as_seller: number; deals_as_buyer: number; cancelled_deals: number;
    sold_amount_uzs: number; bought_amount_uzs: number;
    first_deal_date: string | null; last_deal_date: string | null;
  };
}

export interface Broker { broker_code: string; name: string; name_latin: string; inn: string; region: string }
export interface BrokerDetail extends Broker {
  trading: {
    deals_seller_side: number; deals_buyer_side: number;
    seller_side_amount_uzs: number; buyer_side_amount_uzs: number;
    first_deal_date: string | null; last_deal_date: string | null;
  };
}

export interface EntityMatch {
  kind: "participant" | "broker"; id: string; name: string; region: string; info: string;
  similarity: number; deals_as_seller_side: number; deals_as_buyer_side: number;
}

export interface UsdRate { date: string; rate: number }

export interface ReferenceData {
  period: { first_deal_date: string; last_deal_date: string; deals: number };
  regions: { region: string; region_ru: string }[];
  status: string[]; auction_type: string[]; contract_type: string[]; contract_form: string[];
  currency: string[]; unit: string[]; category: string[]; industry: string[]; product_group: string[];
  activity: string[]; role: string[];
}

export interface Health {
  status: string; deals: number; agent_available: boolean; model: string | null; active_sessions: number;
}

export type ApiErrorBody =
  | { detail: string }
  | { detail: { loc: (string | number)[]; msg: string; type: string; input?: unknown }[] };
```

---

## 10. Tez-tez uchraydigan xatolar

| Muammo | Sabab / yechim |
|---|---|
| Filtr bilan 0 natija | Qiymat aniq emas (masalan `Farg'ona` o‘rniga `Farg‘ona`, `Исполнен ` oxirida bo‘sh joy bilan). Qiymatlarni `/reference` dan oling |
| Brauzerda CORS xatosi | Backend `.env` dagi `UZEX_CORS_ORIGINS` ga frontend manzilini qo‘shing yoki dev-proxy ishlating |
| Chat 404 qaytardi | Sessiya o‘chgan → `session_id: null` bilan qayta yuboring (8-bo‘limdagi misol) |
| Chat fetch “abort” bo‘ldi | Timeout juda qisqa — kamida 90 soniya qiling |
| Jadvallar chatda xom matn bo‘lib chiqyapti | Markdown render’da GFM (`remark-gfm`) yoqilmagan |
| Grafikda hajm yo‘q | `units_mixed: true` — guruhda turli o‘lchov birliklari bor. Tovar yoki variant bo‘yicha filtrlang |
| Turli valyutadagi summalar noto‘g‘ri qo‘shildi | `amount` emas, `amount_uzs` / `amount_usd` ni qo‘shing |
