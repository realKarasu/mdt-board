export type PatrolPoint = {
  x: number;
  y: number;
};

export type Clone = {
  idx: number;
  x: number;
  y: number;
  sublevel: number;
  group: number | null;
  patrol?: PatrolPoint[];
};

export type Enemy = {
  id: number;
  npcId: number;
  displayId: number;
  name: string;
  count: number;
  isBoss: boolean;
  creatureType: string | null;
  stealthDetect?: boolean;
  clones: Clone[];
};

export type Sublevel = {
  id: number;
  name: string;
};

export type Entrance = {
  x: number;
  y: number;
  sublevel: number;
};

export type Dungeon = {
  dungeonIndex: number;
  slug: string;
  englishName: string;
  shortName: string;
  totalCount: number;
  mapWidth: number;
  mapHeight: number;
  sublevels: Sublevel[];
  floors: number[];
  maps: Record<number, string>;
  entrance: Entrance | null;
  enemies: Enemy[];
};

export type DungeonSummary = {
  dungeonIndex: number;
  slug: string;
  englishName: string;
  shortName: string;
  totalCount: number;
  floors: number[];
  maps: Record<number, string>;
  enemyCount: number;
  cloneCount: number;
};

export type CloneRef = {
  enemyId: number;
  cloneIdx: number;
};

export type Pull = {
  clones: CloneRef[];
  note: string;
  color: string;
};

export type Route = {
  id: string;
  name: string;
  dungeonIdx: number;
  pulls: Pull[];
  currentPull: number;
  currentSublevel: number;
  uid?: string;
  updatedAt: number;
};

export type AppMode = "picker" | "editor" | "board";
