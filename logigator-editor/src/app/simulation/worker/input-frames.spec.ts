import { beforeEach, describe, expect, it } from 'vitest';
import { FakeFrameEngine } from '../../../testing/fake-frame-engine';
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
  let engine: FakeFrameEngine;
  let queues: InputFrameQueues;

  beforeEach(() => {
    engine = new FakeFrameEngine();
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
    expect([0, 1, 2].map((unit) => engine.output(unit))).toEqual([
      true,
      true,
      true
    ]);
  });

  it('keeps each event frame on the outputs for a tick, one frame per step', () => {
    queues.enqueue(0, [
      event([cont(0, true)]),
      event([cont(0, false)]),
      event([cont(0, true)])
    ]);

    const seen: boolean[] = [];
    for (let tick = 0; tick < 4; tick++) {
      step();
      seen.push(engine.output(0));
    }

    expect(seen).toEqual([true, false, true, true]);
    expect(engine.writes.map((write) => write.tick)).toEqual([0, 1, 2]);
  });

  it('lets one queue apply while another waits', () => {
    queues.enqueue(0, [event([cont(0, true)]), event([cont(0, false)])]);
    queues.enqueue(8, [event([cont(8, true)])]);

    expect(issued()).toEqual([
      [0, 0, INPUT_EVENT_CONT, true],
      [0, 8, INPUT_EVENT_CONT, true]
    ]);
  });

  it('applies a frame for an empty queue on arrival, once a tick has passed since its last', () => {
    queues.enqueue(0, [event([pulse(0)])]);
    step();
    queues.enqueue(0, [event([pulse(0)])]);

    expect(engine.writes.map((write) => write.tick)).toEqual([0, 1]);
  });

  it('turns two pulse frames between ticks into pulses on consecutive ticks', () => {
    queues.enqueue(0, [event([pulse(0)])]);
    queues.enqueue(0, [event([pulse(0)])]);

    const seen: boolean[] = [];
    for (let tick = 0; tick < 3; tick++) {
      step();
      seen.push(engine.output(0));
    }

    expect(seen).toEqual([true, true, false]);
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

  it('holds an event frame after a reset for a tick, so the reset shows', () => {
    queues.clear(0, [cont(0, false)]);
    queues.enqueue(0, [event([cont(0, true)])]);

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

    // The first applied on arrival.
    expect(queues.countedRemaining()).toEqual([[0, 1]]);
    step();
    step();
    expect(queues.countedRemaining()).toEqual([]);
    expect(queues.pending).toBe(true);
  });

  describe('merging', () => {
    /** Blocks queue 0 behind an applied event frame for the current tick. */
    function occupy(): void {
      queues.enqueue(0, [event([cont(5, true)])]);
    }

    it('merges a state frame into an unapplied state frame, the later write per unit winning', () => {
      occupy();
      queues.enqueue(0, [state([cont(0, true), cont(1, true)])]);
      queues.enqueue(0, [state([cont(1, false), cont(2, true)])]);

      step();

      expect(issued().slice(1)).toEqual([
        [1, 0, INPUT_EVENT_CONT, true],
        [1, 1, INPUT_EVENT_CONT, false],
        [1, 2, INPUT_EVENT_CONT, true]
      ]);
      expect(queues.pending).toBe(false);
    });

    it('keeps two merged pulse writes on one unit as one pulse', () => {
      occupy();
      queues.enqueue(0, [state([pulse(0)])]);
      queues.enqueue(0, [state([pulse(0)])]);

      step();
      expect(engine.output(0)).toBe(false);
      step();
      expect(engine.output(0)).toBe(true);
      step();
      expect(engine.output(0)).toBe(false);
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
      for (let tick = 0; tick < 4; tick++) {
        step();
        seen.push(engine.output(0));
      }

      expect(seen).toEqual([false, true, false, true]);
    });

    it('never merges into an applied event frame: a state frame after one waits a tick', () => {
      queues.enqueue(0, [event([cont(0, true)])]);
      queues.enqueue(0, [state([cont(0, false)])]);

      step();
      expect(engine.output(0)).toBe(true);
      step();
      expect(engine.output(0)).toBe(false);
    });

    it('lands a state frame after an applied state frame on the same tick, so the tick sees the final state', () => {
      queues.enqueue(0, [state([cont(0, true)])]);
      queues.enqueue(0, [state([cont(0, false)])]);
      queues.enqueue(0, [state([cont(0, true)])]);

      // The earlier writes are issued, not rewritten: the engine applies
      // all three at the one boundary.
      expect(engine.writes.map((write) => write.tick)).toEqual([0, 0, 0]);
      step();
      expect(engine.output(0)).toBe(true);
      expect(queues.pending).toBe(false);
    });
  });
});
