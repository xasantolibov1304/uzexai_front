// Canned replies for testing the interface without calling the AI (open the site with ?mock).
// Every figure here is invented, so each answer says so and names are obviously placeholders.
import { ApiError } from "./api.js";

const LANG_KEY = "uzex_lang";

const NOTE = {
  uz: "*Demo javob: raqamlar o‘ylab topilgan, AI ishlatilmagan.*",
  ru: "*Демо-ответ: цифры вымышленные, AI не использовался.*",
  en: "*Demo answer: the figures are made up and no AI was used.*",
};

const TEXT = {
  uz: {
    intro: "Demo so‘rov bo‘yicha natija:",
    head: "| № | Tovar | Summa (so‘m) | Bitimlar |",
    wideHead: "| № | Xaridor nomi | STIR | Bitimlar soni (bekor qilingani) | Hajmi (tonna) | Jami sotuv summasi (so‘m) |",
    item: "Demo tovar",
    basis: "**Hisob asosi:**",
    b1: "**Davr:** demo davr",
    b2: "**Filtr:** bekor qilingan bitimlar chiqarib tashlangan",
    short: "Demo javob: **1 234 ta** bitim topildi.",
    none: "Maʼlumotlarda bu savolga javob yo‘q.",
    long: "Bu uzun javobni aylantirib ko‘rish uchun demo qator.",
  },
  ru: {
    intro: "Результат по демо-запросу:",
    head: "| № | Товар | Сумма (сум) | Сделки |",
    wideHead: "| № | Покупатель | ИНН | Сделок (аннулировано) | Объём (тонн) | Общая сумма продаж (сум) |",
    item: "Демо-товар",
    basis: "**Основа расчёта:**",
    b1: "**Период:** демо-период",
    b2: "**Фильтр:** аннулированные сделки исключены",
    short: "Демо-ответ: найдено **1 234** сделки.",
    none: "В данных нет ответа на этот вопрос.",
    long: "Это демо-строка, чтобы проверить прокрутку длинного ответа.",
  },
  en: {
    intro: "Result for the demo query:",
    head: "| # | Product | Amount (UZS) | Deals |",
    wideHead: "| # | Buyer | TIN | Deals (cancelled) | Volume (tonnes) | Total sales (UZS) |",
    item: "Demo product",
    basis: "**Basis:**",
    b1: "**Period:** demo period",
    b2: "**Filter:** cancelled deals excluded",
    short: "Demo answer: **1,234** deals found.",
    none: "The data has no answer to this question.",
    long: "This is a demo line for testing how a long answer scrolls.",
  },
};

// Same structure the backend really returns: a lookup, then SQL steps with their rows.
const TRACE = [
  {
    tool: "find_entity",
    args: { query: "Demo kompaniya" },
    row_count: 1,
    result: { matches: [{ kind: "participant", id: "100000001", name: "Demo kompaniya MChJ", region: "Demo viloyati" }] },
  },
  {
    tool: "run_sql",
    args: {
      purpose: "Demo: top products by amount",
      sql: "SELECT product, SUM(amount_uzs) AS total_amount_uzs, COUNT(*) AS total_deals\nFROM deals\nWHERE NOT is_cancelled AND year = 2025\nGROUP BY product\nORDER BY total_amount_uzs DESC\nLIMIT 7;",
    },
    row_count: 7,
    result: {
      columns: ["product", "total_amount_uzs", "total_deals"],
      rows: ["A", "B", "C", "D", "E", "F", "G"].map((n, i) => [
        `Demo tovar ${n}`,
        i < 5 ? (5 - i) * 111000000 : (7 - i) * 11000000,
        i < 5 ? (5 - i) * 100 : 7 - i,
      ]),
      row_count: 7,
      truncated: false,
    },
  },
  {
    tool: "run_sql",
    args: {
      purpose: "Demo: USD rate",
      sql: "WITH latest AS (SELECT MAX(date) AS date FROM usd_rates)\nSELECT date, rate FROM usd_rates JOIN latest USING (date);",
    },
    row_count: 1,
    result: { columns: ["date", "rate"], rows: [["2026-10-30", 12000.5]], row_count: 1, truncated: false },
  },
];

const sqlStep = (sql, columns, rows) => ({
  tool: "run_sql",
  args: { sql },
  row_count: rows.length,
  result: { columns, rows, row_count: rows.length, truncated: false },
});

// Each one matches its answer's numbers, because charts only appear when they do.
const WIDE_STEP = sqlStep(
  "SELECT buyer_name, buyer_inn, SUM(amount_uzs) AS total_amount_uzs, SUM(volume) AS total_volume\nFROM deals\nGROUP BY buyer_name, buyer_inn\nORDER BY total_amount_uzs DESC\nLIMIT 6;",
  ["buyer_name", "buyer_inn", "total_amount_uzs", "total_volume"],
  ['"Demo Invest" MChJ', "DEMO QURILISH SAVDO MCHJ", "DEMO LOGISTIK MAS’ULIYATI CHEKLANGAN JAMIYATI", '"Demo Servis" MChJ', "DEMO IMPEKS MCHJ", '"Demo Group" MChJ'].map(
    (name, i) => [name, `10000000${i}`, (43 - i * 5) * 1e9 + 496351252, 2289 - i * 300]
  )
);

const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
const MONTHLY_STEP = sqlStep(
  "SELECT strftime(deal_date, '%Y-%m') AS month, SUM(amount_uzs) AS turnover_uzs\nFROM deals\nWHERE year = 2025\nGROUP BY month\nORDER BY month;",
  ["month", "turnover_uzs"],
  MONTHS.map((m, i) => [`2025-${m}`, 3000000000000 + Math.round(Math.sin(i / 1.7) * 700000000000) + i * 150000000000])
);

const COMPARE_STEP = sqlStep(
  "SELECT product, year, SUM(amount_usd) AS total_usd\nFROM deals\nWHERE contract_type = 'Экспортный' AND year IN (2024, 2025)\nGROUP BY product, year\nORDER BY product, year;",
  ["product", "year", "total_usd"],
  [
    ["Demo tovar A", 2024, 146301398],
    ["Demo tovar A", 2025, 136296573],
    ["Demo tovar B", 2024, 56194223],
    ["Demo tovar B", 2025, 67595957],
    ["Demo tovar C", 2024, 22100000],
    ["Demo tovar C", 2025, 31450000],
  ]
);

// The two shapes the agent really uses when comparing years month by month.
const YEARS_WIDE_STEP = sqlStep(
  "SELECT month, SUM(CASE WHEN year = 2024 THEN amount_usd END) AS usd_2024, SUM(CASE WHEN year = 2025 THEN amount_usd END) AS usd_2025\nFROM deals\nWHERE contract_type = 'Экспортный'\nGROUP BY month\nORDER BY month;",
  ["month", "usd_2024", "usd_2025"],
  [20362423, 18022715, 11612167, 15227777, 15885538, 17897140, 17500544, 14583532, 13319532, 22116635, 18718623, 17248990].map((v, i) => [
    i + 1,
    v,
    [17344726, 14537667, 15834730, 17141640, 15617656, 19452407, 23805580, 20823186, 17285945, 13826744, 12740513, 15481732][i],
  ])
);

const YEARS_LONG_STEP = sqlStep(
  "SELECT year, month, SUM(amount_usd) AS total_usd\nFROM deals\nWHERE contract_type = 'Экспортный' AND year IN (2025, 2026)\nGROUP BY year, month\nORDER BY year, month;",
  ["year", "month", "total_usd"],
  [
    ...YEARS_WIDE_STEP.result.rows.map((row) => [2025, row[0], row[2]]),
    // 2026 stops in October, as the real data does: the line must end there, not drop to zero.
    ...YEARS_WIDE_STEP.result.rows.slice(0, 10).map((row) => [2026, row[0], row[1] + 2000000]),
  ]
);

const traceWith = (step) => [TRACE[0], step, TRACE[2]];

const RICH_ROWS = ["A", "B", "C", "D", "E"];

function rich(t, note) {
  const rows = RICH_ROWS.map(
    (name, i) => `| ${i + 1} | ${t.item} ${name} | ${(5 - i) * 111} 000 000 | ${(5 - i) * 100} |`
  );
  return [
    t.intro,
    "",
    t.head,
    "| :--- | :--- | ---: | ---: |",
    ...rows,
    "",
    t.basis,
    `- ${t.b1}`,
    `- ${t.b2}`,
    "",
    note,
  ].join("\n");
}

// Same width as real buyer answers: long headers, long names, large amounts.
const WIDE_NAMES = ['"Demo Invest" MChJ', "DEMO QURILISH SAVDO MCHJ", "DEMO LOGISTIK MAS’ULIYATI CHEKLANGAN JAMIYATI", '"Demo Servis" MChJ', "DEMO IMPEKS MCHJ", '"Demo Group" MChJ'];

function wide(t, note) {
  const rows = WIDE_NAMES.map(
    (name, i) =>
      `| ${i + 1} | **${name}** | 10000000${i} | ${114 - i * 15} (${6 - i}) | ${2289 - i * 300} | ${43 - i * 5} 496 351 252.00 |`
  );
  return [t.intro, "", t.wideHead, "| :--- | :--- | :--- | :--- | :--- | :--- |", ...rows, "", note].join("\n");
}

const longAnswer = (t, note) => [...Array(30)].map((_, i) => `${i + 1}. ${t.long}`).join("\n") + `\n\n${note}`;

const wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

const MOCK_RECORD = {
  deals: (n) => ({
    deal_id: 100000 + n,
    deal_date: "2025-01-15",
    product_variant: `Demo tovar ${n}`,
    quantity_lots: n * 10,
    amount: n * 1000000.5,
    currency: "UZS",
    region: "Demo viloyati",
    contract_type: "Внутренний",
    status: "Исполнен",
    seller_inn: "100000001",
    buyer_inn: "100000002",
    seller_broker: "BK001",
    buyer_broker: "BK002",
  }),
  participants: (n) => ({
    inn: String(100000000 + n),
    name: `Demo kompaniya ${n} MChJ`,
    region: "Demo viloyati",
    activity: "Торговая компания",
    role: n % 2 ? "Продавец" : "Покупатель",
    vat_payer: n % 2 === 0,
  }),
  brokers: (n) => ({
    broker_code: `BK${String(n).padStart(3, "0")}`,
    name: `Demo broker ${n} MChJ`,
    inn: String(200000000 + n),
    region: "Demo viloyati",
  }),
  usd_rates: (n) => ({ date: "2025-01-15", rate: 12000 + n }),
};

export async function mockRecords(dataset, page, size, signal) {
  await wait(350, signal);
  const first = (page - 1) * size + 1;
  return {
    items: Array.from({ length: size }, (_, i) => MOCK_RECORD[dataset](first + i)),
    total: size * 3,
    pages: 3,
  };
}

const has = (q, words) => words.some((w) => q.includes(w));

const failedOnce = new Set();

// Type one of these words in a question to see that state.
const failure = (q) => {
  if (has(q, ["xato", "ошибк", "error"])) return () => new ApiError(502, "demo", "demo-request-id");
  if (has(q, ["tarmoq", "сеть", "network"])) return () => new ApiError(0, "network", null);
  if (has(q, ["timeout", "таймаут"])) return () => new ApiError(0, "timeout", null);
  return null;
};

export async function mockAsk(question, { signal } = {}) {
  const q = question.toLowerCase();
  const started = performance.now();
  await wait(1800 + Math.random() * 1200, signal);

  // Fails the first time only, so Retry can be seen working.
  const fail = failure(q);
  if (fail && !failedOnce.has(q)) {
    failedOnce.add(q);
    throw fail();
  }

  const lang = localStorage.getItem(LANG_KEY) || "uz";
  const t = TEXT[lang] || TEXT.uz;
  const note = NOTE[lang] || NOTE.uz;

  let answer;
  let trace = TRACE;
  if (has(q, ["yo‘q", "нет данных", "no data", "2021"])) answer = t.none;
  else if (has(q, ["uzun", "длинн", "long"])) answer = longAnswer(t, note);
  else if (has(q, ["qisqa", "коротк", "short"])) answer = `${t.short}\n\n${note}`;
  else if (has(q, ["xaridor", "покупател", "buyer"])) {
    answer = wide(t, note);
    trace = traceWith(WIDE_STEP);
  } else if (has(q, ["line chart", "линейн"])) {
    answer = `${t.intro} **22.12** / **23.81** mln USD\n\n${note}`;
    trace = traceWith(YEARS_WIDE_STEP);
  } else if (has(q, ["ikki yil", "два года", "two years"])) {
    answer = `${t.intro} **23.81** mln USD\n\n${note}`;
    trace = traceWith(YEARS_LONG_STEP);
  } else if (has(q, ["oylik", "помесяч", "monthly"])) {
    answer = `${t.intro} **${MONTHLY_STEP.result.rows[11][1]}**\n\n${note}`;
    trace = traceWith(MONTHLY_STEP);
  } else if (has(q, ["solishtir", "сравни", "compare"])) {
    answer = `${t.intro} **146 301 398** / **136 296 573** USD\n\n${note}`;
    trace = traceWith(COMPARE_STEP);
  } else answer = rich(t, note);

  return {
    res: {
      answer,
      tool_calls: trace.length,
      duration_sec: +((performance.now() - started) / 1000).toFixed(2),
      trace,
    },
    sessionReset: has(q, ["sessiya", "сесси", "session"]),
  };
}
