import {
  base64ToBytes,
  packedByteLength,
  resizeBuffer
} from '../../../utils/packed-buffer';

/**
 * ROM-specific encoding of a memory's contents. The contents are a plain
 * bit-packed byte buffer (see `utils/packed-buffer.ts`); this module only adds
 * the ROM semantics: how the address size maps to a word count, and how the
 * buffer is handed to the `@logigator/sim` ROM (type 12) as its `ops` table.
 * The blob is persisted as base64 — the legacy v0 `s` slot and the editor's
 * native file format both carry it verbatim.
 */

/** Number of addressable words for an `addressSize`-bit address. */
export function romWordCount(addressSize: number): number {
  return 1 << addressSize;
}

/** Bytes needed to hold a full `2^addressSize` × `wordSize`-bit table. */
export function romByteLength(addressSize: number, wordSize: number): number {
  return packedByteLength(romWordCount(addressSize), wordSize);
}

/**
 * Encodes the stored base64 contents into the `@logigator/sim` ROM `ops` blob:
 * a byte array sized to the address/word dimensions, zero-padded.
 */
export function encodeRomOps(
  base64: string,
  addressSize: number,
  wordSize: number
): number[] {
  return Array.from(
    resizeBuffer(base64ToBytes(base64), romByteLength(addressSize, wordSize))
  );
}
