# MDT Board

Personal local-first Mythic+ route viewer and editor for a second monitor. Inspired by Mythic Dungeon Tools and Keystone.guru usage, with no account and no combat log.

Built for a Blood DK: large parchment map, numbered pulls, count %, notes, keyboard-first board.

Pool is **Midnight Season 2 / patch 12.1**:

| Dungeon | MDT index | Count |
| --- | ---: | ---: |
| Altar of Fangs | 164 | 817 |
| Murder Row | 160 | 655 |
| Den of Nalorakk | 161 | 729 |
| The Blinding Vale | 162 | 686 |
| Voidscar Arena | 163 | 738 |
| Kings' Rest | 17 | 608 |
| Temple of Sethraliss | 20 | 687 |
| Ruby Life Pools | 42 | 551 |

Indexes, NPC positions, `count`, `displayId`, and map tiles come from [MythicDungeonTools](https://github.com/Nnoggie/MythicDungeonTools) (`Midnight/*.lua` plus `Midnight/Textures`). Re-extract with `npm run extract` (sparse clone of the addon). Portraits resolve from Wowhead `zamimg` NPC model thumbs (`displayId % 256`) and are cached in `public/portraits`.

## Run locally

Public repo: **https://github.com/realKarasu/mdt-board**

```bash
git clone https://github.com/realKarasu/mdt-board.git
cd mdt-board
npm install
npm run dev
```

Open **http://127.0.0.1:43173**. No deploy: everything stays on localhost.

Tests: `npm test`.

## Import an MDT string

1. In game, open MDT → Export / Share and copy the string (`!…` legacy Ace + LibDeflate, or `!~MDT2~…` CBOR).
2. In the app: **Paste MDT string**, paste, import.
3. If decode fails, the error is shown (nothing is swallowed).
4. **Altar of Fangs example** loads `fixtures/altar-of-fangs.mdt`.

You can also paste a `mdt-board-route` JSON backup exported by the app.

## Second-screen board

1. Load a route (import or build).
2. Click **Board** (import already opens the board).
3. Drag the browser window onto monitor 2.
4. `F` or browser fullscreen (`F11`) to hide chrome.
5. **No mouse needed**: `←` `→` or `J` `K` to change pull, `1`–`9` to jump, `Esc` for the editor.

The board shows dungeon and route name, total %, **PULL N**, packs, note, remaining %, and the next pull.

## Editor

- Pick a dungeon from the live pool.
- Click NPC portraits to add or remove them from the active pull (a clone already in another pull is moved).
- Create, reorder, or delete pulls. Short note per pull.
- Scroll to zoom. Drag to pan. Floor tabs if MDT has several sublevels.
- **Save**: `localStorage` only.
- **Export**: full JSON plus a best-effort MDT string.

The map uses the classic MDT look: parchment top-down, circular NPC portraits, colored convex hulls around each pull, a numbered path with direction arrows, yellow `!` notes, and a blue diamond at the entrance.

## MDT export limits

Import reads real presets (dungeon, pulls `enemyId → clones`, notes, `uid`).

MDT export rewrites dungeon + pulls + notes + name. It does **not** include drawings / objects, POI assignments, affix week, or `!~MDT2~` (it emits legacy `!` AceSerializer + LibDeflate, which most clients accept). Keep the JSON for a faithful copy.

## Architecture

- `scripts/extract-mdt.mjs`: parse MDT Lua tables, stitch the official 10×15 grid of 128px tiles (`sizex=840` / `sizey=555`), download NPC portraits.
- `src/lib/mdt/`: AceSerializer-3.0, LibDeflate `EncodeForPrint`, inflate raw, MDT2 base64 + deflate + CBOR.
- `src/data/*.json` + `public/maps/*.jpg` + `public/portraits/*.webp`: season data, not the whole addon.

## License

App code: personal use. Data and maps are derived from Mythic Dungeon Tools (Nnoggie). Follow the addon license if you redistribute extracts.
