import { api } from "./client";

const enc = encodeURIComponent;

export const getHealth = (signal) => api("/health", { signal, timeoutMs: 10_000 });
export const getReference = (signal) => api("/api/v1/reference", { signal });

export const getProducts = (category, signal) => api("/api/v1/products", { query: { category }, signal });
export const getProduct = (name, signal) => api(`/api/v1/products/${enc(name)}`, { signal });

export const getDeals = (query, signal) => api("/api/v1/deals", { query, signal });
export const getDeal = (id, signal) => api(`/api/v1/deals/${enc(id)}`, { signal });
export const getStats = (query, signal) => api("/api/v1/deals/stats", { query, signal });

export const search = (q, kind = "any", limit = 10, signal) =>
  api("/api/v1/search", { query: { q, kind, limit }, signal });

export const getParticipants = (query, signal) => api("/api/v1/participants", { query, signal });
export const getParticipant = (inn, signal) => api(`/api/v1/participants/${enc(inn)}`, { signal });

export const getBrokers = (region, signal) => api("/api/v1/brokers", { query: { region }, signal });
export const getBroker = (code, signal) => api(`/api/v1/brokers/${enc(code)}`, { signal });

export const getUsdRate = (date, signal) => api(`/api/v1/usd-rates/${enc(date)}`, { signal });
export const getUsdRates = (date_from, date_to, signal) =>
  api("/api/v1/usd-rates", { query: { date_from, date_to }, signal });
