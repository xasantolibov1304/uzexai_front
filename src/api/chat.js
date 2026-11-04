import { api, ApiError } from "./client";

const KEY = "uzex_session";

export const getStoredSession = () => sessionStorage.getItem(KEY);
const storeSession = (id) => (id ? sessionStorage.setItem(KEY, id) : sessionStorage.removeItem(KEY));

/**
 * Savol yuboradi. Sessiya muddati o'tgan bo'lsa (404) — avtomatik yangi sessiya ochadi.
 * Natija: { res, sessionReset } — sessionReset=true bo'lsa UI "yangi suhbat boshlandi" deb ko'rsatadi.
 */
export async function ask(question, { includeTrace = false, signal } = {}) {
  const send = (sid) =>
    api("/api/v1/chat", {
      method: "POST",
      body: { question, session_id: sid, include_trace: includeTrace },
      timeoutMs: 120_000,
      signal,
    });

  const sid = getStoredSession();
  let res;
  let sessionReset = false;
  try {
    res = await send(sid);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404 && sid) {
      storeSession(null);
      res = await send(null);
      sessionReset = true;
    } else {
      throw e; // 502 → qayta urinish, 503 → chat o'chiq
    }
  }
  storeSession(res.session_id);
  return { res, sessionReset };
}

export async function getHistory(sessionId) {
  return api(`/api/v1/chat/sessions/${encodeURIComponent(sessionId)}`);
}

export function newConversation() {
  const sid = getStoredSession();
  if (sid) api(`/api/v1/chat/sessions/${encodeURIComponent(sid)}`, { method: "DELETE" }).catch(() => {});
  storeSession(null);
}
