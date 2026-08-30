import type { Dungeon, DungeonSummary } from "../types";
import altar from "../data/altar-of-fangs.json";
import den from "../data/den-of-nalorakk.json";
import kings from "../data/kings-rest.json";
import murder from "../data/murder-row.json";
import ruby from "../data/ruby-life-pools.json";
import sethraliss from "../data/temple-of-sethraliss.json";
import vale from "../data/the-blinding-vale.json";
import voidscar from "../data/voidscar-arena.json";
import index from "../data/index.json";

const ALL: Dungeon[] = [
  altar,
  murder,
  den,
  vale,
  voidscar,
  kings,
  sethraliss,
  ruby,
] as Dungeon[];

export const dungeonSummaries = index as DungeonSummary[];

const byIdx = new Map(ALL.map((d) => [d.dungeonIndex, d]));
const bySlug = new Map(ALL.map((d) => [d.slug, d]));

export function getDungeon(idx: number): Dungeon | undefined {
  return byIdx.get(idx);
}

export function getDungeonBySlug(slug: string): Dungeon | undefined {
  return bySlug.get(slug);
}

export function allDungeons(): Dungeon[] {
  return ALL;
}
