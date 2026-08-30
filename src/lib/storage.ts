import type { Route } from "../types";

const KEY = "mdt-board:v1";

type Store = {
  routes: Route[];
  lastRouteId: string | null;
};

function empty(): Store {
  return { routes: [], lastRouteId: null };
}

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Store;
    if (!Array.isArray(parsed.routes)) return empty();
    return parsed;
  } catch {
    return empty();
  }
}

function write(store: Store) {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function listSavedRoutes(): Route[] {
  return read().routes.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveRoute(route: Route): void {
  const store = read();
  const next = { ...route, updatedAt: Date.now() };
  const idx = store.routes.findIndex((r) => r.id === next.id);
  if (idx >= 0) store.routes[idx] = next;
  else store.routes.unshift(next);
  store.lastRouteId = next.id;
  write(store);
}

export function deleteSavedRoute(id: string): void {
  const store = read();
  store.routes = store.routes.filter((r) => r.id !== id);
  if (store.lastRouteId === id) store.lastRouteId = store.routes[0]?.id ?? null;
  write(store);
}

export function lastSavedRoute(): Route | null {
  const store = read();
  return store.routes.find((r) => r.id === store.lastRouteId) ?? store.routes[0] ?? null;
}
