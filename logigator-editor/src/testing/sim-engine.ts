import { initSync, Simulation } from '@logigator/sim/wasm';
import type { InputWrite } from '@logigator/sim/wasm';
import {
  BoardDescriptor,
  ENGINE_USER_INPUT_TYPE
} from '../app/simulation/compiler/compiled-board.model';
import { ProgressEngine } from '../app/simulation/worker/input-progress';
import { StateEngine } from '../app/simulation/worker/state-reads';

let loaded = false;

/** Instantiates the engine's WASM module from the bytes the setup file read. */
function loadEngine(): void {
  if (loaded) {
    return;
  }
  const bytes = (globalThis as { __LOGIGATOR_SIM_WASM__?: Uint8Array })
    .__LOGIGATOR_SIM_WASM__;
  if (!bytes) {
    throw new Error('The test setup did not load the simulation engine');
  }
  initSync({ module: bytes });
  loaded = true;
}

/**
 * A board of `count` user inputs of `width` outputs each, unit `i`'s output
 * `pin` driving link `i * width + pin`.
 */
export function userInputBoard(count: number, width = 1): BoardDescriptor {
  return {
    components: Array.from({ length: count }, (_, unit) => ({
      type: ENGINE_USER_INPUT_TYPE,
      inputs: [],
      outputs: Array.from({ length: width }, (_, pin) => unit * width + pin)
    }))
  };
}

interface Submission {
  /** The tick count the request was submitted at. */
  tick: number;
  writes: InputWrite[];
}

/**
 * The real simulation engine, ticked by hand, so a spec observes input timing
 * exactly as the worker's engine applies it. Requests go through
 * {@link submit}, which records them so {@link held} can look ahead.
 */
export class SimEngine implements ProgressEngine, StateEngine {
  private sim: Simulation;
  /** The requests submitted since the engine was last built, for replay. */
  private sinceBuild: Submission[] = [];
  /** Input `i`'s unit index, the engine's input numbering. */
  private readonly inputUnits: number[] = [];

  constructor(private readonly descriptor: BoardDescriptor) {
    loadEngine();
    this.sim = new Simulation(descriptor);
    descriptor.components.forEach((unit, index) => {
      if (unit.type === ENGINE_USER_INPUT_TYPE) {
        this.inputUnits.push(index);
      }
    });
  }

  public tick(): number {
    return this.sim.getStatus().tick;
  }

  /** `submitInput`, which throws and queues nothing on an invalid request. */
  public submit(writes: InputWrite[]): void {
    this.sim.submitInput(writes);
    this.sinceBuild.push({ tick: this.tick(), writes });
  }

  /** One tick. */
  public step(): void {
    this.sim.tick();
  }

  /** `count` ticks, one by one. */
  public steps(count: number): void {
    for (let i = 0; i < count; i++) {
      this.sim.tick();
    }
  }

  /** Whether link `id` is powered after the last tick. */
  public link(id: number): boolean {
    return this.sim.link(id);
  }

  /** Whether the link `unit`'s output `pin` drives is powered. */
  public output(unit: number, pin = 0): boolean {
    return this.link(this.descriptor.components[unit].outputs[pin]);
  }

  /** How many event frames input `unit` has not yet applied. */
  public pending(unit: number): number {
    const progress = new Uint32Array(this.inputUnits.length);
    this.sim.inputProgress(progress);
    return progress[this.inputUnits.indexOf(unit)];
  }

  public inputProgress(out: Uint32Array): void {
    this.sim.inputProgress(out);
  }

  public stateVersions(compIds: Uint32Array, out: Uint32Array): void {
    this.sim.stateVersions(compIds, out);
  }

  public readState(compId: number, offset: number, length: number): Uint8Array {
    return this.sim.readState(compId, offset, length);
  }

  /** The whole of `unit`'s state, as `readState` reads it. */
  public state(unit: number): Uint8Array {
    return this.sim.readState(unit, 0, this.sim.stateLength(unit));
  }

  /**
   * What {@link output} reads for `unit`'s output `pin` once every frame
   * submitted so far has been applied and its hold has run out. Answered by
   * replaying the requests on a second engine, so it holds no model of its
   * own.
   */
  public held(unit: number, pin = 0): boolean {
    const replay = new Simulation(this.descriptor);
    try {
      // No frame outlasts its hold plus the tick it waits to be applied.
      let settle = 1;
      for (const { writes } of this.sinceBuild) {
        for (const write of writes) {
          for (const frame of write.frames) {
            settle += frame.hold ?? 1;
          }
        }
      }
      const until = this.tick() + settle;
      for (let tick = 0; tick < until; tick++) {
        for (const submission of this.sinceBuild) {
          if (submission.tick === tick) {
            replay.submitInput(submission.writes);
          }
        }
        replay.tick();
      }
      return replay.link(this.descriptor.components[unit].outputs[pin]);
    } finally {
      replay.destroy();
    }
  }

  /** A fresh engine at tick 0, as the worker builds on init and stop. */
  public reset(): void {
    this.sim.destroy();
    this.sim = new Simulation(this.descriptor);
    this.sinceBuild = [];
  }
}
