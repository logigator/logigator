import { describe, expect, it } from 'vitest';
import { packSnapshot, SnapshotMessage, unpackSnapshot } from './protocol';

function snapshotMessage(
  packed: ReturnType<typeof packSnapshot>,
  isDelta: boolean
): SnapshotMessage {
  return {
    kind: 'snapshot',
    reqId: 1,
    tick: 42,
    isDelta,
    ...packed
  };
}

describe('simulation worker protocol', () => {
  it('round-trips a delta snapshot payload', () => {
    const ids = new Uint32Array([3, 17, 250]);
    const values = new Uint8Array([0b101]);
    const packed = packSnapshot(undefined, new Uint8Array(ids.buffer), values);

    expect(packed.idsByteLength).toBe(12);
    expect(packed.valuesByteLength).toBe(1);

    const unpacked = unpackSnapshot(snapshotMessage(packed, true));
    expect([...unpacked.ids!]).toEqual([3, 17, 250]);
    expect([...unpacked.values]).toEqual([0b101]);
  });

  it('round-trips a full snapshot payload (no ids)', () => {
    const bits = new Uint8Array([0xff, 0x01]);
    const packed = packSnapshot(undefined, null, bits);

    expect(packed.idsByteLength).toBe(0);
    expect(packed.valuesByteLength).toBe(2);

    const unpacked = unpackSnapshot(snapshotMessage(packed, false));
    expect(unpacked.ids).toBeNull();
    expect([...unpacked.values]).toEqual([0xff, 0x01]);
  });

  it('reuses a pooled buffer that is large enough', () => {
    const pool = new ArrayBuffer(64);
    const packed = packSnapshot(pool, null, new Uint8Array([1, 2, 3]));
    expect(packed.buffer).toBe(pool);
  });

  it('allocates a fresh buffer when the pooled one is too small', () => {
    const pool = new ArrayBuffer(2);
    const ids = new Uint8Array(new Uint32Array([1, 2]).buffer);
    const packed = packSnapshot(pool, ids, new Uint8Array([7]));
    expect(packed.buffer).not.toBe(pool);
    expect(packed.buffer.byteLength).toBeGreaterThanOrEqual(9);

    const unpacked = unpackSnapshot(snapshotMessage(packed, true));
    expect([...unpacked.ids!]).toEqual([1, 2]);
    expect([...unpacked.values]).toEqual([7]);
  });

  it('copies the source bytes instead of aliasing them', () => {
    const source = new Uint8Array([0b1111]);
    const packed = packSnapshot(undefined, null, source);
    source[0] = 0;
    const unpacked = unpackSnapshot(snapshotMessage(packed, false));
    expect(unpacked.values[0]).toBe(0b1111);
  });
});
