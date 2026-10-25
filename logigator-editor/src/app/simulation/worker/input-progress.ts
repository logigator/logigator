import {
  BoardDescriptor,
  ENGINE_USER_INPUT_TYPE
} from '../compiler/compiled-board.model';

/** The engine call the reader polls. */
export interface ProgressEngine {
  inputProgress(out: Uint32Array): void;
}

/**
 * The engine's per-input progress — how many event frames each input has not
 * yet applied — read once per snapshot into buffers kept for the session, so
 * a poll allocates nothing while no count moves. The engine numbers inputs
 * by their order among the descriptor's user-input units; the reader maps
 * that back to unit indices, which is how the main thread addresses inputs.
 */
export class InputProgressReader {
  /** Input `i`'s unit index. */
  private readonly units: Uint32Array;
  private readonly current: Uint32Array;
  /** What the last report said, so an unchanged count is not sent again. */
  private readonly reported: Uint32Array;

  constructor(descriptor: BoardDescriptor) {
    const units: number[] = [];
    descriptor.components.forEach((unit, index) => {
      if (unit.type === ENGINE_USER_INPUT_TYPE) {
        units.push(index);
      }
    });
    this.units = Uint32Array.from(units);
    this.current = new Uint32Array(units.length);
    this.reported = new Uint32Array(units.length);
  }

  /**
   * `[unit, pending]` for every input with an event frame not yet applied,
   * when any input's count moved since the last report — an empty list once
   * the last one ran out — and `undefined` while none moved.
   */
  public read(engine: ProgressEngine): [number, number][] | undefined {
    if (this.units.length === 0) {
      return undefined;
    }
    engine.inputProgress(this.current);
    let moved = false;
    for (let i = 0; i < this.current.length; i++) {
      if (this.current[i] !== this.reported[i]) {
        moved = true;
        break;
      }
    }
    if (!moved) {
      return undefined;
    }
    this.reported.set(this.current);
    const pending: [number, number][] = [];
    for (let i = 0; i < this.current.length; i++) {
      if (this.current[i] > 0) {
        pending.push([this.units[i], this.current[i]]);
      }
    }
    return pending;
  }

  /** Forgets the last report, for an engine rebuilt with nothing queued. */
  public reset(): void {
    this.reported.fill(0);
  }
}
