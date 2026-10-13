import { beforeEach, describe, expect, it } from 'vitest';
import { SimEngine, userInputBoard } from '../../../testing/sim-engine';
import { InputFrameQueues } from './input-frames';
import {
  INPUT_EVENT_CONT,
  INPUT_EVENT_PULSE,
  UnitFrame,
  UnitWrite
} from './protocol';

const cont = (unit: number, state: boolean): UnitWrite => [
  unit,
  INPUT_EVENT_CONT,
  state
];
const pulse = (unit: number): UnitWrite => [unit, INPUT_EVENT_PULSE, true];

const event = (units: UnitWrite[], counted = false): UnitFrame => ({
  kind: 'event',
  units,
  counted
});
const state = (units: UnitWrite[]): UnitFrame => ({
  kind: 'state',
  units,
  counted: false
});

describe('InputFrameQueues', () => {
  let engine: SimEngine;
  let queues: InputFrameQueues;

  beforeEach(() => {
    engine = new SimEngine(userInputBoard(9));
    queues = new InputFrameQueues(engine);
  });

  /** One tick, then the pump that follows a step. */
  function step(): void {
    engine.step();
    queues.pump();
  }

  /** The writes issued, as `[tick, unit, event, state]`. */
  const issued = () =>
    engine.writes.map(({ tick, unit, event, state }) => [
      tick,
      unit,
      event,
      state
    ]);

  it('applies every write of a frame at one tick boundary', () => {
    queues.enqueue(0, [
      event([cont(0, true), cont(1, true), pulse(2)]),
      event([cont(0, false), cont(1, false)])
    ]);

    expect(issued()).toEqual([
      [0, 0, INPUT_EVENT_CONT, true],
      [0, 1, INPUT_EVENT_CONT, true],
      [0, 2, INPUT_EVENT_PULSE, true]
    ]);
    step();
    step();
    expect([0, 1, 2].map((unit) => engine.output(unit))).toEqual([
      true,
      true,
      true
    ]);
  });

  it('puts every event frame on the outputs before the next replaces it', () => {
    queues.enqueue(0, [
      event([cont(0, true)]),
      event([cont(0, false)]),
      event([cont(0, true)])
    ]);

    const seen: boolean[] = [];
    for (let tick = 0; tick < 7; tick++) {
      step();
      seen.push(engine.output(0));
    }

    expect(seen).toEqual([false, true, true, false, false, true, true]);
    expect(engine.writes.map((write) => write.tick)).toEqual([0, 2, 4]);
  });

  describe('a typed text', () => {
    const DATA_BITS = 7;
    const STROBE = 7;

    const press = (code: number): UnitFrame =>
      event(
        [
          ...Array.from({ length: DATA_BITS }, (_, bit) =>
            cont(bit, ((code >> bit) & 1) === 1)
          ),
          pulse(STROBE)
        ],
        true
      );
    const release = (): UnitFrame =>
      event(Array.from({ length: DATA_BITS }, (_, bit) => cont(bit, false)));

    /** A seeded generator, so a failing run can be replayed. */
    function random(seed: number): () => number {
      let state = seed;
      return () => {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        return state / 0x80000000;
      };
    }

    /**
     * Types `text` through one queue, pumping after `ticksPerPump()` ticks
     * each time, and reads the code on the data units at every strobe.
     */
    function typed(text: string, ticksPerPump: () => number): string {
      queues.enqueue(
        0,
        [...text].flatMap((char) => [press(char.charCodeAt(0)), release()])
      );
      let received = '';
      for (let pumps = 0; queues.pending || pumps < 4; pumps++) {
        for (let tick = ticksPerPump(); tick > 0; tick--) {
          engine.step();
          if (engine.output(STROBE)) {
            let code = 0;
            for (let bit = 0; bit < DATA_BITS; bit++) {
              code |= (engine.output(bit) ? 1 : 0) << bit;
            }
            received += String.fromCharCode(code);
          }
        }
        queues.pump();
      }
      return received;
    }

    it('reaches the circuit intact when the queue is pumped every tick', () => {
      expect(typed('hello world', () => 1)).toBe('hello world');
    });

    it('reaches the circuit intact however many ticks pass between pumps', () => {
      const next = random(11);
      for (let run = 0; run < 50; run++) {
        engine.reset();
        queues.dropAll();
        expect(typed('hello world', () => 1 + Math.floor(next() * 4))).toBe(
          'hello world'
        );
      }
    });
  });

  it('lets one queue apply while another waits', () => {
    queues.enqueue(0, [event([cont(0, true)]), event([cont(0, false)])]);
    queues.enqueue(8, [event([cont(8, true)])]);

    expect(issued()).toEqual([
      [0, 0, INPUT_EVENT_CONT, true],
      [0, 8, INPUT_EVENT_CONT, true]
    ]);
  });

  it('applies a frame for an empty queue on arrival, once its last has had two ticks', () => {
    queues.enqueue(0, [event([pulse(0)])]);
    step();
    queues.enqueue(0, [event([pulse(0)])]);
    expect(engine.writes.map((write) => write.tick)).toEqual([0]);

    step();
    expect(engine.writes.map((write) => write.tick)).toEqual([0, 2]);
  });

  it('turns two pulse frames between ticks into two pulses', () => {
    queues.enqueue(0, [event([pulse(0)])]);
    queues.enqueue(0, [event([pulse(0)])]);

    const seen: boolean[] = [];
    for (let tick = 0; tick < 5; tick++) {
      step();
      seen.push(engine.output(0));
    }

    expect(seen).toEqual([false, true, false, true, false]);
  });

  it('drops a queue on clear and applies the reset at once', () => {
    queues.enqueue(0, [
      event([cont(0, true), cont(1, true)], true),
      event([cont(0, false), cont(1, false)]),
      event([cont(0, true)], true)
    ]);

    queues.clear(0, [cont(0, false), cont(1, false)]);
    step();
    step();

    expect(queues.pending).toBe(false);
    expect([engine.output(0), engine.output(1)]).toEqual([false, false]);
    expect(queues.countedRemaining()).toEqual([]);
  });

  it('holds an event frame after a reset until the reset shows', () => {
    queues.clear(0, [cont(0, false)]);
    queues.enqueue(0, [event([cont(0, true)])]);

    step();
    expect(engine.writes.map((write) => write.state)).toEqual([false]);
    step();
    expect(engine.writes.map((write) => write.state)).toEqual([false, true]);
  });

  it('forgets every queue on dropAll, so a rebuilt engine at tick 0 takes frames at once', () => {
    queues.enqueue(0, [event([cont(0, true)])]);
    step();
    step();
    queues.enqueue(0, [event([cont(0, false)]), event([cont(0, true)])]);
    queues.enqueue(4, [event([cont(4, true)]), event([cont(4, false)])]);

    engine.reset();
    queues.dropAll();
    engine.writes.length = 0;
    queues.enqueue(0, [event([cont(0, true)])]);

    expect(queues.pending).toBe(false);
    expect(issued()).toEqual([[0, 0, INPUT_EVENT_CONT, true]]);
  });

  it('counts the counted frames each queue has left', () => {
    queues.enqueue(0, [
      event([cont(0, true)], true),
      event([cont(0, false)]),
      event([cont(0, true)], true),
      event([cont(0, false)])
    ]);
    queues.enqueue(8, [event([cont(8, true)]), event([cont(8, false)])]);

    // The first applied on arrival, the second two ticks later.
    expect(queues.countedRemaining()).toEqual([[0, 1]]);
    for (let tick = 0; tick < 4; tick++) {
      step();
    }
    expect(queues.countedRemaining()).toEqual([]);
    expect(queues.pending).toBe(true);
  });

  describe('merging', () => {
    /** Blocks queue 0 behind an event frame applied at the current tick. */
    function occupy(): void {
      queues.enqueue(0, [event([cont(5, true)])]);
    }

    it('merges a state frame into an unapplied state frame, the later write per unit winning', () => {
      occupy();
      queues.enqueue(0, [state([cont(0, true), cont(1, true)])]);
      queues.enqueue(0, [state([cont(1, false), cont(2, true)])]);

      step();
      step();

      expect(issued().slice(1)).toEqual([
        [2, 0, INPUT_EVENT_CONT, true],
        [2, 1, INPUT_EVENT_CONT, false],
        [2, 2, INPUT_EVENT_CONT, true]
      ]);
      expect(queues.pending).toBe(false);
    });

    it('keeps two merged pulse writes on one unit as one pulse', () => {
      occupy();
      queues.enqueue(0, [state([pulse(0)])]);
      queues.enqueue(0, [state([pulse(0)])]);

      const seen: boolean[] = [];
      for (let tick = 0; tick < 6; tick++) {
        step();
        seen.push(engine.output(0));
      }

      expect(seen).toEqual([false, false, false, true, false, false]);
      expect(
        engine.writes.filter((write) => write.event === INPUT_EVENT_PULSE)
      ).toHaveLength(1);
    });

    it('never merges past a queued event frame', () => {
      occupy();
      queues.enqueue(0, [state([cont(0, true)])]);
      queues.enqueue(0, [event([cont(0, false)])]);
      queues.enqueue(0, [state([cont(0, true)])]);

      const seen: boolean[] = [];
      for (let tick = 0; tick < 8; tick++) {
        step();
        seen.push(engine.output(0));
      }

      expect(seen).toEqual([
        false,
        false,
        false,
        true,
        true,
        false,
        false,
        true
      ]);
    });

    it('never merges into an applied event frame: a state frame after one waits until it shows', () => {
      queues.enqueue(0, [event([cont(0, true)])]);
      queues.enqueue(0, [state([cont(0, false)])]);

      const seen: boolean[] = [];
      for (let tick = 0; tick < 4; tick++) {
        step();
        seen.push(engine.output(0));
      }

      expect(seen).toEqual([false, true, true, false]);
    });

    it('lands a state frame after an applied state frame on the same tick, so the tick sees the final state', () => {
      queues.enqueue(0, [state([cont(0, true)])]);
      queues.enqueue(0, [state([cont(0, false)])]);
      queues.enqueue(0, [state([cont(0, true)])]);

      // The earlier writes are issued, not rewritten: the engine applies
      // all three at the one boundary.
      expect(engine.writes.map((write) => write.tick)).toEqual([0, 0, 0]);
      step();
      step();
      expect(engine.output(0)).toBe(true);
      expect(queues.pending).toBe(false);
    });
  });
});
