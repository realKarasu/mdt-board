/** LibDeflate EncodeForPrint / DecodeForPrint (6-bit printable alphabet). */

const TO_CHAR = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789()";
const FROM_CHAR: Record<number, number> = {};
for (let i = 0; i < TO_CHAR.length; i += 1) {
  FROM_CHAR[TO_CHAR.charCodeAt(i)] = i;
}

export function encodeForPrint(bytes: Uint8Array): string {
  const chunks: string[] = [];
  let i = 0;
  const lastFull = bytes.length - 2;
  while (i < lastFull) {
    const cache = bytes[i] + bytes[i + 1] * 256 + bytes[i + 2] * 65536;
    i += 3;
    const b1 = cache % 64;
    const c2 = (cache - b1) / 64;
    const b2 = c2 % 64;
    const c3 = (c2 - b2) / 64;
    const b3 = c3 % 64;
    const b4 = (c3 - b3) / 64;
    chunks.push(TO_CHAR[b1] + TO_CHAR[b2] + TO_CHAR[b3] + TO_CHAR[b4]);
  }
  let cache = 0;
  let bitlen = 0;
  while (i < bytes.length) {
    cache += bytes[i] * 2 ** bitlen;
    bitlen += 8;
    i += 1;
  }
  while (bitlen > 0) {
    const bit6 = cache % 64;
    chunks.push(TO_CHAR[bit6]);
    cache = (cache - bit6) / 64;
    bitlen -= 6;
  }
  return chunks.join("");
}

export function decodeForPrint(input: string): Uint8Array {
  const str = input.replace(/^[\x00-\x1f ]+/, "").replace(/[\x00-\x1f ]+$/, "");
  if (str.length === 1) {
    throw new Error("LibDeflate string is too short");
  }
  const out: number[] = [];
  let i = 0;
  const lastFull = str.length - 3;
  while (i < lastFull) {
    const x1 = FROM_CHAR[str.charCodeAt(i)];
    const x2 = FROM_CHAR[str.charCodeAt(i + 1)];
    const x3 = FROM_CHAR[str.charCodeAt(i + 2)];
    const x4 = FROM_CHAR[str.charCodeAt(i + 3)];
    if (x1 == null || x2 == null || x3 == null || x4 == null) {
      throw new Error("Invalid character in LibDeflate encoding");
    }
    i += 4;
    const cache = x1 + x2 * 64 + x3 * 4096 + x4 * 262144;
    const b1 = cache % 256;
    const c2 = (cache - b1) / 256;
    const b2 = c2 % 256;
    const b3 = (c2 - b2) / 256;
    out.push(b1, b2, b3);
  }
  let cache = 0;
  let bitlen = 0;
  while (i < str.length) {
    const x = FROM_CHAR[str.charCodeAt(i)];
    if (x == null) throw new Error("Invalid character in LibDeflate encoding");
    cache += x * 2 ** bitlen;
    bitlen += 6;
    i += 1;
  }
  while (bitlen >= 8) {
    const byte = cache % 256;
    out.push(byte);
    cache = (cache - byte) / 256;
    bitlen -= 8;
  }
  return Uint8Array.from(out);
}
