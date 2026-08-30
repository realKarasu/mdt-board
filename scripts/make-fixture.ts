import { writeFileSync } from "node:fs";
import path from "node:path";
import { encodeRoute, decodeRoute } from "../src/lib/mdt/preset";
import { createRoute, emptyPull } from "../src/lib/route";

const route = createRoute(164, "Autel · Blood DK sample");
route.pulls = [
  {
    ...emptyPull(0),
    clones: [
      { enemyId: 1, cloneIdx: 1 },
      { enemyId: 1, cloneIdx: 2 },
    ],
    note: "Lust sur le premier gros pack",
  },
  {
    ...emptyPull(1),
    clones: [{ enemyId: 2, cloneIdx: 1 }],
    note: "Skip si late",
  },
  {
    ...emptyPull(2),
    clones: [{ enemyId: 3, cloneIdx: 1 }],
    note: "",
  },
];
route.uid = "sample11abc";

const encoded = encodeRoute(route);
const decoded = decodeRoute(encoded);
if (decoded.dungeonIdx !== 164) throw new Error("roundtrip dungeon");
if (decoded.pulls.length !== 3) throw new Error("roundtrip pulls");
if (decoded.pulls[0].clones.length !== 2) throw new Error("roundtrip clones");

const out = path.resolve("fixtures/altar-of-fangs.mdt");
writeFileSync(out, `${encoded}\n`);
console.log("Wrote", out, "len", encoded.length);
