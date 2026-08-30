import { describe, expect, it } from "vitest";
import type { Dungeon } from "../types";
import { clonesInGroup, createRoute, emptyPull, toggleClone } from "./route";

function dungeon(): Dungeon {
  return {
    dungeonIndex: 164,
    slug: "altar-of-fangs",
    englishName: "Altar of Fangs",
    shortName: "Altar",
    totalCount: 817,
    mapWidth: 840,
    mapHeight: 555,
    sublevels: [{ id: 1, name: "Altar" }],
    floors: [1],
    maps: { 1: "/maps/altar-of-fangs-1.jpg" },
    entrance: null,
    enemies: [
      {
        id: 1,
        npcId: 1,
        displayId: 1,
        name: "Snake",
        count: 5,
        isBoss: false,
        creatureType: "Beast",
        clones: [
          { idx: 1, x: 10, y: -10, sublevel: 1, group: 6 },
          { idx: 2, x: 12, y: -10, sublevel: 1, group: 6 },
          { idx: 3, x: 80, y: -80, sublevel: 1, group: 9 },
        ],
      },
      {
        id: 2,
        npcId: 2,
        displayId: 2,
        name: "Chieftain",
        count: 25,
        isBoss: false,
        creatureType: "Humanoid",
        clones: [{ idx: 1, x: 11, y: -11, sublevel: 1, group: 6 }],
      },
      {
        id: 3,
        npcId: 3,
        displayId: 3,
        name: "Lone",
        count: 1,
        isBoss: false,
        creatureType: "Beast",
        clones: [{ idx: 1, x: 40, y: -40, sublevel: 1, group: null }],
      },
    ],
  };
}

describe("MDT group select", () => {
  it("collects every clone on the floor that shares g", () => {
    const refs = clonesInGroup(dungeon(), { enemyId: 1, cloneIdx: 1 }, 1);
    expect(refs).toEqual([
      { enemyId: 1, cloneIdx: 1 },
      { enemyId: 1, cloneIdx: 2 },
      { enemyId: 2, cloneIdx: 1 },
    ]);
  });

  it("leaves an ungrouped clone as a singleton", () => {
    expect(clonesInGroup(dungeon(), { enemyId: 3, cloneIdx: 1 }, 1)).toEqual([
      { enemyId: 3, cloneIdx: 1 },
    ]);
  });

  it("clicking one snake adds the whole pack to the current pull", () => {
    const d = dungeon();
    let route = createRoute(164, "Test");
    route = toggleClone(route, { enemyId: 1, cloneIdx: 1 }, d);
    expect(route.pulls[0].clones).toEqual([
      { enemyId: 1, cloneIdx: 1 },
      { enemyId: 1, cloneIdx: 2 },
      { enemyId: 2, cloneIdx: 1 },
    ]);
  });

  it("clicking again removes the whole pack", () => {
    const d = dungeon();
    let route = createRoute(164, "Test");
    route = toggleClone(route, { enemyId: 2, cloneIdx: 1 }, d);
    route = toggleClone(route, { enemyId: 1, cloneIdx: 2 }, d);
    expect(route.pulls[0].clones).toEqual([]);
  });

  it("re-click removes a pack even if only part of the group is in the pull", () => {
    const d = dungeon();
    let route = createRoute(164, "Test");
    route.pulls[0].clones = [{ enemyId: 1, cloneIdx: 1 }];
    route = toggleClone(route, { enemyId: 1, cloneIdx: 1 }, d);
    expect(route.pulls[0].clones).toEqual([]);
  });

  it("moves a pack out of another pull into the current one", () => {
    const d = dungeon();
    let route = createRoute(164, "Test");
    route.pulls = [emptyPull(0), emptyPull(1)];
    route = toggleClone(route, { enemyId: 1, cloneIdx: 1 }, d);
    route.currentPull = 2;
    route = toggleClone(route, { enemyId: 1, cloneIdx: 1 }, d);
    expect(route.pulls[0].clones).toEqual([]);
    expect(route.pulls[1].clones).toHaveLength(3);
  });
});
