import init, { Simulation } from '@logigator/sim/wasm';
import type { InputEvent } from '@logigator/sim/wasm';
import { BoardDescriptor } from '../compiler/compiled-board.model';
import {
  nextPaceDelayMs,
  PACE_BATCH_MS,
  PACE_INTERVAL_MS,
  ticksDue
} from './pacing';
import {
  MainToWorkerMessage,
  packSnapshot,
  WorkerToMainMessage
} from './protocol';
import wasmUrl from '@logigator/sim/wasm/sim_wasm_bg.wasm';

const postMessage = self.postMessage as (
  message: WorkerToMainMessage,
  transfer?: Transferable[]
) => void;

const addEventListener = self.addEventListener as (
  type: 'message',
  listener: (event: MessageEvent<MainToWorkerMessage>) => void
) => void;

/** Changed-link fraction above which the engine falls back to a full snapshot. */
const DELTA_THRESHOLD = 0.2;

const BUFFER_POOL_LIMIT = 4;

let memory: WebAssembly.Memory | null = null;
let sim: Simulation | null = null;
let descriptor: BoardDescriptor | null = null;

let runMode: 'idle' | 'continuous' | 'target' = 'idle';
/** In-flight `runAsync` promise while in continuous mode. */
let runPromise: Promise<void> | null = null;
let paceTimer: ReturnType<typeof setTimeout> | null = null;
let paceHz = 0;
let paceStart = { tick: 0, time: 0 };

const bufferPool: ArrayBuffer[] = [];

// The emitted artifact path is relative to the build output root, where the
// worker chunk also lives — resolving against the script URL covers any
// base href.
void init({
  module_or_path: new URL(wasmUrl, self.location.href)
})
  .then((output) => {
    memory = output.memory;
    postMessage({ kind: 'ready' });
  })
  .catch((err: unknown) => {
    postMessage({
      kind: 'error',
      reqId: null,
      code: 'engineInitFailed',
      message: `Failed to initialize the simulation engine: ${String(err)}`
    });
  });

addEventListener('message', (event) => {
  const msg = event.data;
  handle(msg).catch((err: unknown) => {
    postMessage({
      kind: 'error',
      reqId: 'reqId' in msg ? msg.reqId : null,
      message: String(err)
    });
  });
});

async function handle(msg: MainToWorkerMessage): Promise<void> {
  switch (msg.kind) {
    case 'init':
      descriptor = msg.descriptor;
      sim?.destroy();
      sim = new Simulation(descriptor);
      postMessage({ kind: 'ok', reqId: msg.reqId });
      break;
    case 'start': {
      await stopRun();
      const simulation = requireSim();
      if (msg.config.mode === 'continuous') {
        runMode = 'continuous';
        runPromise = simulation.runAsync().catch((err: unknown) => {
          postMessage({ kind: 'error', reqId: null, message: String(err) });
        });
      } else {
        runMode = 'target';
        paceHz = Math.max(1, msg.config.hz);
        paceStart = {
          tick: simulation.getStatus().tick,
          time: performance.now()
        };
        paceTimer = setTimeout(paceLoop, PACE_INTERVAL_MS);
      }
      postMessage({ kind: 'ok', reqId: msg.reqId });
      break;
    }
    case 'pause':
      await stopRun();
      postMessage({ kind: 'ok', reqId: msg.reqId });
      break;
    case 'step':
      requireSim().tick();
      postMessage({ kind: 'ok', reqId: msg.reqId });
      break;
    case 'stop': {
      // The engine has no reset: stopping for good = destroy and rebuild
      // from the kept descriptor.
      await stopRun();
      requireSim().destroy();
      sim = new Simulation(descriptor!);
      postMessage({ kind: 'ok', reqId: msg.reqId });
      break;
    }
    // Inputs, snapshots and status polls are advisory: the main thread awaits
    // no ack, so a missing engine has nothing to fail and is dropped instead of
    // reported. Reporting would come back uncorrelated and kill the session —
    // the run controls above keep `requireSim`, since their caller holds a
    // promise that can carry the failure.
    case 'triggerInput':
      if (!sim) break;
      sim.triggerInput(msg.componentIndex, msg.event as InputEvent, msg.state);
      postMessage({ kind: 'ok', reqId: msg.reqId });
      break;
    case 'requestSnapshot':
      if (!sim) break;
      sendSnapshot(msg.reqId, msg.full === true);
      break;
    case 'requestStatus': {
      if (!sim) break;
      const status = sim.getStatus();
      postMessage({
        kind: 'status',
        reqId: msg.reqId,
        tick: status.tick,
        componentCount: status.componentCount,
        linkCount: status.linkCount
      });
      break;
    }
    case 'returnBuffer':
      if (bufferPool.length < BUFFER_POOL_LIMIT) {
        bufferPool.push(msg.buffer);
      }
      break;
  }
}

function requireSim(): Simulation {
  if (!sim) {
    throw new Error('Simulation not initialized');
  }
  return sim;
}

/** Interrupts whatever run is active; resolves once the engine is idle. */
async function stopRun(): Promise<void> {
  runMode = 'idle';
  if (paceTimer !== null) {
    clearTimeout(paceTimer);
    paceTimer = null;
  }
  if (runPromise) {
    sim?.stop();
    await runPromise;
    runPromise = null;
  }
}

/**
 * Target-Hz pacing: each iteration runs the ticks the wall clock says are due
 * since the run started. Batches are bounded by wall-clock time, not tick
 * count: at a high target rate a tick-count cap would block the worker for
 * hundreds of ms in one synchronous `run`, starving the per-frame snapshot
 * pull — the `ms` bound returns control to the message pump after a few ms so
 * inputs and snapshots interleave. When a batch is cut short by the budget the
 * target is unreachable on this machine, so the next batch runs back-to-back
 * rather than idling an interval.
 */
function paceLoop(): void {
  if (runMode !== 'target' || !sim) {
    return;
  }
  const elapsed = performance.now() - paceStart.time;
  const currentTick = sim.getStatus().tick;
  const due = ticksDue(paceHz, elapsed, currentTick - paceStart.tick);
  let ran = 0;
  if (due > 0) {
    sim.run({ ticks: due, ms: PACE_BATCH_MS });
    ran = sim.getStatus().tick - currentTick;
  }
  paceTimer = setTimeout(paceLoop, nextPaceDelayMs(due, ran));
}

/**
 * Copies a coherent snapshot out of WASM memory into a pooled buffer and
 * transfers it. The copy must happen immediately: a `SnapshotView` is valid
 * only until the next tick, and memory growth detaches JS views — hence the
 * fresh `Uint8Array` over `memory.buffer` per snapshot.
 */
function sendSnapshot(reqId: number, full: boolean): void {
  const view = requireSim().snapshot(!full, DELTA_THRESHOLD);
  try {
    const mem = new Uint8Array(memory!.buffer);
    // len / values_len are byte counts (delta ids are u32 LE, so 4 bytes each).
    const ids = view.isDelta
      ? mem.subarray(view.ptr, view.ptr + view.len)
      : null;
    const values = view.isDelta
      ? mem.subarray(view.valuesPtr, view.valuesPtr + view.valuesLen)
      : mem.subarray(view.ptr, view.ptr + view.len);
    const packed = packSnapshot(bufferPool.pop(), ids, values);
    postMessage(
      {
        kind: 'snapshot',
        reqId,
        tick: view.tick,
        isDelta: view.isDelta,
        ...packed
      },
      [packed.buffer]
    );
  } finally {
    view.free();
  }
}
