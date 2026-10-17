import {
  base64ToBytes,
  packedByteLength,
  resizeBuffer
} from '../../../utils/packed-buffer';

/**
 * The ROM semantics on top of a plain bit-packed byte buffer: how the address
 * size maps to a word count, and how the buffer reaches the `@logigator/sim`
 * ROM (type 12) as its `ops` table. Persisted as base64, verbatim in both the
 * legacy v0 `s` slot and the native format.
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
