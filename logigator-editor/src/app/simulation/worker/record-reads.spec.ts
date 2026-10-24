import { describe, expect, it, vi } from 'vitest';
import { SimEngine } from '../../../testing/sim-engine';
import {
  byteFrames,
  byteTicks,
  RECORDER_UNIT,
  recorderBoard
} from '../../../testing/recorder-writes';
import { RecordRead } from './protocol';
import { RecordEngine, RecordReader } from './record-reads';

function write(engine: SimEngine, codes: readonly number[]): void {
  engine.submit([{ comp: 0, frames: byteFrames(codes) }]);
  engine.steps(byteTicks(codes.length));
}

/** The reads' records as `[first, values]`, values as plain numbers. */
const recordsOf = (reads: RecordRead[] | undefined) =>
  (reads ?? []).map(({ id, first, values }) => [id, first, [...values]]);

describe('RecordReader', () => {
  it('reads every record exactly once, in order, across many snapshots', () => {
    const engine = new SimEngine(recorderBoard(64));
    const reader = new RecordReader();
    reader.watch({ id: 1, unit: RECORDER_UNIT, since: 0 });
    const codes = Array.from({ length: 40 }, (_, i) => (i * 37 + 11) & 0xff);
    const seen: number[] = [];
    let next = 0;

    // Reads land between ticks at every phase of a byte, mid-write included.
    for (let tick = 0; tick < byteTicks(codes.length) + 2; tick++) {
      if (tick % 6 === 0) {
        engine.submit([
          { comp: 0, frames: byteFrames(codes.slice(tick / 2, tick / 2 + 3)) }
        ]);
      }
      engine.step();
      for (const { first, values } of reader.read(engine) ?? []) {
        expect(first).toBe(next);
        seen.push(...values);
        next = first + values.length;
      }
    }
    expect(seen).toEqual(codes);
  });

  it('reads nothing while the record count stands still', () => {
    const engine = new SimEngine(recorderBoard(16));
    write(engine, [0x41, 0x42]);
    const reader = new RecordReader();
    reader.watch({ id: 1, unit: RECORDER_UNIT, since: 0 });
    expect(recordsOf(reader.read(engine))).toEqual([[1, 0, [0x41, 0x42]]]);

    const readRecords = vi.spyOn(engine, 'readRecords');
    // The trigger stays low and the data moves: no edge, no record.
    engine.submit([
      { comp: 0, frames: [{ state: [true, ...new Array(8).fill(false)] }] }
    ]);
    engine.steps(5);
    expect(reader.read(engine)).toBeUndefined();
    expect(reader.read(engine)).toBeUndefined();
    expect(readRecords).not.toHaveBeenCalled();

    write(engine, [0x43]);
    expect(recordsOf(reader.read(engine))).toEqual([[1, 2, [0x43]]]);
    expect(readRecords).toHaveBeenCalledTimes(1);
  });

  it('reports the records overwritten between two reads as a first past since', () => {
    const engine = new SimEngine(recorderBoard(4));
    const reader = new RecordReader();
    reader.watch({ id: 1, unit: RECORDER_UNIT, since: 0 });
    write(engine, [1, 2]);
    expect(recordsOf(reader.read(engine))).toEqual([[1, 0, [1, 2]]]);

    write(engine, [3, 4, 5, 6, 7, 8, 9, 10]);
    // Records 2…5 were overwritten before this read: first is 6, not 2.
    expect(recordsOf(reader.read(engine))).toEqual([[1, 6, [7, 8, 9, 10]]]);
    write(engine, [11]);
    expect(recordsOf(reader.read(engine))).toEqual([[1, 10, [11]]]);
  });

  it('starts a watch at its own record, and two watches of one unit apart', () => {
    const engine = new SimEngine(recorderBoard(16));
    write(engine, [5, 6, 7]);
    const reader = new RecordReader();
    reader.watch({ id: 1, unit: RECORDER_UNIT, since: 0 });
    reader.watch({ id: 2, unit: RECORDER_UNIT, since: 2 });
    expect(recordsOf(reader.read(engine))).toEqual([
      [1, 0, [5, 6, 7]],
      [2, 2, [7]]
    ]);

    // Restarted from 0, it reads what the engine still holds again.
    reader.watch({ id: 2, unit: RECORDER_UNIT, since: 0 });
    expect(recordsOf(reader.read(engine))).toEqual([[2, 0, [5, 6, 7]]]);
  });

  it('never reads past the record count, for a watch started beyond it', () => {
    const engine = new SimEngine(recorderBoard(16));
    write(engine, [5, 6]);
    const reader = new RecordReader();
    reader.watch({ id: 1, unit: RECORDER_UNIT, since: 9 });
    expect(reader.read(engine)).toBeUndefined();

    write(engine, [7]);
    expect(recordsOf(reader.read(engine))).toEqual([[1, 2, [7]]]);
  });

  it('reads a rebuilt engine from its first record again', () => {
    const engine = new SimEngine(recorderBoard(16));
    const reader = new RecordReader();
    reader.watch({ id: 1, unit: RECORDER_UNIT, since: 0 });
    write(engine, [1, 2, 3]);
    reader.read(engine);

    engine.reset();
    reader.reset();
    expect(reader.read(engine)).toBeUndefined();

    write(engine, [4, 5]);
    expect(recordsOf(reader.read(engine))).toEqual([[1, 0, [4, 5]]]);
  });

  it('calls the engine for nothing while nothing is watched', () => {
    const engine: RecordEngine = {
      stateVersions: vi.fn(),
      readRecords: vi.fn()
    };
    const reader = new RecordReader();
    expect(reader.read(engine)).toBeUndefined();

    reader.watch({ id: 1, unit: RECORDER_UNIT, since: 0 });
    reader.unwatch(1);
    expect(reader.read(engine)).toBeUndefined();
    expect(engine.stateVersions).not.toHaveBeenCalled();
    expect(engine.readRecords).not.toHaveBeenCalled();
  });
});
