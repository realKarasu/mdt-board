/** AceSerializer-3.0 (revision 1) encode / decode. */

export type AceValue = string | number | boolean | null | AceTable;
export type AceTable = { [key: string | number]: AceValue };

const INF = "1.#INF";
const NEG_INF = "-1.#INF";

function escapeString(value: string): string {
  return value.replace(/[\x00-\x20\x7f^~]/g, (ch) => {
    const n = ch.charCodeAt(0);
    if (n === 30) return "~\x7a";
    if (n <= 32) return `~${String.fromCharCode(n + 64)}`;
    if (n === 94) return "~\x7d";
    if (n === 126) return "~\x7c";
    if (n === 127) return "~\x7b";
    return ch;
  });
}

function unescapeString(value: string): string {
  return value.replace(/~./g, (escape) => {
    if (escape < "~\x7a") return String.fromCharCode(escape.charCodeAt(1) - 64);
    if (escape === "~\x7a") return "\x1e";
    if (escape === "~\x7b") return "\x7f";
    if (escape === "~\x7c") return "~";
    if (escape === "~\x7d") return "^";
    throw new Error(`Échappement Ace invalide: ${escape}`);
  });
}

function serializeValue(v: AceValue, out: string[]): void {
  if (v === null) {
    out.push("^Z");
    return;
  }
  const t = typeof v;
  if (t === "string") {
    out.push("^S", escapeString(v as string));
    return;
  }
  if (t === "number") {
    const n = v as number;
    if (!Number.isFinite(n)) {
      out.push("^N", n === Number.POSITIVE_INFINITY ? INF : NEG_INF);
      return;
    }
    const asStr = String(n);
    if (Number(asStr) === n) {
      out.push("^N", asStr);
      return;
    }
    const exp = Math.floor(Math.log2(Math.abs(n)));
    const mantissa = Math.round(n * 2 ** (53 - exp));
    out.push("^F", String(mantissa), "^f", String(exp - 53));
    return;
  }
  if (t === "boolean") {
    out.push(v ? "^B" : "^b");
    return;
  }
  if (t === "object") {
    out.push("^T");
    for (const [key, value] of Object.entries(v as AceTable)) {
      const numKey = Number(key);
      serializeValue(Number.isInteger(numKey) && String(numKey) === key ? numKey : key, out);
      serializeValue(value, out);
    }
    out.push("^t");
    return;
  }
  throw new Error(`Type Ace non sérialisable: ${t}`);
}

export function aceSerialize(value: AceValue): string {
  const out = ["^1"];
  serializeValue(value, out);
  out.push("^^");
  return out.join("");
}

function parseNumber(raw: string): number {
  if (raw === NEG_INF || raw === "-inf") return Number.NEGATIVE_INFINITY;
  if (raw === INF || raw === "inf") return Number.POSITIVE_INFINITY;
  const n = Number(raw);
  if (Number.isNaN(n)) throw new Error(`Nombre Ace invalide: ${raw}`);
  return n;
}

export function aceDeserialize(input: string): AceValue {
  const str = input.replace(/[\x00-\x1f ]/g, "");
  const tokens: { ctl: string; data: string }[] = [];
  const re = /(\^.)([^^]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(str))) {
    tokens.push({ ctl: m[1], data: m[2] });
  }
  if (!tokens.length || tokens[0].ctl !== "^1") {
    throw new Error("Ce n'est pas une chaîne AceSerializer (rév. 1)");
  }
  let i = 1;

  function readOne(): AceValue {
    if (i >= tokens.length) throw new Error("Données Ace tronquées");
    const { ctl, data } = tokens[i];
    i += 1;
    if (ctl === "^^") return null;
    if (ctl === "^S") return unescapeString(data);
    if (ctl === "^N") return parseNumber(data);
    if (ctl === "^F") {
      const next = tokens[i];
      if (!next || next.ctl !== "^f") throw new Error("Flottant Ace incomplet");
      i += 1;
      return Number(data) * 2 ** Number(next.data);
    }
    if (ctl === "^B") return true;
    if (ctl === "^b") return false;
    if (ctl === "^Z") return null;
    if (ctl === "^T") {
      const table: AceTable = {};
      while (true) {
        if (i >= tokens.length) throw new Error("Table Ace sans fin");
        if (tokens[i].ctl === "^t") {
          i += 1;
          break;
        }
        const key = readOne();
        const value = readOne();
        if (key === null) throw new Error("Clé de table Ace invalide");
        table[key as string | number] = value;
      }
      return table;
    }
    throw new Error(`Code Ace inconnu: ${ctl}`);
  }

  return readOne();
}

export function asTable(value: AceValue): AceTable {
  if (!value || typeof value !== "object") {
    throw new Error("Objet MDT attendu");
  }
  return value as AceTable;
}
