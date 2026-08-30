import type { Route } from "../types";

const KEY = "mdt-board:v1";

type Store = {
  routes: Route[];
  lastRouteId: string | null;
};

function empty(): Store {
  return { routes: [], lastRouteId: null };
}

/**
 * Repairs strings saved before the codec decoded UTF-8, where multi-byte
 * characters were read as latin1 (e.g. "Altar Â· Blood DK").
 */
function fixMojibake(value: string): string {
  if (!/[\u00c2-\u00f4][\u0080-\u00bf]/.test(value)) return value;
  try {
    const bytes = new Uint8Array(value.length);
    for (let i = 0; i < value.length; i += 1) {
      const code = value.charCodeAt(i);
      if (code > 0xff) return value;
      bytes[i] = code;
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return value;
  }
}

function fixRoute(route: Route): Route {
  return {
    ...route,
    name: fixMojibake(route.name),
    pulls: route.pulls.map((p) => ({ ...p, note: fixMojibake(p.note) })),
  };
}

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Store;
    if (!Array.isArray(parsed.routes)) return empty();
    return { ...parsed, routes: parsed.routes.map(fixRoute) };
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
