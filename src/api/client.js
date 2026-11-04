// Yagona fetch-klient: timeout, query-string, JSON xatolarini ApiError ga aylantirish.
const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(status, detail, requestId) {
    super(ApiError.describe(status, detail));
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.requestId = requestId || null;
  }

  static describe(status, detail) {
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      // 422 — FastAPI validatsiya xatolari
      return detail.map((d) => `${(d.loc || []).slice(1).join(".")}: ${d.msg}`).join("; ");
    }
    return status ? `HTTP ${status}` : "Network error";
  }
}

function toSearch(query) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export async function api(path, opts = {}) {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, opts.timeoutMs ?? 30_000);
  const onAbort = () => ctrl.abort();
  opts.signal?.addEventListener("abort", onAbort);
  try {
    let res;
    try {
      res = await fetch(`${BASE_URL}${path}${toSearch(opts.query)}`, {
        method: opts.method ?? "GET",
        headers: opts.body ? { "Content-Type": "application/json" } : undefined,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: ctrl.signal,
      });
    } catch (e) {
      // Chaqiruvchi o'zi bekor qilgan bo'lsa (masalan react-query) — asl xatoni qaytaramiz.
      if (!timedOut && opts.signal?.aborted) throw e;
      throw new ApiError(0, timedOut ? "timeout" : "network", null);
    }
    if (res.status === 204) return undefined;
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, data?.detail ?? data, res.headers.get("X-Request-ID"));
    return data;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}
