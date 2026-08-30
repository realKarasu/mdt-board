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

  it("decodes Blizzard-style maps whose keys are CBOR byte strings", () => {
    // C_EncodingUtil.SerializeCBOR uses major type 2 keys, not text strings.
    const payload = blizzardCborPreset();
    const compressed = deflate(payload);
    let b64 = "";
    for (let i = 0; i < compressed.length; i += 1) b64 += String.fromCharCode(compressed[i]);
    const encoded = `!~MDT2~${btoa(b64)}`;
    const route = decodeRoute(encoded);
    expect(route.dungeonIdx).toBe(164);
    expect(route.name).toBe("Altar live");
    expect(route.pulls[0].clones).toEqual([
      { enemyId: 1, cloneIdx: 1 },
      { enemyId: 1, cloneIdx: 2 },
    ]);
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

/** Minimal CBOR writer: maps with major-type-2 (byte string) keys, like Blizzard. */
function blizzardCborPreset(): Uint8Array {
  const out: number[] = [];
  const u8 = (n: number) => out.push(n & 0xff);
  const major = (type: number, n: number) => {
    if (n < 24) u8((type << 5) | n);
    else if (n < 256) {
      u8((type << 5) | 24);
      u8(n);
    } else {
      u8((type << 5) | 25);
      u8(n >> 8);
      u8(n);
    }
  };
  const bytes = (s: string) => {
    const b = new TextEncoder().encode(s);
    major(2, b.length);
    for (const x of b) u8(x);
  };
  const text = (s: string) => {
    const b = new TextEncoder().encode(s);
    major(3, b.length);
    for (const x of b) u8(x);
  };
  const uint = (n: number) => major(0, n);
  const map = (n: number) => major(5, n);

  // { text, uid, value: { currentDungeonIdx, currentPull, pulls: { 1: { 1: { 1: 1, 2: 2 }, note } } } }
  map(3);
  bytes("text");
  text("Altar live");
  bytes("uid");
  text("live11abcde");
  bytes("value");
  map(3);
  bytes("currentDungeonIdx");
  uint(164);
  bytes("currentPull");
  uint(1);
  bytes("pulls");
  map(1);
  uint(1);
  map(2);
  uint(1);
  map(2);
  uint(1);
  uint(1);
  uint(2);
  uint(2);
  bytes("note");
  text("lust");
  return Uint8Array.from(out);
}

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
