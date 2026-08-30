import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { aceDeserialize, aceSerialize } from "./ace";
import { decodeMdtString, encodeMdtString, MdtDecodeError } from "./codec";
import { decodeRoute, encodeRoute, presetToRoute, routeToPreset } from "./preset";
import { createRoute, emptyPull } from "../route";

describe("AceSerializer", () => {
  it("round-trips a nested table", () => {
    const value = { text: "Route", value: { currentDungeonIdx: 164, pulls: { 1: { 1: { 1: 2 } } } } };
    const again = aceDeserialize(aceSerialize(value));
    expect(again).toEqual(value);
  });
});

describe("MDT codec", () => {
  it("round-trips a preset through ! + LibDeflate + Ace", () => {
    const preset = routeToPreset(
      createRoute(164, "Test"),
    );
    const encoded = encodeMdtString(preset);
    expect(encoded.startsWith("!")).toBe(true);
    const decoded = decodeMdtString(encoded);
    expect(decoded).toMatchObject({ text: "Test" });
  });

  it("throws a clear error on garbage", () => {
    expect(() => decodeMdtString("ceci-n-est-pas-mdt")).toThrow(MdtDecodeError);
  });
});

describe("preset → pulls", () => {
  it("maps enemyId → clone lists onto Route pulls", () => {
    const route = createRoute(164, "Sample");
    route.pulls = [
      { ...emptyPull(0), clones: [{ enemyId: 4, cloneIdx: 1 }, { enemyId: 4, cloneIdx: 3 }], note: "grip" },
    ];
    const back = presetToRoute(routeToPreset(route));
    expect(back.dungeonIdx).toBe(164);
    expect(back.pulls[0].clones).toEqual([
      { enemyId: 4, cloneIdx: 1 },
      { enemyId: 4, cloneIdx: 3 },
    ]);
    expect(back.pulls[0].note).toBe("grip");
  });
});

describe("fixture Autel des Crocs", () => {
  it("decode → pulls for the sample S2 string", () => {
    const file = path.resolve(process.cwd(), "fixtures/altar-of-fangs.mdt");
    const raw = readFileSync(file, "utf8");
    const route = decodeRoute(raw);
    expect(route.dungeonIdx).toBe(164);
    expect(route.pulls.length).toBeGreaterThanOrEqual(2);
    expect(route.pulls.some((p) => p.clones.length > 0)).toBe(true);
    const again = decodeRoute(encodeRoute(route));
    expect(again.pulls.map((p) => p.clones)).toEqual(route.pulls.map((p) => p.clones));
  });
});
