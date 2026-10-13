import { FrameEngine } from '../app/simulation/worker/input-frames';
import {
  INPUT_EVENT_CONT,
  InputEventKind
} from '../app/simulation/worker/protocol';

/**
 * A {@link FrameEngine} that models how the engine applies input: writes
 * collect between ticks and take effect at the next tick boundary, in order,
 * a `Cont` latching its state and a `Pulse` asserting its unit for that one
 * tick. {@link output} is what the circuit sees after the last tick.
 */
export class FakeFrameEngine implements FrameEngine {
  private _tick = 0;
  private readonly latched = new Map<number, boolean>();
  private pulsed = new Set<number>();
  private pending: [number, InputEventKind, boolean][] = [];
  /** Every write, with the tick it was issued at. */
  public readonly writes: {
    tick: number;
    unit: number;
    event: InputEventKind;
    state: boolean;
  }[] = [];

  public tick(): number {
    return this._tick;
  }

  public write(unit: number, event: InputEventKind, state: boolean): void {
    this.pending.push([unit, event, state]);
    this.writes.push({ tick: this._tick, unit, event, state });
  }

  /** One tick: applies the writes collected since the last. */
  public step(): void {
    this._tick++;
    this.pulsed = new Set();
    for (const [unit, event, state] of this.pending) {
      if (event === INPUT_EVENT_CONT) {
        this.latched.set(unit, state);
      } else if (state) {
        this.pulsed.add(unit);
      }
    }
    this.pending = [];
  }

  /** Whether `unit` drives its output high after the last tick. */
  public output(unit: number): boolean {
    return (this.latched.get(unit) ?? false) || this.pulsed.has(unit);
  }

  /**
   * The level `unit` latches once the writes issued so far apply: its last
   * `Cont` state, `false` without one.
   */
  public held(unit: number): boolean {
    let level = this.latched.get(unit) ?? false;
    for (const [written, event, state] of this.pending) {
      if (written === unit && event === INPUT_EVENT_CONT) {
        level = state;
      }
    }
    return level;
  }

  /** Back to tick 0 with every unit low, as a rebuilt engine is. */
  public reset(): void {
    this._tick = 0;
    this.latched.clear();
    this.pulsed = new Set();
    this.pending = [];
  }
}
