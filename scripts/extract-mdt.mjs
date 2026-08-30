#!/usr/bin/env node
/**
 * Extracts Midnight S2 dungeon JSON + stitched maps from MythicDungeonTools.
 * Source of truth: https://github.com/Nnoggie/MythicDungeonTools
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MDT_DIR = process.env.MDT_SRC || "/tmp/mdt-src";
const TILE_COLS = 15;
const TILE_ROWS = 10;
const TILE_PX = 128;
const MAP_W = 840;
const MAP_H = 555;

const DUNGEONS = [
  { file: "AltarOfFangs.lua", texture: "AltarOfFangs", slug: "altar-of-fangs", shortName: "Altar" },
  { file: "MurderRow.lua", texture: "MurderRow", slug: "murder-row", shortName: "Murder Row" },
  { file: "DenOfNalorakk.lua", texture: "DenOfNalorakk", slug: "den-of-nalorakk", shortName: "Nalorakk" },
  { file: "TheBlindingVale.lua", texture: "TheBlindingVale", slug: "the-blinding-vale", shortName: "Vale" },
  { file: "VoidscarArena.lua", texture: "VoidscarArena", slug: "voidscar-arena", shortName: "Voidscar" },
  { file: "KingsRest.lua", texture: "KingsRest", slug: "kings-rest", shortName: "Kings' Rest", englishName: "Kings' Rest" },
  { file: "TempleOfSethraliss.lua", texture: "TempleOfSethraliss", slug: "temple-of-sethraliss", shortName: "Sethraliss" },
  { file: "RubyLifePools.lua", texture: "RubyLifePools", slug: "ruby-life-pools", shortName: "Ruby" },
];

function skipWs(src, i) {
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i += 1;
      continue;
    }
    if (c === "-" && src[i + 1] === "-") {
      i += 2;
      while (i < src.length && src[i] !== "\n") i += 1;
      continue;
    }
    break;
  }
  return i;
}

function parseString(src, i) {
  const q = src[i];
  i += 1;
  let out = "";
  while (i < src.length) {
    const c = src[i];
    if (c === "\\") {
      const n = src[i + 1];
      const map = { n: "\n", t: "\t", r: "\r", "\\": "\\", '"': '"', "'": "'" };
      out += map[n] ?? n;
      i += 2;
      continue;
    }
    if (c === q) return { value: out, i: i + 1 };
    out += c;
    i += 1;
  }
  throw new Error("Unterminated string");
}

function parseNumber(src, i) {
  const m = src.slice(i).match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/);
  if (!m) throw new Error(`Bad number at ${i}`);
  return { value: Number(m[0]), i: i + m[0].length };
}

function parseIdent(src, i) {
  const m = src.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*/);
  if (!m) throw new Error(`Bad ident at ${i}: ${src.slice(i, i + 20)}`);
  return { value: m[0], i: i + m[0].length };
}

function parseValue(src, i) {
  i = skipWs(src, i);
  const c = src[i];
  if (c === "{") return parseTable(src, i);
  if (c === '"' || c === "'") return parseString(src, i);
  if (c === "-" || (c >= "0" && c <= "9")) return parseNumber(src, i);
  if (src.startsWith("true", i)) return { value: true, i: i + 4 };
  if (src.startsWith("false", i)) return { value: false, i: i + 5 };
  if (src.startsWith("nil", i)) return { value: null, i: i + 3 };
  // L["key"] or other call: treat as string of the key if possible
  if (/^[A-Za-z_]/.test(c)) {
    const id = parseIdent(src, i);
    i = skipWs(src, id.i);
    if (src[i] === "[") {
      const key = parseValue(src, i + 1);
      i = skipWs(src, key.i);
      if (src[i] !== "]") throw new Error("Expected ] after index");
      i = skipWs(src, i + 1);
      if (src[i] === "(") {
        // function call with no args or args we skip
        let depth = 0;
        do {
          if (src[i] === "(") depth += 1;
          if (src[i] === ")") depth -= 1;
          i += 1;
        } while (depth > 0 && i < src.length);
      }
      return { value: key.value, i };
    }
    return { value: id.value, i: id.i };
  }
  throw new Error(`Unexpected '${src.slice(i, i + 30)}' at ${i}`);
}

function parseTable(src, i) {
  if (src[i] !== "{") throw new Error("Expected {");
  i += 1;
  const obj = {};
  let nextArray = 1;
  while (true) {
    i = skipWs(src, i);
    if (src[i] === "}") return { value: obj, i: i + 1 };
    if (src[i] === ",") {
      i += 1;
      continue;
    }
    if (src[i] === ";") {
      i += 1;
      continue;
    }

    let key;
    if (src[i] === "[") {
      const k = parseValue(src, i + 1);
      i = skipWs(src, k.i);
      if (src[i] !== "]") throw new Error("Expected ]");
      i = skipWs(src, i + 1);
      if (src[i] !== "=") throw new Error("Expected = after key");
      i += 1;
      key = k.value;
    } else if (/^[A-Za-z_]/.test(src[i])) {
      const peek = src.slice(i).match(/^[A-Za-z_][A-Za-z0-9_]*\s*=/);
      if (peek) {
        const id = parseIdent(src, i);
        i = skipWs(src, id.i);
        if (src[i] !== "=") throw new Error("Expected =");
        i += 1;
        key = id.value;
      }
    }

    const v = parseValue(src, i);
    i = v.i;
    if (key === undefined) {
      key = nextArray;
      nextArray += 1;
    }
    obj[key] = v.value;
  }
}

function extractAssignment(src, name) {
  const needle = `MDT.${name}[dungeonIndex]`;
  const idx = src.indexOf(needle);
  if (idx < 0) return null;
  const eq = src.indexOf("=", idx);
  return parseValue(src, eq + 1).value;
}

function luaToArray(table) {
  if (!table || typeof table !== "object") return [];
  const keys = Object.keys(table)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
    .sort((a, b) => a - b);
  return keys.map((k) => ({ key: k, value: table[k] }));
}

function extractDungeon(luaPath, meta) {
  const src = readFileSync(luaPath, "utf8");
  const indexMatch = src.match(/local dungeonIndex = (\d+)/);
  if (!indexMatch) throw new Error(`No dungeonIndex in ${luaPath}`);
  const dungeonIndex = Number(indexMatch[1]);
  const englishMatch = src.match(/englishName = "([^"]+)"/);
  const englishName = meta.englishName ?? englishMatch?.[1] ?? meta.slug;
  const totalMatch = src.match(/dungeonTotalCount\[dungeonIndex\] = \{ normal = (\d+) \}/);
  const totalCount = totalMatch ? Number(totalMatch[1]) : 0;

  const sublevelsRaw = extractAssignment(src, "dungeonSubLevels") ?? { 1: englishName };
  const sublevels = luaToArray(sublevelsRaw).map((s) => ({
    id: s.key,
    name: typeof s.value === "string" ? s.value : `${englishName} ${s.key}`,
  }));

  const enemiesRaw = extractAssignment(src, "dungeonEnemies");
  if (!enemiesRaw) throw new Error(`No enemies in ${luaPath}`);

  const enemies = luaToArray(enemiesRaw).map(({ key, value: e }) => {
    const clones = luaToArray(e.clones ?? {}).map(({ key: ck, value: c }) => {
      const patrol = luaToArray(c.patrol ?? {}).map(({ value: p }) => ({
        x: Number(p.x),
        y: Number(p.y),
      }));
      return {
        idx: ck,
        x: Number(c.x),
        y: Number(c.y),
        sublevel: Number(c.sublevel ?? 1),
        group: c.g != null ? Number(c.g) : null,
        patrol: patrol.length ? patrol : undefined,
      };
    });
    return {
      id: key,
      npcId: Number(e.id),
      displayId: Number(e.displayId ?? 0),
      name: String(e.name),
      count: Number(e.count ?? 0),
      isBoss: Boolean(e.isBoss),
      creatureType: e.creatureType ? String(e.creatureType) : null,
      stealthDetect: Boolean(e.stealthDetect),
      clones,
    };
  });

  const poisRaw = extractAssignment(src, "mapPOIs") ?? {};
  let entrance = null;
  for (const floor of luaToArray(poisRaw)) {
    for (const poi of luaToArray(floor.value ?? {})) {
      const p = poi.value;
      if (p && p.type === "dungeonEntrance") {
        entrance = { x: Number(p.x), y: Number(p.y), sublevel: floor.key };
        break;
      }
    }
    if (entrance) break;
  }

  const floors = [...new Set(enemies.flatMap((en) => en.clones.map((c) => c.sublevel)))].sort(
    (a, b) => a - b,
  );
  if (!floors.length) floors.push(1);

  return {
    dungeonIndex,
    slug: meta.slug,
    englishName,
    shortName: meta.shortName,
    totalCount,
    mapWidth: MAP_W,
    mapHeight: MAP_H,
    sublevels: sublevels.length ? sublevels : floors.map((id) => ({ id, name: englishName })),
    floors,
    entrance,
    enemies,
  };
}

async function stitchFloor(textureDir, floor, outPath) {
  const width = TILE_COLS * TILE_PX;
  const height = TILE_ROWS * TILE_PX;
  const composites = [];
  for (let row = 1; row <= TILE_ROWS; row += 1) {
    for (let col = 1; col <= TILE_COLS; col += 1) {
      const suffix = (row - 1) * TILE_COLS + col;
      const tilePath = path.join(textureDir, `${floor}_${suffix}.png`);
      if (!existsSync(tilePath)) continue;
      composites.push({
        input: tilePath,
        left: (col - 1) * TILE_PX,
        top: (row - 1) * TILE_PX,
      });
    }
  }
  if (!composites.length) {
    throw new Error(`No tiles in ${textureDir} for floor ${floor}`);
  }
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 12, g: 14, b: 18 },
    },
  })
    .composite(composites)
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(outPath);
}

function ensureMdtCheckout() {
  if (existsSync(path.join(MDT_DIR, "Midnight", "AltarOfFangs.lua"))) return;
  console.log("Cloning MythicDungeonTools…");
  execSync(
    `git clone --depth 1 --filter=blob:none --sparse https://github.com/Nnoggie/MythicDungeonTools.git "${MDT_DIR}"`,
    { stdio: "inherit" },
  );
  execSync("git sparse-checkout set Midnight", { cwd: MDT_DIR, stdio: "inherit" });
}

async function main() {
  ensureMdtCheckout();
  const outData = path.join(ROOT, "src", "data");
  const outMaps = path.join(ROOT, "public", "maps");
  mkdirSync(outData, { recursive: true });
  mkdirSync(outMaps, { recursive: true });

  const dungeons = [];
  for (const meta of DUNGEONS) {
    const luaPath = path.join(MDT_DIR, "Midnight", meta.file);
    console.log("Parse", meta.file);
    const dungeon = extractDungeon(luaPath, meta);
    const textureDir = path.join(MDT_DIR, "Midnight", "Textures", meta.texture);
    dungeon.maps = {};
    for (const floor of dungeon.floors) {
      const file = `${meta.slug}-${floor}.jpg`;
      const outPath = path.join(outMaps, file);
      console.log("  stitch floor", floor, "->", file);
      await stitchFloor(textureDir, floor, outPath);
      dungeon.maps[floor] = `/maps/${file}`;
    }
    dungeons.push(dungeon);
    console.log(
      `  idx=${dungeon.dungeonIndex} enemies=${dungeon.enemies.length} count=${dungeon.totalCount}`,
    );
  }

  const index = dungeons.map((d) => ({
    dungeonIndex: d.dungeonIndex,
    slug: d.slug,
    englishName: d.englishName,
    shortName: d.shortName,
    totalCount: d.totalCount,
    floors: d.floors,
    maps: d.maps,
    enemyCount: d.enemies.length,
    cloneCount: d.enemies.reduce((n, e) => n + e.clones.length, 0),
  }));

  writeFileSync(path.join(outData, "index.json"), JSON.stringify(index, null, 2));
  for (const d of dungeons) {
    writeFileSync(path.join(outData, `${d.slug}.json`), JSON.stringify(d));
  }
  writeFileSync(
    path.join(outData, "meta.ts"),
    `export const SEASON_LABEL = "Midnight Season 2";\nexport const PATCH = "12.1";\nexport const MAP_WIDTH = ${MAP_W};\nexport const MAP_HEIGHT = ${MAP_H};\nexport const TILE_COLS = ${TILE_COLS};\nexport const TILE_ROWS = ${TILE_ROWS};\n`,
  );

  await fetchPortraits(dungeons, path.join(ROOT, "public", "portraits"));
  console.log("Wrote", dungeons.length, "dungeons");
}

function portraitUrl(displayId) {
  return `https://wow.zamimg.com/modelviewer/live/webthumbs/npc/${displayId % 256}/${displayId}.webp`;
}

async function fetchPortraits(dungeons, outDir) {
  mkdirSync(outDir, { recursive: true });
  const ids = [...new Set(dungeons.flatMap((d) => d.enemies.map((e) => e.displayId).filter(Boolean)))];
  console.log("Portraits", ids.length);
  const pending = [...ids];
  const workers = Array.from({ length: 8 }, async () => {
    while (pending.length) {
      const id = pending.pop();
      const dest = path.join(outDir, `${id}.webp`);
      if (existsSync(dest)) continue;
      try {
        const res = await fetch(portraitUrl(id), { headers: { "User-Agent": "mdt-board/1.0" } });
        if (!res.ok) throw new Error(String(res.status));
        const buf = Buffer.from(await res.arrayBuffer());
        // Thumbs are full-body renders on transparency; trim the empty
        // border and crop toward the salient region so the creature
        // fills the circular portrait.
        await sharp(buf)
          .trim({ threshold: 12 })
          .resize(256, 256, { fit: "cover", position: sharp.strategy.attention })
          .webp({ quality: 88 })
          .toFile(dest);
      } catch {
        await sharp({
          create: { width: 256, height: 256, channels: 3, background: { r: 42, g: 28, b: 22 } },
        })
          .webp({ quality: 70 })
          .toFile(dest);
      }
    }
  });
  await Promise.all(workers);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
