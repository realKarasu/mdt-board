import type { AceTable, AceValue } from "./ace";
import { decodeMdtString, encodeMdtString, MdtDecodeError, requirePresetTable } from "./codec";
import type { CloneRef, Pull, Route } from "../../types";
import { PULL_COLORS, emptyPull, newRouteId } from "../route";

function num(value: AceValue | undefined, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value !== "" && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return fallback;
}

function asRecord(value: AceValue | undefined): AceTable {
  if (value && typeof value === "object") return value as AceTable;
  return {};
}

function cloneList(value: AceValue | undefined): number[] {
  if (Array.isArray(value)) {
    return value.map((v) => num(v as AceValue)).filter((n) => n > 0);
  }
  const table = asRecord(value);
  const idxs = Object.values(table)
    .map((v) => num(v))
    .filter((n) => n > 0);
  if (idxs.length) return idxs;
  return Object.keys(table)
    .map((k) => num(k))
    .filter((n) => n > 0);
}

function pullFromTable(table: AceTable, color: string): Pull {
  const clones: CloneRef[] = [];
  let note = "";
  for (const [key, value] of Object.entries(table)) {
    if (key === "color" || key === "colorUndefeated") continue;
    if (key === "note" || key === "text") {
      if (typeof value === "string") note = value;
      continue;
    }
    const enemyId = Number(key);
    if (!Number.isInteger(enemyId) || enemyId <= 0) continue;
    for (const cloneIdx of cloneList(value)) {
      clones.push({ enemyId, cloneIdx });
    }
  }
  return { clones, note, color };
}

function pullsFromValue(value: AceTable): Pull[] {
  const pullsTable = asRecord(value.pulls);
  const keys = Object.keys(pullsTable)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .sort((a, b) => a - b);
  const pulls = keys.map((k, i) => pullFromTable(asRecord(pullsTable[k]), PULL_COLORS[i % PULL_COLORS.length]));
  return pulls.length ? pulls : [emptyPull(0)];
}

export function presetToRoute(preset: AceTable): Route {
  const value = asRecord(preset.value);
  const dungeonIdx = num(value.currentDungeonIdx);
  if (!dungeonIdx) {
    throw new MdtDecodeError("La chaîne MDT n'indique pas de donjon (currentDungeonIdx)");
  }
  const pulls = pullsFromValue(value);
  const name = typeof preset.text === "string" && preset.text.trim() ? preset.text : "Route importée";
  return {
    id: newRouteId(),
    name,
    dungeonIdx,
    pulls,
    currentPull: Math.max(1, Math.min(num(value.currentPull, 1), pulls.length)),
    currentSublevel: Math.max(1, num(value.currentSublevel, 1)),
    uid: typeof preset.uid === "string" ? preset.uid : undefined,
    updatedAt: Date.now(),
  };
}

export function decodeRoute(raw: string): Route {
  const decoded = decodeMdtString(raw);
  return presetToRoute(requirePresetTable(decoded));
}

export function parseIncomingRoute(raw: string): Route {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { format?: string; route?: Route } & Partial<Route>;
      const route = parsed.format === "mdt-board-route" ? parsed.route : (parsed as Route);
      if (route && Array.isArray(route.pulls) && route.dungeonIdx) {
        return { ...route, id: route.id || newRouteId(), updatedAt: Date.now() };
      }
    } catch {
      throw new MdtDecodeError("JSON invalide");
    }
    throw new MdtDecodeError("JSON reconnu mais ce n'est pas une route mdt-board");
  }
  return decodeRoute(trimmed);
}

export function routeToPreset(route: Route): AceTable {
  const pulls: AceTable = {};
  route.pulls.forEach((pull, i) => {
    const row: AceTable = {};
    const byEnemy = new Map<number, number[]>();
    for (const ref of pull.clones) {
      const list = byEnemy.get(ref.enemyId) ?? [];
      list.push(ref.cloneIdx);
      byEnemy.set(ref.enemyId, list);
    }
    for (const [enemyId, clones] of byEnemy) {
      const list: AceTable = {};
      clones.forEach((idx, n) => {
        list[n + 1] = idx;
      });
      row[enemyId] = list;
    }
    if (pull.note.trim()) row.note = pull.note;
    pulls[i + 1] = row;
  });
  return {
    text: route.name,
    uid: route.uid ?? route.id.slice(0, 11),
    value: {
      currentDungeonIdx: route.dungeonIdx,
      currentPull: route.currentPull,
      currentSublevel: route.currentSublevel,
      selection: { 1: route.currentPull },
      pulls,
    },
  };
}

export function encodeRoute(route: Route): string {
  return encodeMdtString(routeToPreset(route));
}

export function routeToJsonBackup(route: Route) {
  return {
    format: "mdt-board-route",
    version: 1,
    exportedAt: new Date().toISOString(),
    route,
    note: "Sauvegarde JSON complète. La chaîne MDT exportée est un meilleur effort (pulls, notes, donjon). Les dessins / objets MDT ne sont pas réexportés.",
  };
}
