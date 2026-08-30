import { Decoder, Encoder } from "cbor-x";
import { deflate, deflateRaw, inflate, inflateRaw } from "pako";
import { aceDeserialize, aceSerialize, asTable, type AceValue } from "./ace";
import { decodeForPrint, encodeForPrint } from "./print";

export class MdtDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MdtDecodeError";
  }
}

const MDT2 = "!~MDT2~";

/** Our encoder: text-string map keys, no record tags. */
const cborEncoder = new Encoder({ useRecords: false, mapsAsObjects: true });
/** JS objects reject Uint8Array keys; Blizzard uses those (major type 2). */
const cborObjectDecoder = new Decoder({ useRecords: false, mapsAsObjects: true });
const cborMapDecoder = new Decoder({ useRecords: false, mapsAsObjects: false });

function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder("utf-8").decode(bytes);
}

function stringToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function latin1Bytes(value: string): Uint8Array {
  const out = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) out[i] = value.charCodeAt(i) & 0xff;
  return out;
}

/** Legacy Ace path: raw first (LibDeflate), then zlib. */
function tryInflateLegacy(bytes: Uint8Array): Uint8Array {
  try {
    return inflateRaw(bytes);
  } catch {
    try {
      return inflate(bytes);
    } catch {
      throw new MdtDecodeError("Deflate decompression failed");
    }
  }
}

/**
 * MDT2 uses C_EncodingUtil.CompressString(..., Deflate): zlib-wrapped.
 * inflateRaw can succeed on those bytes and yield garbage, so zlib first,
 * then raw. Callers try CBOR on every candidate.
 */
function inflateMdt2Candidates(bytes: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = [];
  const seen = new Set<string>();
  const attempts: Array<() => Uint8Array> = [
    () => inflate(bytes),
    () => inflate(bytes, { windowBits: 15 + 32 }),
    () => inflateRaw(bytes),
  ];
  for (const run of attempts) {
    try {
      const next = run();
      const key = `${next.length}:${next[0] ?? ""}:${next[next.length - 1] ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(next);
    } catch {
      // try the next inflater
    }
  }
  if (!out.length) throw new MdtDecodeError("Deflate decompression failed");
  return out;
}

function keyToString(key: unknown): string {
  if (typeof key === "string") return key;
  if (typeof key === "number" || typeof key === "bigint" || typeof key === "boolean") {
    return String(key);
  }
  const bytes = asBytes(key);
  if (bytes) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return new TextDecoder("latin1").decode(bytes);
    }
  }
  return String(key);
}

function asBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

/** Map → object; byte-string keys/values → UTF-8 (latin1 fallback); arrays stay arrays. */
export function fromCbor(value: unknown): AceValue {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  const bytes = asBytes(value);
  if (bytes) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return new TextDecoder("latin1").decode(bytes);
    }
  }
  if (value instanceof Map) {
    const table: Record<string, AceValue> = {};
    for (const [k, v] of value) table[keyToString(k)] = fromCbor(v);
    return table;
  }
  if (Array.isArray(value)) {
    return value.map((item) => fromCbor(item)) as unknown as AceValue;
  }
  if (typeof value === "object") {
    const table: Record<string, AceValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      table[k] = fromCbor(v);
    }
    return table;
  }
  return null;
}

function decodeCbor(bytes: Uint8Array): AceValue {
  try {
    return fromCbor(cborObjectDecoder.decode(bytes));
  } catch {
    return fromCbor(cborMapDecoder.decode(bytes));
  }
}

function decodeLegacy(raw: string): AceValue {
  let encoded = raw.trim();
  if (encoded.startsWith("!MDT!")) encoded = encoded.slice(5);
  const hadBang = encoded.startsWith("!");
  if (hadBang) encoded = encoded.slice(1);
  let binary: Uint8Array;
  try {
    binary = decodeForPrint(encoded);
  } catch (err) {
    throw new MdtDecodeError(
      err instanceof Error ? err.message : "LibDeflate decode failed",
    );
  }
  const decompressed = tryInflateLegacy(binary);
  const aceText = bytesToString(decompressed);
  try {
    return aceDeserialize(aceText);
  } catch (err) {
    throw new MdtDecodeError(err instanceof Error ? err.message : "Ace deserialize failed");
  }
}

function decodeBase64(b64: string): Uint8Array {
  try {
    return latin1Bytes(atob(b64));
  } catch {
    throw new MdtDecodeError("Invalid MDT2 base64");
  }
}

function decodeMdt2(raw: string): AceValue {
  const b64 = raw.startsWith(MDT2) ? raw.slice(MDT2.length) : raw;
  const binary = decodeBase64(b64);
  const candidates = inflateMdt2Candidates(binary);
  let last: unknown;
  for (const decompressed of candidates) {
    try {
      return decodeCbor(decompressed);
    } catch (err) {
      last = err;
    }
  }
  throw new MdtDecodeError(
    last instanceof Error ? `Invalid MDT2 CBOR: ${last.message}` : "Invalid MDT2 CBOR",
  );
}

/** Standard base64 (Blizzard EncodeBase64) uses + / =; LibDeflate print does not. */
export function looksLikeStdBase64(value: string): boolean {
  if (!/^[A-Za-z0-9+/]+=*$/.test(value)) return false;
  return /[+/=]/.test(value);
}

export function decodeMdtString(raw: string): AceValue {
  const trimmed = raw.trim().replace(/\s+/g, "");
  if (!trimmed) throw new MdtDecodeError("Paste a non-empty MDT string");
  if (trimmed.startsWith(MDT2) || looksLikeStdBase64(trimmed)) return decodeMdt2(trimmed);
  return decodeLegacy(trimmed);
}

export function encodeMdtString(value: AceValue): string {
  const ace = aceSerialize(value);
  const compressed = deflateRaw(stringToBytes(ace));
  return `!${encodeForPrint(compressed)}`;
}

/** Official MDT2: CBOR + zlib Deflate + standard base64 + !~MDT2~ */
export function encodeMdt2String(value: AceValue): string {
  const compressed = deflate(cborEncoder.encode(value));
  let b64 = "";
  for (let i = 0; i < compressed.length; i += 1) b64 += String.fromCharCode(compressed[i]);
  return `${MDT2}${btoa(b64)}`;
}

export function requirePresetTable(value: AceValue) {
  return asTable(value);
}
