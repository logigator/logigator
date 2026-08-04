import { describe, expect, it } from 'vitest';
import { encodeRomOps, romByteLength, romWordCount } from './rom-data.codec';

describe('rom-data.codec', () => {
  it('maps address size to word count', () => {
    expect(romWordCount(1)).toBe(2);
    expect(romWordCount(4)).toBe(16);
    expect(romWordCount(11)).toBe(2048);
  });

  it('computes the table byte length', () => {
    expect(romByteLength(1, 4)).toBe(1); // 2 words × 4 bits
    expect(romByteLength(4, 4)).toBe(8); // 16 × 4
    expect(romByteLength(3, 8)).toBe(8); // 8 × 8
  });

  it('encodes ops zero-padded to the table size', () => {
    // 'gQ==' decodes to the single byte 0x81 (addr0 → bit 0, addr1 → bit 7 of a
    // 4-bit word), which is exactly the 1-byte table for a 1-bit-address ROM.
    expect(encodeRomOps('gQ==', 1, 4)).toEqual([0x81]);

    // Empty contents → a zero-filled blob of the right length.
    expect(encodeRomOps('', 4, 4)).toEqual(new Array(8).fill(0));
  });
});
