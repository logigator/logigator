import { describe, expect, it } from 'vitest';
import {
  base64ToBytes,
  bytesToBase64,
  maxWord,
  packedByteLength,
  readWord,
  resizeBuffer,
  trimTrailingZeros,
  writeWord
} from './packed-buffer';

describe('packed-buffer', () => {
  it('computes byte length from word count and size', () => {
    expect(packedByteLength(2, 4)).toBe(1); // 8 bits
    expect(packedByteLength(16, 4)).toBe(8); // 64 bits
    expect(packedByteLength(4, 4)).toBe(2); // 16 bits
    expect(packedByteLength(1, 1)).toBe(1);
  });

  it('computes the max word value', () => {
    expect(maxWord(4)).toBe(0xfn);
    expect(maxWord(8)).toBe(0xffn);
    expect(maxWord(64)).toBe((1n << 64n) - 1n);
  });

  it('round-trips words through write/read', () => {
    const bytes = new Uint8Array(packedByteLength(16, 12));
    writeWord(bytes, 0, 12, 0xabcn);
    writeWord(bytes, 7, 12, 0x123n);
    writeWord(bytes, 15, 12, 0xfffn);
    expect(readWord(bytes, 0, 12)).toBe(0xabcn);
    expect(readWord(bytes, 7, 12)).toBe(0x123n);
    expect(readWord(bytes, 15, 12)).toBe(0xfffn);
    expect(readWord(bytes, 3, 12)).toBe(0n);
  });

  it('supports 64-bit words (beyond Number.MAX_SAFE_INTEGER)', () => {
    const bytes = new Uint8Array(packedByteLength(2, 64));
    const value = 0xdeadbeefcafef00dn;
    writeWord(bytes, 1, 64, value);
    expect(readWord(bytes, 1, 64)).toBe(value);
    expect(readWord(bytes, 0, 64)).toBe(0n);
  });

  it('packs LSB-first', () => {
    // index0 = bit 0 (value 1), index1 = bit 7 (value 8) for a 4-bit word →
    // a single byte 0x81.
    const bytes = new Uint8Array(packedByteLength(2, 4));
    writeWord(bytes, 0, 4, 1n);
    writeWord(bytes, 1, 4, 8n);
    expect(Array.from(bytes)).toEqual([0x81]);
  });

  it('reads zero past the end of an under-sized buffer', () => {
    expect(readWord(new Uint8Array(1), 100, 8)).toBe(0n);
  });

  it('resizes to exact byte length (pad and truncate)', () => {
    const grown = resizeBuffer(new Uint8Array([0xaa]), 8);
    expect(Array.from(grown)).toEqual([0xaa, 0, 0, 0, 0, 0, 0, 0]);
    expect(Array.from(resizeBuffer(new Uint8Array([1, 2, 3, 4]), 1))).toEqual([
      1
    ]);
  });

  it('trims trailing zero bytes (lossless against read/resize)', () => {
    expect(
      Array.from(trimTrailingZeros(Uint8Array.from([0xa0, 0, 0])))
    ).toEqual([0xa0]);
    expect(trimTrailingZeros(new Uint8Array([0, 0, 0])).length).toBe(0);
    expect(Array.from(trimTrailingZeros(Uint8Array.from([0, 0x01])))).toEqual([
      0, 0x01
    ]);

    const trimmed = trimTrailingZeros(Uint8Array.from([0x81, 0, 0, 0]));
    expect(readWord(resizeBuffer(trimmed, 1), 1, 4)).toBe(8n);
  });

  it('round-trips base64', () => {
    const bytes = new Uint8Array([0x00, 0x81, 0xff, 0x10]);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
    expect(base64ToBytes('')).toEqual(new Uint8Array(0));
  });
});
