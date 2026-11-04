// Netlify Edge Function — BFF proxy (FRONTEND_API.md §1 "Autentifikatsiya").
// Brauzer /api/* va /health ni shu domenga yuboradi; bu funksiya API kalitni server tomonda qo'shib,
// so'rovni backendga uzatadi. Kalit brauzerga hech qachon tushmaydi.
//
// Netlify → Site configuration → Environment variables:
//   UZEX_API_KEY      — backenddagi UZEX_API_KEYS dan biri (majburiy, agar backendda kalit yoqilgan bo'lsa)
//   UZEX_BACKEND_URL  — ixtiyoriy, default https://uzex-api.onrender.com

const DEFAULT_BACKEND = "https://uzex-api.onrender.com";

// Faqat shu yo'llar uzatiladi — proxy ochiq "har qanday URL'ga so'rov" vositasiga aylanmasligi uchun.
const ALLOWED = /^\/(health$|api\/v1\/)/;

// Brauzerdan backendga uzatiladigan sarlavhalar (cookie va boshqalar uzatilmaydi).
const FORWARD_HEADERS = ["content-type", "accept", "accept-language", "x-request-id"];

const env = (name) => globalThis.Netlify?.env?.get(name) ?? globalThis.process?.env?.[name];

export default async function handler(request) {
  const url = new URL(request.url);
  if (!ALLOWED.test(url.pathname)) {
    return Response.json({ detail: "Not found" }, { status: 404 });
  }

  const backend = (env("UZEX_BACKEND_URL") || DEFAULT_BACKEND).replace(/\/$/, "");
  const target = `${backend}${url.pathname}${url.search}`;

  const headers = new Headers();
  for (const h of FORWARD_HEADERS) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  const key = env("UZEX_API_KEY");
  if (key) headers.set("X-API-Key", key);

  const hasBody = !["GET", "HEAD"].includes(request.method);
  let res;
  try {
    res = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
    });
  } catch {
    return Response.json({ detail: "Backend bilan aloqa yo‘q (proxy)." }, { status: 502 });
  }

  // Javobni o'zgartirmasdan qaytaramiz (X-Request-ID ham o'tadi).
  const out = new Headers(res.headers);
  out.delete("set-cookie");
  out.set("cache-control", "no-store");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: out });
}

export const config = {
  path: ["/api/*", "/health"],
};
