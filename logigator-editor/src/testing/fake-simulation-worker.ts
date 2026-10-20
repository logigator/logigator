import type { InputFrame, InputWrite } from '@logigator/sim/wasm';
import { InputProgressReader } from '../app/simulation/worker/input-progress';
import {
  MainToWorkerMessage,
  packSnapshot,
  RecordRead,
  SnapshotMessage,
  StateRead,
  WorkerToMainMessage
} from '../app/simulation/worker/protocol';
import { RecordReader } from '../app/simulation/worker/record-reads';
import { StateReader } from '../app/simulation/worker/state-reads';
import { SimEngine } from './sim-engine';

/** One frame a `submitInput` carried, beside the input it was for. */
export interface SentFrame extends InputFrame {
  comp: number;
}

/**
 * Message-level stand-in for the simulation worker, structurally compatible
 * with the `Worker` surface the bridge uses. Posted messages land in `posted`;
 * `emit()` delivers worker→main messages.
 *
 * With `autoRespond` it behaves like a healthy worker: `ready` after
 * construction, `ok` for every correlated request, an empty-delta snapshot
 * carrying the engine's invalid links and input progress as the worker
 * reports them per `requestSnapshot` — those, the watched state ranges and
 * the watched records read beside it through the worker's own readers, at the point the request was posted, as the
 * worker reads them between messages — and a `status` with `statusTick` per
 * `requestStatus` — all on microtasks, like real worker messages. Every
 * snapshot it sends is kept in `snapshots`. Turn it off to script the
 * conversation manually.
 *
 * Whatever it responds, it runs the posted board on the real engine
 * ({@link SimEngine}) as each message is posted: `init` builds it, `step`
 * ticks it, `submitInput` submits to it and `stop` rebuilds it. `engine` then
 * answers what the circuit sees, tick by tick. Input posted before `init` is
 * dropped, as the worker drops it, and a `submitInput` the engine refuses
 * queues nothing and is answered with an `error` under its `reqId`, as the
 * worker answers it.
 */
export class FakeSimulationWorker {
  public posted: MainToWorkerMessage[] = [];
  public onmessage:
    ((event: MessageEvent<WorkerToMainMessage>) => void) | null = null;
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public terminated = false;
  /** Tick reported by auto-responded status messages. */
  public statusTick = 0;
  /** Every snapshot auto-responded, in sending order. */
  public readonly snapshots: SnapshotMessage[] = [];
  private _engine: SimEngine | null = null;
  private progress: InputProgressReader | null = null;
  private readonly stateReader = new StateReader();
  private readonly recordReader = new RecordReader();

  /** The engine the posted board runs on; there is none before `init`. */
  public get engine(): SimEngine {
    if (!this._engine) {
      throw new Error('No board has been posted to the worker');
    }
    return this._engine;
  }

  constructor(public autoRespond = true) {
    if (autoRespond) {
      queueMicrotask(() => this.emit({ kind: 'ready' }));
    }
  }

  public asWorker(): Worker {
    return this as unknown as Worker;
  }

  public postMessage(msg: MainToWorkerMessage): void {
    this.posted.push(msg);
    let refused: string | null = null;
    try {
      this.runEngine(msg);
    } catch (err) {
      // Only an engine call throws; the worker posts what it threw.
      refused = String(err);
    }
    if (!this.autoRespond || this.terminated) {
      return;
    }
    // Read now, as the worker reads between messages: a step or an input
    // posted before the microtask runs would reach the engine first.
    const state =
      msg.kind === 'requestSnapshot' && this._engine
        ? this.stateReader.read(this._engine)
        : undefined;
    const records =
      msg.kind === 'requestSnapshot' && this._engine
        ? this.recordReader.read(this._engine)
        : undefined;
    const inputProgress =
      msg.kind === 'requestSnapshot' && this._engine
        ? this.progress?.read(this._engine)
        : undefined;
    const invalid =
      msg.kind === 'requestSnapshot' && this._engine
        ? this._engine.invalidLinks()
        : undefined;
    queueMicrotask(() => {
      if (this.terminated) {
        return;
      }
      switch (msg.kind) {
        case 'requestSnapshot': {
          const snapshot: SnapshotMessage = {
            kind: 'snapshot',
            reqId: msg.reqId,
            tick: this.statusTick,
            isDelta: true,
            ...packSnapshot(
              undefined,
              new Uint8Array(0),
              new Uint8Array(0),
              invalid
            ),
            ...(inputProgress ? { inputProgress } : {}),
            ...(state ? { state } : {}),
            ...(records ? { records } : {})
          };
          this.snapshots.push(snapshot);
          this.emit(snapshot);
          break;
        }
        case 'requestStatus':
          this.emit({
            kind: 'status',
            reqId: msg.reqId,
            tick: this.statusTick,
            componentCount: 0,
            linkCount: 0
          });
          break;
        case 'returnBuffer':
        case 'watchState':
        case 'unwatchState':
        case 'watchRecords':
        case 'unwatchRecords':
          break;
        default:
          this.emit(
            refused === null
              ? { kind: 'ok', reqId: msg.reqId }
              : { kind: 'error', reqId: msg.reqId, message: refused }
          );
      }
    });
  }

  public emit(msg: WorkerToMainMessage): void {
    this.onmessage?.({ data: msg } as MessageEvent<WorkerToMainMessage>);
  }

  public emitError(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }

  public terminate(): void {
    this.terminated = true;
  }

  /** Every input request submitted, in posting order. */
  public submitted(): InputWrite[] {
    return this.postedOfKind('submitInput').flatMap((msg) => msg.writes);
  }

  /**
   * Every frame submitted, in posting order, beside its input — what was
   * sent, whether or not the engine applied it yet.
   */
  public sentFrames(): SentFrame[] {
    return this.submitted().flatMap(({ comp, frames }) =>
      frames.map((frame) => ({ comp, ...frame }))
    );
  }

  /** Every state range the snapshots carried, in sending order. */
  public stateReads(): StateRead[] {
    return this.snapshots.flatMap((snapshot) => snapshot.state ?? []);
  }

  /** Every record read the snapshots carried, in sending order. */
  public recordReads(): RecordRead[] {
    return this.snapshots.flatMap((snapshot) => snapshot.records ?? []);
  }

  private runEngine(msg: MainToWorkerMessage): void {
    // The worker keeps its watches with or without an engine.
    if (msg.kind === 'watchState') {
      this.stateReader.watch(msg.watch);
      return;
    }
    if (msg.kind === 'unwatchState') {
      this.stateReader.unwatch(msg.id);
      return;
    }
    if (msg.kind === 'watchRecords') {
      this.recordReader.watch(msg.watch);
      return;
    }
    if (msg.kind === 'unwatchRecords') {
      this.recordReader.unwatch(msg.id);
      return;
    }
    if (msg.kind === 'init') {
      this._engine = new SimEngine(msg.descriptor);
      this.progress = new InputProgressReader(msg.descriptor);
      return;
    }
    const engine = this._engine;
    if (!engine) {
      return;
    }
    switch (msg.kind) {
      case 'stop':
        engine.reset();
        this.progress?.reset();
        this.stateReader.reset();
        this.recordReader.reset();
        break;
      case 'step':
        engine.step();
        break;
      case 'submitInput':
        engine.submit(msg.writes);
        break;
    }
  }

  /** Messages of one kind, for focused assertions. */
  public postedOfKind<K extends MainToWorkerMessage['kind']>(
    kind: K
  ): Extract<MainToWorkerMessage, { kind: K }>[] {
    return this.posted.filter(
      (msg): msg is Extract<MainToWorkerMessage, { kind: K }> =>
        msg.kind === kind
    );
  }
}

/** Deterministic {@link FrameScheduler}: frames fire only on `fire()`. */
export class ManualFrameScheduler {
  private callbacks = new Map<number, () => void>();
  private nextHandle = 1;

  public request(callback: () => void): number {
    const handle = this.nextHandle++;
    this.callbacks.set(handle, callback);
    return handle;
  }

  public cancel(handle: number): void {
    this.callbacks.delete(handle);
  }

  /** Runs all currently scheduled frame callbacks once. */
  public fire(): void {
    const callbacks = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const callback of callbacks) {
      callback();
    }
  }

  public get scheduledCount(): number {
    return this.callbacks.size;
  }
}
