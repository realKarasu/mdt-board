import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { deflate, deflateRaw } from "pako";
import { Encoder } from "cbor-x";
import { aceDeserialize, aceSerialize } from "./ace";
import { decodeMdtString, encodeMdt2String, encodeMdtString, MdtDecodeError } from "./codec";
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
    expect(() => decodeMdtString("this-is-not-mdt")).toThrow(MdtDecodeError);
  });
});

describe("MDT2 CBOR + zlib", () => {
  const preset = routeToPreset(
    (() => {
      const route = createRoute(164, "Altar MDT2");
      route.pulls = [
        { ...emptyPull(0), clones: [{ enemyId: 1, cloneIdx: 1 }, { enemyId: 1, cloneIdx: 2 }], note: "lust" },
        { ...emptyPull(1), clones: [{ enemyId: 2, cloneIdx: 1 }] },
      ];
      return route;
    })(),
  );

  it("round-trips !~MDT2~ + zlib Deflate + CBOR", () => {
    const encoded = encodeMdt2String(preset);
    expect(encoded.startsWith("!~MDT2~")).toBe(true);
    expect(/[+/=]/.test(encoded)).toBe(true);
    const decoded = decodeMdtString(encoded);
    expect(decoded).toMatchObject({ text: "Altar MDT2" });
    const route = decodeRoute(encoded);
    expect(route.dungeonIdx).toBe(164);
    expect(route.pulls).toHaveLength(2);
    expect(route.pulls[0].clones).toEqual([
      { enemyId: 1, cloneIdx: 1 },
      { enemyId: 1, cloneIdx: 2 },
    ]);
    expect(route.pulls[0].note).toBe("lust");
  });

  it("accepts a prefix-less standard-base64 MDT2 paste", () => {
    const encoded = encodeMdt2String(preset);
    const bare = encoded.slice("!~MDT2~".length);
    const route = decodeRoute(bare);
    expect(route.dungeonIdx).toBe(164);
    expect(route.pulls[0].clones.length).toBe(2);
  });

  it("accepts whitespace inside an MDT2 paste", () => {
    const encoded = encodeMdt2String(preset);
    const wrapped = `${encoded.slice(0, 20)}\n${encoded.slice(20, 40)} ${encoded.slice(40)}`;
    const route = decodeRoute(wrapped);
    expect(route.dungeonIdx).toBe(164);
  });

  it("still decodes raw-deflate MDT2 (older encoder)", () => {
    const encoder = new Encoder({ useRecords: false, mapsAsObjects: true });
    const compressed = deflateRaw(encoder.encode(preset));
    let b64 = "";
    for (let i = 0; i < compressed.length; i += 1) b64 += String.fromCharCode(compressed[i]);
    const encoded = `!~MDT2~${btoa(b64)}`;
    const route = decodeRoute(encoded);
    expect(route.dungeonIdx).toBe(164);
    expect(route.pulls[0].note).toBe("lust");
  });

  it("decodes an independently zlib-wrapped CBOR payload (official shape)", () => {
    const encoder = new Encoder({ useRecords: false, mapsAsObjects: true });
    const compressed = deflate(encoder.encode(preset));
    let b64 = "";
    for (let i = 0; i < compressed.length; i += 1) b64 += String.fromCharCode(compressed[i]);
    const encoded = `!~MDT2~${btoa(b64)}`;
    expect(compressed[0]).toBe(0x78);
    const route = decodeRoute(encoded);
    expect(route.dungeonIdx).toBe(164);
    expect(route.pulls.map((p) => p.clones)).toEqual([
      [
        { enemyId: 1, cloneIdx: 1 },
        { enemyId: 1, cloneIdx: 2 },
      ],
      [{ enemyId: 2, cloneIdx: 1 }],
    ]);
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

describe("Altar of Fangs fixture", () => {
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
