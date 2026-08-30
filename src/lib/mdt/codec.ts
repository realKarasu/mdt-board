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

/** Blizzard C_EncodingUtil CBOR: maps, no cbor-x record tags. */
const cborDecoder = new Decoder({ useRecords: false, mapsAsObjects: true });
const cborEncoder = new Encoder({ useRecords: false, mapsAsObjects: true });

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

function decodeCbor(bytes: Uint8Array): AceValue {
  return cborDecoder.decode(bytes) as AceValue;
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
