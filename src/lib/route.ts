import type { Clone, CloneRef, Dungeon, Pull, Route } from "../types";

export const PULL_COLORS = [
  "#e11d48",
  "#f59e0b",
  "#22c55e",
  "#38bdf8",
  "#a855f7",
  "#f97316",
  "#14b8a6",
  "#eab308",
  "#f43f5e",
  "#60a5fa",
  "#84cc16",
  "#d946ef",
];

export function newRouteId(): string {
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyPull(index: number): Pull {
  return { clones: [], note: "", color: PULL_COLORS[index % PULL_COLORS.length] };
}

export function createRoute(dungeonIdx: number, name = "New route"): Route {
  return {
    id: newRouteId(),
    name,
    dungeonIdx,
    pulls: [emptyPull(0)],
    currentPull: 1,
    currentSublevel: 1,
    updatedAt: Date.now(),
  };
}

export function findClone(dungeon: Dungeon, ref: CloneRef): Clone | undefined {
  const enemy = dungeon.enemies.find((e) => e.id === ref.enemyId);
  return enemy?.clones.find((c) => c.idx === ref.cloneIdx);
}

export function cloneCount(dungeon: Dungeon, ref: CloneRef): number {
  return dungeon.enemies.find((e) => e.id === ref.enemyId)?.count ?? 0;
}

export function pullForces(dungeon: Dungeon, pull: Pull): number {
  return pull.clones.reduce((sum, ref) => sum + cloneCount(dungeon, ref), 0);
}

export function routeForces(dungeon: Dungeon, route: Route, upTo?: number): number {
  const last = upTo ?? route.pulls.length;
  return route.pulls.slice(0, last).reduce((sum, pull) => sum + pullForces(dungeon, pull), 0);
}

export function pct(value: number, total: number): number {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function pullCentroid(dungeon: Dungeon, pull: Pull, floor: number) {
  const pts = pull.clones
    .map((ref) => findClone(dungeon, ref))
    .filter((c): c is Clone => c != null && c.sublevel === floor);
  if (!pts.length) return null;
  const x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const y = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  return { x, y };
}

export function cloneOwner(route: Route, ref: CloneRef): number | null {
  for (let i = 0; i < route.pulls.length; i += 1) {
    if (route.pulls[i].clones.some((c) => c.enemyId === ref.enemyId && c.cloneIdx === ref.cloneIdx)) {
      return i + 1;
    }
  }
  return null;
}

export function toggleClone(route: Route, ref: CloneRef): Route {
  const pulls = route.pulls.map((p) => ({ ...p, clones: [...p.clones] }));
  const current = pulls[route.currentPull - 1];
  if (!current) return route;
  const here = current.clones.findIndex((c) => c.enemyId === ref.enemyId && c.cloneIdx === ref.cloneIdx);
  if (here >= 0) {
    current.clones.splice(here, 1);
  } else {
    for (const pull of pulls) {
      const idx = pull.clones.findIndex((c) => c.enemyId === ref.enemyId && c.cloneIdx === ref.cloneIdx);
      if (idx >= 0) pull.clones.splice(idx, 1);
    }
    current.clones.push(ref);
  }
  return { ...route, pulls, updatedAt: Date.now() };
}

export function setCurrentPull(route: Route, pull: number): Route {
  const next = Math.max(1, Math.min(pull, route.pulls.length));
  return { ...route, currentPull: next };
}

export function addPull(route: Route): Route {
  const pulls = [...route.pulls, emptyPull(route.pulls.length)];
  return { ...route, pulls, currentPull: pulls.length, updatedAt: Date.now() };
}

export function deletePull(route: Route, index: number): Route {
  if (route.pulls.length <= 1) {
    return { ...route, pulls: [emptyPull(0)], currentPull: 1, updatedAt: Date.now() };
  }
  const pulls = route.pulls.filter((_, i) => i !== index);
  return {
    ...route,
    pulls,
    currentPull: Math.min(route.currentPull, pulls.length),
    updatedAt: Date.now(),
  };
}

export function movePull(route: Route, from: number, to: number): Route {
  if (from === to || from < 0 || to < 0 || from >= route.pulls.length || to >= route.pulls.length) {
    return route;
  }
  const pulls = [...route.pulls];
  const [item] = pulls.splice(from, 1);
  pulls.splice(to, 0, item);
  return { ...route, pulls, currentPull: to + 1, updatedAt: Date.now() };
}

export function packSummary(dungeon: Dungeon, pull: Pull): string {
  const counts = new Map<string, { name: string; n: number; boss: boolean }>();
  for (const ref of pull.clones) {
    const enemy = dungeon.enemies.find((e) => e.id === ref.enemyId);
    if (!enemy) continue;
    const cur = counts.get(enemy.name) ?? { name: enemy.name, n: 0, boss: enemy.isBoss };
    cur.n += 1;
    counts.set(enemy.name, cur);
  }
  const parts = [...counts.values()].map((c) => (c.n > 1 ? `${c.name} ×${c.n}` : c.name));
  return parts.join(" · ") || "Empty pull";
}

export function exportFileName(route: Route, ext: string): string {
  const slug = route.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${slug || "route"}.${ext}`;
}
