const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
const SESSION_KEY = "uzex_session";

// ?mock answers from canned replies, so the interface can be tested without spending AI tokens.
export const isMock = new URLSearchParams(window.location.search).has("mock");

export class ApiError extends Error {
  // code: the backend's {error: {code}}, or "timeout" / "network" when no response arrived.
  constructor(status, detail, requestId, code) {
    super(ApiError.describe(status, detail));
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.requestId = requestId || null;
    this.code = typeof code === "string" ? code : null;
  }

  static describe(status, detail) {
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((d) => `${(d.loc || []).slice(1).join(".")}: ${d.msg}`).join("; ");
    }
    return status ? `HTTP ${status}` : "Network error";
  }
}

async function request(path, { method = "GET", body, signal, timeoutMs = 30000 } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  signal?.addEventListener("abort", forwardAbort);

  try {
    let res;
    try {
      res = await fetch(`${BASE}${path}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      if (!timedOut && signal?.aborted) throw err;
      const kind = timedOut ? "timeout" : "network";
      throw new ApiError(0, kind, null, kind);
    }
    if (res.status === 204) return undefined;
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiError(res.status, data?.detail ?? data, res.headers.get("X-Request-ID"), data?.error?.code);
    }
    return data;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forwardAbort);
  }
}

// The rate file covers these calendar days; the endpoint only takes a date range.
const USD_FIRST_DAY = Date.UTC(2022, 0, 1);
const USD_LAST_DAY = Date.UTC(2026, 9, 30);
const DAY_MS = 86400000;
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

// Plain data calls: none of these reach the AI, so they spend no tokens.
export async function fetchRecords(dataset, page, size, signal) {
  if (isMock) {
    const { mockRecords } = await import("./mock.js");
    return mockRecords(dataset, page, size, signal);
  }
  if (dataset === "deals" || dataset === "participants") {
    const data = await request(`/api/v1/${dataset}?page=${page}&page_size=${size}`, { signal });
    return { items: data.items, total: data.total, pages: data.pages };
  }
  if (dataset === "brokers") {
    const all = await request("/api/v1/brokers", { signal });
    return {
      items: all.slice((page - 1) * size, page * size),
      total: all.length,
      pages: Math.ceil(all.length / size),
    };
  }
  if (dataset === "usd_rates") {
    const total = (USD_LAST_DAY - USD_FIRST_DAY) / DAY_MS + 1;
    const from = USD_FIRST_DAY + (page - 1) * size * DAY_MS;
    const to = Math.min(from + (size - 1) * DAY_MS, USD_LAST_DAY);
    const items = await request(`/api/v1/usd-rates?date_from=${isoDay(from)}&date_to=${isoDay(to)}`, { signal });
    return { items, total, pages: Math.ceil(total / size) };
  }
  throw new Error(`No records for ${dataset}`);
}

// Sent with each question until these rules live in the backend's own prompt. In a test of 16
// questions they cut AI steps by 41% and total time by 30%, and stopped extra figures on no-data questions.
const ANSWER_RULES =
  "[Rules for this answer: use the fewest queries possible, ideally one, and run no extra checks or statistics. " +
  "Answer only what is asked, briefly, in the language of the question. " +
  "If the data has no answer, say so in one or two sentences and stop: give no figures, products or companies from other periods or tables. " +
  "The app draws charts by itself from your last query's rows. Never draw a chart, graph or diagram in text, and use no emoji. " +
  "If asked for a chart, run one query with all the data, sorted, with one row per period or item, and write a short summary without repeating every row.]\n\n";

// The backend's limit for a question.
export const MAX_QUESTION_LENGTH = 2000;

const getSession = () => sessionStorage.getItem(SESSION_KEY);
const setSession = (id) =>
  id ? sessionStorage.setItem(SESSION_KEY, id) : sessionStorage.removeItem(SESSION_KEY);

export const fetchHealth = (signal) =>
  isMock ? Promise.resolve({ agent_available: true }) : request("/health", { signal, timeoutMs: 10000 });

// An expired session returns 404: start a fresh one and tell the caller.
export async function askChat(question, { signal } = {}) {
  if (isMock) {
    const { mockAsk } = await import("./mock.js");
    return mockAsk(question, { signal });
  }

  const send = (sessionId) =>
    request("/api/v1/chat", {
      method: "POST",
      body: { question: ANSWER_RULES + question, session_id: sessionId, include_trace: true }, // Sources are always shown.
      timeoutMs: 120000,
      signal,
    });

  const current = getSession();
  let res;
  let sessionReset = false;
  try {
    res = await send(current);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404 && current) {
      setSession(null);
      res = await send(null);
      sessionReset = true;
    } else {
      throw err;
    }
  }
  setSession(res.session_id);
  return { res, sessionReset };
}

export async function restoreChat() {
  if (isMock) return null;
  const id = getSession();
  if (!id) return null;
  const session = await request(`/api/v1/chat/sessions/${encodeURIComponent(id)}`);
  // The backend stores questions as sent, and the rules shouldn't show in the conversation.
  session?.messages?.forEach((m) => {
    if (m.question?.startsWith(ANSWER_RULES)) m.question = m.question.slice(ANSWER_RULES.length);
  });
  return session;
}

export function endChat() {
  if (isMock) return;
  const id = getSession();
  if (id) {
    request(`/api/v1/chat/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
  }
  setSession(null);
}
