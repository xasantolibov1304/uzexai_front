import { useQuery, keepPreviousData } from "@tanstack/react-query";
import * as ep from "./endpoints";

// Ma'lumotlar faqat o'qiladi — katalog cheksiz, ro'yxat/statistika parametrlar bo'yicha keshlanadi.
const forever = { staleTime: Infinity, gcTime: Infinity };
const long = { staleTime: 6 * 60 * 60 * 1000 };

export const useHealth = () =>
  useQuery({ queryKey: ["health"], queryFn: ({ signal }) => ep.getHealth(signal), staleTime: 60_000, retry: 1 });

export const useReference = () =>
  useQuery({ queryKey: ["reference"], queryFn: ({ signal }) => ep.getReference(signal), ...forever });

export const useProducts = (category) =>
  useQuery({ queryKey: ["products", category || null], queryFn: ({ signal }) => ep.getProducts(category, signal), ...forever });

export const useProduct = (name) =>
  useQuery({ queryKey: ["product", name], queryFn: ({ signal }) => ep.getProduct(name, signal), enabled: !!name, ...forever });

export const useDeals = (query) =>
  useQuery({ queryKey: ["deals", query], queryFn: ({ signal }) => ep.getDeals(query, signal), placeholderData: keepPreviousData, ...long });

export const useDeal = (id) =>
  useQuery({ queryKey: ["deal", id], queryFn: ({ signal }) => ep.getDeal(id, signal), enabled: !!id, ...forever });

export const useStats = (query, { enabled = true } = {}) =>
  useQuery({ queryKey: ["stats", query], queryFn: ({ signal }) => ep.getStats(query, signal), enabled, ...long });

export const useSearch = (q, kind = "any", limit = 10) =>
  useQuery({
    queryKey: ["search", q, kind, limit],
    queryFn: ({ signal }) => ep.search(q, kind, limit, signal),
    enabled: q.trim().length >= 2,
    ...long,
  });

export const useParticipants = (query) =>
  useQuery({ queryKey: ["participants", query], queryFn: ({ signal }) => ep.getParticipants(query, signal), placeholderData: keepPreviousData, ...long });

export const useParticipant = (inn) =>
  useQuery({ queryKey: ["participant", inn], queryFn: ({ signal }) => ep.getParticipant(inn, signal), enabled: !!inn, ...forever });

export const useBrokers = (region) =>
  useQuery({ queryKey: ["brokers", region || null], queryFn: ({ signal }) => ep.getBrokers(region, signal), ...forever });

export const useBroker = (code) =>
  useQuery({ queryKey: ["broker", code], queryFn: ({ signal }) => ep.getBroker(code, signal), enabled: !!code, ...forever });
