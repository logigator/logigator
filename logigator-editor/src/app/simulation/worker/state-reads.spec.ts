import { describe, expect, it, vi } from 'vitest';
import { BuiltInComponentType } from '@logigator/core';
import { SimEngine } from '../../../testing/sim-engine';
import { ramWriteFrames, ramWriteTicks } from '../../../testing/ram-writes';
import { packedByteLength, readWord } from '../../utils/packed-buffer';
import {
  BoardDescriptor,
  ENGINE_USER_INPUT_TYPE
} from '../compiler/compiled-board.model';
import { StateEngine, StateReader } from './state-reads';

const ADDRESS_SIZE = 4;
const WORD_SIZE = 7;
const RAM_UNIT = 1;
const RAM_BYTES = packedByteLength(1 << ADDRESS_SIZE, WORD_SIZE);

/** A user input whose outputs drive every input of a RAM, unit 1. */
function ramBoard(): BoardDescriptor {
  const inputs = ADDRESS_SIZE + WORD_SIZE + 2;
  return {
    links: inputs + WORD_SIZE,
    components: [
      {
        type: ENGINE_USER_INPUT_TYPE,
        inputs: [],
        outputs: Array.from({ length: inputs }, (_, pin) => pin)
      },
      {
        type: BuiltInComponentType.RAM,
        inputs: Array.from({ length: inputs }, (_, pin) => pin),
        outputs: Array.from({ length: WORD_SIZE }, (_, pin) => inputs + pin)
      }
    ]
  };
}

function store(engine: SimEngine, address: number, value: bigint): void {
  engine.submit([
    {
      comp: 0,
      frames: ramWriteFrames(ADDRESS_SIZE, WORD_SIZE, [{ address, value }])
    }
  ]);
  engine.steps(ramWriteTicks(1));
}

/** The words a read covers in full, by address. */
function wordsOf(offset: number, bytes: Uint8Array): Map<number, bigint> {
  const memory = new Uint8Array(RAM_BYTES);
  memory.set(bytes, offset);
  const words = new Map<number, bigint>();
  for (let address = 0; address < 1 << ADDRESS_SIZE; address++) {
    const first = Math.floor((address * WORD_SIZE) / 8);
    const last = Math.floor(((address + 1) * WORD_SIZE - 1) / 8);
    if (first >= offset && last < offset + bytes.length) {
      words.set(address, readWord(memory, address, WORD_SIZE));
    }
  }
  return words;
}

describe('StateReader', () => {
  it('reads a watched range once, then only after a write changed it', () => {
    const engine = new SimEngine(ramBoard());
    const reader = new StateReader();
    reader.watch({ id: 1, unit: RAM_UNIT, offset: 0, length: RAM_BYTES });

    expect(reader.read(engine)).toEqual([
      { id: 1, offset: 0, bytes: new Uint8Array(RAM_BYTES) }
    ]);
    expect(reader.read(engine)).toBeUndefined();

    store(engine, 5, 0x5an);
    const [read] = reader.read(engine)!;
    expect(wordsOf(read.offset, read.bytes).get(5)).toBe(0x5an);
    expect(reader.read(engine)).toBeUndefined();

    // The same word again changes no stored bit.
    store(engine, 5, 0x5an);
    expect(reader.read(engine)).toBeUndefined();
  });

  it('reads a moved range at once, with no write in between', () => {
    const engine = new SimEngine(ramBoard());
    store(engine, 9, 0x41n);
    const reader = new StateReader();
    reader.watch({ id: 1, unit: RAM_UNIT, offset: 0, length: 3 });
    reader.read(engine);

    // Bytes 6..8 hold bits 48..71, from inside word 6 to inside word 10.
    reader.watch({ id: 1, unit: RAM_UNIT, offset: 6, length: 3 });
    const [read] = reader.read(engine)!;
    expect(read.offset).toBe(6);
    expect(wordsOf(read.offset, read.bytes)).toEqual(
      new Map([
        [7, 0n],
        [8, 0n],
        [9, 0x41n]
      ])
    );
    expect(reader.read(engine)).toBeUndefined();
  });

  it('reads each watch of one unit by its own range', () => {
    const engine = new SimEngine(ramBoard());
    const reader = new StateReader();
    reader.watch({ id: 1, unit: RAM_UNIT, offset: 0, length: 2 });
    reader.watch({ id: 2, unit: RAM_UNIT, offset: 10, length: 4 });
    reader.read(engine);

    store(engine, 15, 0x7fn);
    const reads = reader.read(engine)!;
    expect(
      reads.map(({ id, offset, bytes }) => [id, offset, bytes.length])
    ).toEqual([
      [1, 0, 2],
      [2, 10, 4]
    ]);
    expect(wordsOf(reads[1].offset, reads[1].bytes).get(15)).toBe(0x7fn);
  });

  it('sends nothing for a rebuilt engine until its RAM is written', () => {
    const engine = new SimEngine(ramBoard());
    const reader = new StateReader();
    reader.watch({ id: 1, unit: RAM_UNIT, offset: 0, length: RAM_BYTES });
    store(engine, 2, 0x11n);
    reader.read(engine);

    engine.reset();
    reader.reset();
    expect(reader.read(engine)).toBeUndefined();

    store(engine, 3, 0x22n);
    const [read] = reader.read(engine)!;
    expect(wordsOf(read.offset, read.bytes)).toEqual(
      new Map(
        Array.from({ length: 16 }, (_, address) => [
          address,
          address === 3 ? 0x22n : 0n
        ])
      )
    );
  });

  it('calls the engine for nothing while nothing is watched', () => {
    const engine: StateEngine = {
      stateVersions: vi.fn(),
      readState: vi.fn()
    };
    const reader = new StateReader();
    expect(reader.read(engine)).toBeUndefined();

    reader.watch({ id: 1, unit: RAM_UNIT, offset: 0, length: 1 });
    reader.unwatch(1);
    expect(reader.read(engine)).toBeUndefined();
    expect(engine.stateVersions).not.toHaveBeenCalled();
    expect(engine.readState).not.toHaveBeenCalled();
  });
});
