import { initSync, InputEvent, Simulation } from '@logigator/sim/wasm';
import { BoardDescriptor } from '../app/simulation/compiler/compiled-board.model';
import { FrameEngine } from '../app/simulation/worker/input-frames';
import { InputEventKind } from '../app/simulation/worker/protocol';

/** Ticks after which every write issued so far has reached the outputs. */
const SETTLE_TICKS = 3;

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

/** A board of `count` single-output user inputs, unit `i` driving link `i`. */
export function userInputBoard(count: number): BoardDescriptor {
  return {
    links: count,
    components: Array.from({ length: count }, (_, unit) => ({
      type: 200,
      inputs: [],
      outputs: [unit]
    }))
  };
}

interface IssuedWrite {
  tick: number;
  unit: number;
  event: InputEventKind;
  state: boolean;
}

/**
 * The real simulation engine as a {@link FrameEngine}, ticked by hand, so a
 * spec observes input timing exactly as the worker's engine applies it.
 */
export class SimEngine implements FrameEngine {
  private sim: Simulation;
  /** Every write, with the tick it was issued at. */
  public readonly writes: IssuedWrite[] = [];
  /** The writes issued since the engine was last built, for replay. */
  private sinceBuild: IssuedWrite[] = [];

  constructor(private readonly descriptor: BoardDescriptor) {
    loadEngine();
    this.sim = new Simulation(descriptor);
  }

  public tick(): number {
    return this.sim.getStatus().tick;
  }

  public write(unit: number, event: InputEventKind, state: boolean): void {
    this.sim.triggerInput(unit, event as InputEvent, [state]);
    const write = { tick: this.tick(), unit, event, state };
    this.writes.push(write);
    this.sinceBuild.push(write);
  }

  /** One tick. */
  public step(): void {
    this.sim.tick();
  }

  /** Whether link `id` is powered after the last tick. */
  public link(id: number): boolean {
    return this.sim.link(id);
  }

  /** Whether the link `unit`'s first output drives is powered. */
  public output(unit: number): boolean {
    return this.link(this.descriptor.components[unit].outputs[0]);
  }

  /**
   * What {@link output} reads for `unit` once every write issued so far has
   * reached the outputs and any pulse among them has passed. Answered by
   * replaying the writes on a second engine, so it holds no model of its own.
   */
  public held(unit: number): boolean {
    const replay = new Simulation(this.descriptor);
    try {
      const now = this.tick();
      for (let tick = 0; tick <= now + SETTLE_TICKS; tick++) {
        for (const write of this.sinceBuild) {
          if (write.tick === tick) {
            replay.triggerInput(write.unit, write.event as InputEvent, [
              write.state
            ]);
          }
        }
        replay.tick();
      }
      return replay.link(this.descriptor.components[unit].outputs[0]);
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
