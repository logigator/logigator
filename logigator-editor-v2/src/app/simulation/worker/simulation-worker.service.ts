import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { LoggingService } from '../../logging/logging.service';
import { BoardDescriptor } from '../compiler/compiled-board.model';
import { SnapshotApplier } from '../state/link-state-applier';
import {
  InputEventKind,
  MainRequest,
  MainToWorkerMessage,
  RunRequest,
  unpackSnapshot,
  WorkerToMainMessage
} from './protocol';

/** Worker construction, injectable so specs can substitute a message-level fake. */
export const SIMULATION_WORKER_FACTORY = new InjectionToken<() => Worker>(
  'SIMULATION_WORKER_FACTORY',
  {
    providedIn: 'root',
    factory: () => () =>
      new Worker(new URL('./simulation.worker', import.meta.url), {
        type: 'module'
      })
  }
);

/** Frame scheduling, injectable so specs can drive frames deterministically. */
export const FRAME_SCHEDULER = new InjectionToken<FrameScheduler>(
  'FRAME_SCHEDULER',
  {
    providedIn: 'root',
    factory: (): FrameScheduler => ({
      request: (callback) => requestAnimationFrame(callback),
      cancel: (handle) => cancelAnimationFrame(handle)
    })
  }
);

export interface FrameScheduler {
  request(callback: () => void): number;
  cancel(handle: number): void;
}

/** Run modes selectable from the UI; `sync` ticks once per rendered frame. */
export type SimulationRunMode = 'continuous' | 'target' | 'sync';

export interface SimulationSessionHooks {
  applier: SnapshotApplier;
  /** Repaint request for snapshots applied while no run holds the ticker on. */
  repaint(): void;
  /** Runs after each snapshot is applied; live inspections refresh on it. */
  onFrame?(): void;
  /** Fatal worker failure; the owner must tear the session down. */
  onError(message: string): void;
}

/** Status polling rate for the measured-Hz readout. */
const STATUS_POLL_MS = 1000;

interface PendingRequest {
  resolve(): void;
  reject(err: Error): void;
}

/**
 * Main-thread bridge to the simulation worker: owns the `Worker`, the
 * request/response correlation map, and the per-frame snapshot pull loop.
 * Snapshots apply straight to the session's {@link LinkStateApplier} (hot
 * path — no Observables); measured speed and tick count surface as signals.
 *
 * Pacing is a pull model with a single in-flight snapshot request per frame;
 * payload buffers are pooled worker-side and returned after applying.
 */
@Injectable({
  providedIn: 'root'
})
export class SimulationWorkerService {
  private readonly createWorker = inject(SIMULATION_WORKER_FACTORY);
  private readonly frameScheduler = inject(FRAME_SCHEDULER);
  private readonly logging = inject(LoggingService);
  private readonly transloco = inject(TranslocoService);

  private worker: Worker | null = null;
  private hooks: SimulationSessionHooks | null = null;
  private nextReqId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private resolveReady: (() => void) | null = null;

  private runMode: SimulationRunMode | 'idle' = 'idle';
  private frameHandle: number | null = null;
  private statusTimer: ReturnType<typeof setInterval> | null = null;
  private snapshotInFlight = false;
  private wantFullSnapshot = false;
  // Debug tallies of snapshots applied this session, by kind (empty deltas
  // included). Read via {@link snapshotCounts}; reset per session.
  private fullSnapshots = 0;
  private deltaSnapshots = 0;
  private lastStatus: { tick: number; at: number } | null = null;

  private readonly _measuredHz = signal(0);
  /** Measured simulation speed in ticks/s, computed from status-poll deltas. */
  public readonly measuredHz = this._measuredHz.asReadonly();

  private readonly _tick = signal(0);
  /** Engine tick count, updated from snapshots and status polls. */
  public readonly tick = this._tick.asReadonly();

  /**
   * Snapshots applied since the session started, split by kind (`full` counts
   * engine delta→full fallbacks and seed/reset fulls alike; `delta` counts
   * empty deltas too). A debug readout — reset on every {@link startSession}.
   */
  public get snapshotCounts(): { full: number; delta: number } {
    return { full: this.fullSnapshots, delta: this.deltaSnapshots };
  }

  /**
   * Spawns the worker, waits for the WASM engine to come up, and builds the
   * simulation from the descriptor. Resolves once the session can run.
   */
  public async startSession(
    descriptor: BoardDescriptor,
    hooks: SimulationSessionHooks
  ): Promise<void> {
    this.endSession();
    this.hooks = hooks;
    this.fullSnapshots = 0;
    this.deltaSnapshots = 0;
    const worker = this.createWorker();
    this.worker = worker;
    const ready = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.pending.set(0, { resolve, reject });
    });
    worker.onmessage = (event: MessageEvent<WorkerToMainMessage>) =>
      this._onMessage(event.data);
    worker.onerror = (event: ErrorEvent) =>
      this._fail(event.message || 'Simulation worker crashed');
    // A message that can't be deserialized never reaches onmessage — route it
    // into the same failure path as onerror.
    worker.onmessageerror = () =>
      this._fail(
        this.transloco.translate('simulation.workerMessageUnreadable')
      );
    await ready;
    if (this.worker !== worker) {
      throw new Error('Simulation session ended');
    }
    await this._request({ kind: 'init', descriptor });
  }

  /** Terminates the worker and discards all session state. */
  public endSession(): void {
    this._stopFrameLoop();
    this._stopStatusPolling();
    this.worker?.terminate();
    this.worker = null;
    this.hooks = null;
    this.resolveReady = null;
    this.runMode = 'idle';
    this.snapshotInFlight = false;
    this.wantFullSnapshot = false;
    this.lastStatus = null;
    this._measuredHz.set(0);
    this._tick.set(0);
    const error = new Error('Simulation session ended');
    for (const request of this.pending.values()) {
      request.reject(error);
    }
    this.pending.clear();
  }

  /** Starts (or re-paces) a run; safe to call while already running. */
  public async start(mode: SimulationRunMode, targetHz: number): Promise<void> {
    if (!this.worker) {
      return;
    }
    if (mode === 'sync') {
      // The worker idles in sync mode — the frame loop drives the ticks. An
      // active worker-paced run must stop first.
      await this._request({ kind: 'pause' });
    } else {
      const config: RunRequest =
        mode === 'target' ? { mode, hz: targetHz } : { mode };
      await this._request({ kind: 'start', config });
    }
    if (!this.worker) {
      return;
    }
    this.runMode = mode;
    this.lastStatus = null;
    this._startFrameLoop();
    this._startStatusPolling();
  }

  /** Interrupts the run, then pulls one final snapshot to settle the canvas. */
  public async pause(): Promise<void> {
    if (!this.worker) {
      return;
    }
    this._stopFrameLoop();
    this._stopStatusPolling();
    this.runMode = 'idle';
    this._measuredHz.set(0);
    this.lastStatus = null;
    await this._request({ kind: 'pause' });
    this._requestSnapshot();
  }

  /** One engine tick; only meaningful while paused. */
  public async step(): Promise<void> {
    if (!this.worker || this.runMode !== 'idle') {
      return;
    }
    await this._request({ kind: 'step' });
    this._requestSnapshot();
  }

  /**
   * Resets the simulation to tick 0 (worker-side destroy + rebuild). The
   * caller resets the applier and sim visuals — the engine's next snapshot
   * is a full one against a fresh baseline.
   */
  public async reset(): Promise<void> {
    if (!this.worker) {
      return;
    }
    this._stopFrameLoop();
    this._stopStatusPolling();
    this.runMode = 'idle';
    await this._request({ kind: 'stop' });
    this._measuredHz.set(0);
    this._tick.set(0);
    this.lastStatus = null;
  }

  /**
   * Pulls one **full** snapshot — the engine answers with its complete
   * current state whether running or paused. Seeds a freshly-registered
   * watch applier, which would otherwise only see future deltas. If a
   * snapshot is already in flight, the full request is carried over to the
   * next one instead of being dropped.
   */
  public requestSnapshot(): void {
    if (!this.worker) {
      return;
    }
    this.wantFullSnapshot = true;
    this._requestSnapshot();
  }

  /**
   * Forwards a user input to the engine; applied at the next tick boundary.
   * Fire-and-forget — failures surface through the session error hook.
   */
  public triggerInput(
    componentIndex: number,
    event: InputEventKind,
    state: boolean[]
  ): void {
    this._post({ kind: 'triggerInput', componentIndex, event, state });
  }

  private _startFrameLoop(): void {
    if (this.frameHandle === null) {
      this.frameHandle = this.frameScheduler.request(this._frame);
    }
  }

  private _stopFrameLoop(): void {
    if (this.frameHandle !== null) {
      this.frameScheduler.cancel(this.frameHandle);
      this.frameHandle = null;
    }
  }

  // One snapshot request in flight at most: a slow worker answers late
  // rather than piling up a queue. In sync mode the tick is skipped too,
  // keeping the tick rate at or below the frame rate.
  private readonly _frame = (): void => {
    this.frameHandle = null;
    if (this.runMode === 'idle' || !this.worker) {
      return;
    }
    if (!this.snapshotInFlight) {
      if (this.runMode === 'sync') {
        this._post({ kind: 'step' });
      }
      this._requestSnapshot();
    }
    this.frameHandle = this.frameScheduler.request(this._frame);
  };

  private _requestSnapshot(): void {
    if (this.snapshotInFlight) {
      return;
    }
    this.snapshotInFlight = true;
    const full = this.wantFullSnapshot;
    this.wantFullSnapshot = false;
    this._post({ kind: 'requestSnapshot', full });
  }

  private _startStatusPolling(): void {
    if (this.statusTimer === null) {
      this.statusTimer = setInterval(
        () => this._post({ kind: 'requestStatus' }),
        STATUS_POLL_MS
      );
    }
  }

  private _stopStatusPolling(): void {
    if (this.statusTimer !== null) {
      clearInterval(this.statusTimer);
      this.statusTimer = null;
    }
  }

  /** Sends a correlated request and resolves on the worker's `ok`. */
  private _request(msg: MainRequest): Promise<void> {
    if (!this.worker) {
      return Promise.reject(new Error('Simulation session ended'));
    }
    const reqId = this.nextReqId++;
    const promise = new Promise<void>((resolve, reject) => {
      this.pending.set(reqId, { resolve, reject });
    });
    this.worker.postMessage({ ...msg, reqId } as MainToWorkerMessage);
    this.logging.debug(`request ${msg.kind}`, 'SimulationWorker');
    return promise.then(
      () => this.logging.debug(`request ${msg.kind} ok`, 'SimulationWorker'),
      (err: Error) => {
        this.logging.debug(
          `request ${msg.kind} failed: ${err.message}`,
          'SimulationWorker'
        );
        throw err;
      }
    );
  }

  /** Sends without registering a response promise (still tracked by reqId). */
  private _post(
    msg: MainRequest | Extract<MainToWorkerMessage, { kind: 'returnBuffer' }>,
    transfer?: Transferable[]
  ): void {
    if (!this.worker) {
      return;
    }
    const message =
      msg.kind === 'returnBuffer'
        ? msg
        : ({ ...msg, reqId: this.nextReqId++ } as MainToWorkerMessage);
    if (transfer) {
      this.worker.postMessage(message, transfer);
    } else {
      this.worker.postMessage(message);
    }
  }

  private _onMessage(msg: WorkerToMainMessage): void {
    switch (msg.kind) {
      case 'ready':
        this.logging.debug('worker ready', 'SimulationWorker');
        this.pending.delete(0);
        this.resolveReady?.();
        this.resolveReady = null;
        break;
      case 'ok':
        this.pending.get(msg.reqId)?.resolve();
        this.pending.delete(msg.reqId);
        break;
      case 'error': {
        const request =
          msg.reqId !== null ? this.pending.get(msg.reqId) : undefined;
        if (request) {
          this.pending.delete(msg.reqId!);
          request.reject(new Error(msg.message));
        } else {
          this._fail(msg.message);
        }
        break;
      }
      case 'snapshot': {
        this.snapshotInFlight = false;
        this._tick.set(msg.tick);
        if (msg.isDelta) {
          this.deltaSnapshots++;
        } else {
          this.fullSnapshots++;
        }
        const applier = this.hooks?.applier;
        if (applier) {
          const { ids, values } = unpackSnapshot(msg);
          if (msg.isDelta) {
            // An empty delta (no changed links) means nothing changed since
            // the last poll — hold current state. Falling through to
            // applyFull here would read an empty buffer and clear every link.
            if (ids) {
              applier.applyDelta(ids, values);
            }
          } else {
            applier.applyFull(values);
          }
        }
        this._post({ kind: 'returnBuffer', buffer: msg.buffer }, [msg.buffer]);
        this.hooks?.onFrame?.();
        if (this.runMode === 'idle') {
          this.hooks?.repaint();
        }
        // A full-snapshot request that arrived while this one was in flight.
        if (this.wantFullSnapshot) {
          this._requestSnapshot();
        }
        break;
      }
      case 'status': {
        const now = performance.now();
        this._tick.set(msg.tick);
        if (this.lastStatus && now > this.lastStatus.at) {
          this._measuredHz.set(
            Math.max(
              0,
              Math.round(
                ((msg.tick - this.lastStatus.tick) * 1000) /
                  (now - this.lastStatus.at)
              )
            )
          );
        }
        this.lastStatus = { tick: msg.tick, at: now };
        break;
      }
    }
  }

  /** Unrecoverable worker failure: reject everything, notify the session owner. */
  private _fail(message: string): void {
    const hooks = this.hooks;
    const error = new Error(message);
    for (const request of this.pending.values()) {
      request.reject(error);
    }
    this.pending.clear();
    this._stopFrameLoop();
    this._stopStatusPolling();
    hooks?.onError(message);
  }
}
