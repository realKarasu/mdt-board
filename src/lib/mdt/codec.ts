import { decode as cborDecode, encode as cborEncode } from "cbor-x";
import { deflateRaw, inflate, inflateRaw } from "pako";
import { aceDeserialize, aceSerialize, asTable, type AceValue } from "./ace";
import { decodeForPrint, encodeForPrint } from "./print";

export class MdtDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MdtDecodeError";
  }
}

const MDT2 = "!~MDT2~";

function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder("latin1").decode(bytes);
}

function stringToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function latin1Bytes(value: string): Uint8Array {
  const out = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) out[i] = value.charCodeAt(i) & 0xff;
  return out;
}

function tryInflate(bytes: Uint8Array): Uint8Array {
  try {
    return inflateRaw(bytes);
  } catch {
    try {
      return inflate(bytes);
    } catch {
      throw new MdtDecodeError("Décompression Deflate impossible");
    }
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
      err instanceof Error ? err.message : "Décodage LibDeflate impossible",
    );
  }
  const decompressed = tryInflate(binary);
  const aceText = bytesToString(decompressed);
  try {
    return aceDeserialize(aceText);
  } catch (err) {
    throw new MdtDecodeError(err instanceof Error ? err.message : "Désérialisation Ace impossible");
  }
}

function decodeMdt2(raw: string): AceValue {
  const b64 = raw.slice(MDT2.length).trim();
  let binary: Uint8Array;
  try {
    const bin = atob(b64);
    binary = latin1Bytes(bin);
  } catch {
    throw new MdtDecodeError("Base64 MDT2 invalide");
  }
  const decompressed = tryInflate(binary);
  try {
    return cborDecode(decompressed) as AceValue;
  } catch {
    throw new MdtDecodeError("CBOR MDT2 invalide");
  }
}

export function decodeMdtString(raw: string): AceValue {
  const trimmed = raw.trim().replace(/\s+/g, "");
  if (!trimmed) throw new MdtDecodeError("Colle une chaîne MDT non vide");
  if (trimmed.startsWith(MDT2)) return decodeMdt2(trimmed);
  return decodeLegacy(trimmed);
}

export function encodeMdtString(value: AceValue): string {
  const ace = aceSerialize(value);
  const compressed = deflateRaw(stringToBytes(ace));
  return `!${encodeForPrint(compressed)}`;
}

export function encodeMdt2String(value: AceValue): string {
  const compressed = deflateRaw(cborEncode(value));
  let b64 = "";
  for (let i = 0; i < compressed.length; i += 1) b64 += String.fromCharCode(compressed[i]);
  return `${MDT2}${btoa(b64)}`;
}

export function requirePresetTable(value: AceValue) {
  return asTable(value);
}
