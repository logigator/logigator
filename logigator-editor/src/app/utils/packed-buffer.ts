/**
 * Generic bit-packed byte-buffer helpers, independent of any component type.
 *
 * A buffer is a flat **LSB-first** bitstream: the `wordSize`-bit word at index
 * `i` occupies bits `[i * wordSize, i * wordSize + wordSize)`, where bit `b`
 * lives at byte `b >> 3`, bit `b & 7`. (Matches the `@logigator/sim` memory
 * `ops` layout, but nothing here depends on that.)
 */

/** Bytes needed to hold `wordCount` words of `wordSize` bits each. */
export function packedByteLength(wordCount: number, wordSize: number): number {
  return Math.ceil((wordCount * wordSize) / 8);
}

/** Largest unsigned value a `wordSize`-bit word can hold. */
export function maxWord(wordSize: number): bigint {
  return (1n << BigInt(wordSize)) - 1n;
}

/**
 * Reads the `wordSize`-bit word at `index`. Bits past the end of `bytes` (e.g.
 * an under-sized buffer) read as zero.
 */
export function readWord(
  bytes: Uint8Array,
  index: number,
  wordSize: number
): bigint {
  let value = 0n;
  const base = index * wordSize;
  for (let k = 0; k < wordSize; k++) {
    const bit = base + k;
    const byte = bytes[bit >> 3];
    if (byte !== undefined && (byte & (1 << (bit & 7))) !== 0) {
      value |= 1n << BigInt(k);
    }
  }
  return value;
}

/**
 * Writes the `wordSize`-bit word at `index` into `bytes` (mutating). The caller
 * sizes `bytes` to {@link packedByteLength}; bits past the end are dropped.
 */
export function writeWord(
  bytes: Uint8Array,
  index: number,
  wordSize: number,
  value: bigint
): void {
  const base = index * wordSize;
  for (let k = 0; k < wordSize; k++) {
    const bit = base + k;
    const idx = bit >> 3;
    if (idx >= bytes.length) break;
    const mask = 1 << (bit & 7);
    if ((value & (1n << BigInt(k))) !== 0n) {
      bytes[idx] |= mask;
    } else {
      bytes[idx] &= ~mask;
    }
  }
}

/**
 * Returns a copy of `bytes` resized to exactly `byteLength` — truncated if
 * longer, zero-padded if shorter.
 */
export function resizeBuffer(
  bytes: Uint8Array,
  byteLength: number
): Uint8Array {
  const out = new Uint8Array(byteLength);
  out.set(bytes.subarray(0, byteLength));
  return out;
}

/**
 * Drops trailing zero bytes so a sparse or empty buffer encodes compactly (an
 * all-zero buffer ⇒ empty). Lossless against {@link readWord} (treats bytes
 * past the end as zero) and {@link resizeBuffer} (zero-pads back).
 */
export function trimTrailingZeros(bytes: Uint8Array): Uint8Array {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end--;
  return bytes.subarray(0, end);
}

/** Decodes a base64 string to bytes (`''` ⇒ empty). */
export function base64ToBytes(base64: string): Uint8Array {
  if (!base64) return new Uint8Array(0);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Encodes bytes to a base64 string. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
