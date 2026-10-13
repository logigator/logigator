import { InputEventKind, UnitFrame, UnitWrite } from './protocol';

/**
 * The engine surface the frame queues drive, so they run against a fake in
 * specs and against the WASM engine in the worker.
 */
export interface FrameEngine {
  /** The tick the engine is at. */
  tick(): number;
  /** One write, which the engine applies at its next tick boundary. */
  write(unit: number, event: InputEventKind, state: boolean): void;
}

interface FrameQueue {
  /** Frames not yet applied, oldest first. */
  readonly frames: UnitFrame[];
  /** The tick the last frame was applied at; `-1` before any. */
  lastTick: number;
  /** The kind of the last frame applied, `null` before any. */
  lastKind: UnitFrame['kind'] | null;
}

/**
 * One FIFO of input frames per input, keyed by the input's first unit, so
 * one input never waits on another.
 *
 * {@link pump} applies a queue's head frame — every write of it in one
 * synchronous run, so no tick falls between them — once the engine has
 * ticked since the queue last applied one. That keeps every frame on the
 * outputs for at least one tick before the next. The one exception is a
 * `state` frame following a `state` frame: it applies at the same tick
 * boundary, where its writes land on top of the earlier ones, so a setting
 * changed twice between ticks reaches the engine as its final value.
 *
 * A `state` frame merges into the queue's last frame when that one is also a
 * `state` frame: the later write per unit wins, and two pulses on one unit
 * stay one. Only unapplied frames are queued, so a merge never reaches an
 * applied frame, nor past a queued `event` frame.
 */
export class InputFrameQueues {
  private readonly queues = new Map<number, FrameQueue>();

  constructor(private readonly engine: FrameEngine) {}

  /** Whether any queue holds a frame not yet applied. */
  public get pending(): boolean {
    for (const queue of this.queues.values()) {
      if (queue.frames.length > 0) {
        return true;
      }
    }
    return false;
  }

  /** Appends frames to a queue, merging as described, then pumps it. */
  public enqueue(key: number, frames: readonly UnitFrame[]): void {
    let queue = this.queues.get(key);
    if (!queue) {
      queue = { frames: [], lastTick: -1, lastKind: null };
      this.queues.set(key, queue);
    }
    for (const frame of frames) {
      if (frame.units.length === 0) {
        continue;
      }
      const last = queue.frames.at(-1);
      if (frame.kind === 'state' && last?.kind === 'state') {
        queue.frames[queue.frames.length - 1] = mergeStateFrames(last, frame);
      } else {
        queue.frames.push({ ...frame, units: [...frame.units] });
      }
    }
    this._pumpQueue(queue, this.engine.tick());
  }

  /**
   * Drops a queue's frames and applies `reset` at once. A reset that writes
   * anything counts as an applied `state` frame, so an `event` frame queued
   * after it waits a tick.
   */
  public clear(key: number, reset: readonly UnitWrite[]): void {
    const queue = this.queues.get(key);
    if (queue) {
      queue.frames.length = 0;
    }
    if (reset.length === 0) {
      return;
    }
    for (const [unit, event, state] of reset) {
      this.engine.write(unit, event, state);
    }
    this.queues.set(key, {
      frames: [],
      lastTick: this.engine.tick(),
      lastKind: 'state'
    });
  }

  /** Forgets every queue, for an engine that is rebuilt. */
  public dropAll(): void {
    this.queues.clear();
  }

  /** Applies each queue's head frame where its tick rule allows. */
  public pump(): void {
    if (!this.pending) {
      return;
    }
    const tick = this.engine.tick();
    for (const queue of this.queues.values()) {
      this._pumpQueue(queue, tick);
    }
  }

  /** `[queue, counted frames not yet applied]` for every queue holding one. */
  public countedRemaining(): [number, number][] {
    const counts: [number, number][] = [];
    for (const [key, queue] of this.queues) {
      let counted = 0;
      for (const frame of queue.frames) {
        if (frame.counted) {
          counted++;
        }
      }
      if (counted > 0) {
        counts.push([key, counted]);
      }
    }
    return counts;
  }

  private _pumpQueue(queue: FrameQueue, tick: number): void {
    const head = queue.frames[0];
    if (
      !head ||
      (tick <= queue.lastTick &&
        !(head.kind === 'state' && queue.lastKind === 'state'))
    ) {
      return;
    }
    queue.frames.shift();
    for (const [unit, event, state] of head.units) {
      this.engine.write(unit, event, state);
    }
    queue.lastTick = tick;
    queue.lastKind = head.kind;
  }
}

/** `later`'s writes over `earlier`'s, one write per unit. */
function mergeStateFrames(earlier: UnitFrame, later: UnitFrame): UnitFrame {
  const units = [...earlier.units];
  for (const write of later.units) {
    const at = units.findIndex(([unit]) => unit === write[0]);
    if (at >= 0) {
      units[at] = write;
    } else {
      units.push(write);
    }
  }
  return {
    kind: 'state',
    units,
    counted: earlier.counted || later.counted
  };
}
