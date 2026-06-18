import { useSyncExternalStore } from "react";

/**
 * Global, cross-screen filter state. Single source of truth shared by
 * Dashboard, Conferência, Busca Ativa and any other screen. Persisted in
 * sessionStorage so it survives reloads within a session, and synced
 * across components in the same tab via a small custom-event bus.
 */
export type GlobalFilters = {
  dateFrom: string;
  dateTo: string;
  convenio: string; // "all" or convenio name
  atendente: string; // "all" or atendente/usuario name
};

const STORAGE_KEY = "globalFilters.v1";
const EVENT = "global-filters-change";

function defaultFilters(): GlobalFilters {
  const d = new Date();
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const to = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
  return { dateFrom: from, dateTo: to, convenio: "all", atendente: "all" };
}

let cache: GlobalFilters | null = null;

function read(): GlobalFilters {
  if (cache) return cache;
  if (typeof window === "undefined") {
    cache = defaultFilters();
    return cache;
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GlobalFilters>;
      cache = { ...defaultFilters(), ...parsed };
      return cache;
    }
  } catch {
    // ignore parse errors
  }
  // Back-compat: migrate legacy keys used by Dashboard/Conferência.
  const legacyFrom = window.sessionStorage.getItem("periodo.from");
  const legacyTo = window.sessionStorage.getItem("periodo.to");
  const base = defaultFilters();
  if (legacyFrom) base.dateFrom = legacyFrom;
  if (legacyTo) base.dateTo = legacyTo;
  cache = base;
  return cache;
}

function write(next: GlobalFilters) {
  cache = next;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    // Keep legacy keys in sync so any not-yet-migrated reader keeps working.
    window.sessionStorage.setItem("periodo.from", next.dateFrom);
    window.sessionStorage.setItem("periodo.to", next.dateTo);
  } catch {
    // ignore quota errors
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function useGlobalFilters() {
  const filters = useSyncExternalStore(subscribe, read, defaultFilters);
  const setFilters = (patch: Partial<GlobalFilters>) => write({ ...read(), ...patch });
  return {
    ...filters,
    setDateFrom: (v: string) => setFilters({ dateFrom: v }),
    setDateTo: (v: string) => setFilters({ dateTo: v }),
    setConvenio: (v: string) => setFilters({ convenio: v }),
    setAtendente: (v: string) => setFilters({ atendente: v }),
    setFilters,
    resetPeriod: () => setFilters({ dateFrom: "", dateTo: "" }),
  };
}

export function getGlobalFilters(): GlobalFilters {
  return read();
}