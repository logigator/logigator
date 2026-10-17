import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import type { InputWrite } from '@logigator/sim/wasm';
import {
  ByteRange,
  eventFrames,
  StateWatch
} from '../../components/component-inspection';
import { TranslationService } from '../../translation/translation.service';
import { AnalyticsService } from '../../analytics/analytics.service';
import { LoggingService } from '../../logging/logging.service';
import { BoardDescriptor } from '../compiler/compiled-board.model';
import { SnapshotApplier } from '../state/link-state-applier';
import {
  MainRequest,
  MainToWorkerMessage,
  RunRequest,
  unpackSnapshot,
  WorkerToMainMessage
} from './protocol';

/** Worker construction, injectable so specs can substitute a fake. */
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

const STATUS_POLL_MS = 1000;

/** One state watch the bridge keeps, and posts again to a new engine. */
interface StateWatchEntry {
  readonly unit: number;
  range: ByteRange | null;
  readonly onRead: (offset: number, bytes: Uint8Array) => void;
}

interface PendingRequest {
  resolve(): void;
  reject(err: Error): void;
}

/**
 * What one write of a `submitInput` does to its input's pending count:
 * adds `events`, or with `replace` sets it to `events`.
 */
interface SubmittedEvents {
  readonly unit: number;
  readonly events: number;
  readonly replace: boolean;
}

/**
 * Machine-readable context on a worker fault. The reported `Error` carries only
 * the translated toast text, so what identifies the failure lives here.
 */
interface FaultContext {
  source: 'workerError' | 'workerCrash' | 'messageError' | 'inputRefused';
  /** Set when the worker had a translatable message; `detail` is then the raw
   * counterpart. */
  code?: string;
  detail?: string;
}

/**
 * Main-thread bridge to the simulation worker: owns the `Worker`, the
 * request/response correlation map, and the per-frame snapshot pull loop.
 * Snapshots apply straight to the session's {@link LinkStateApplier} — a hot
 * path, no Observables. Measured speed and tick count surface as signals.
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
  private readonly translation = inject(TranslationService);
  private readonly analytics = inject(AnalyticsService);

  private worker: Worker | null = null;
  /** True between the `init` ack and {@link endSession} — the window in which
   * the worker holds a `Simulation`. */
  private ready = false;
  private hooks: SimulationSessionHooks | null = null;
  private nextReqId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private resolveReady: (() => void) | null = null;

  private runMode: SimulationRunMode | 'idle' = 'idle';
  private frameHandle: number | null = null;
  private statusTimer: ReturnType<typeof setInterval> | null = null;
  private snapshotInFlight = false;
  private wantFullSnapshot = false;
  /** A snapshot wanted while idle, behind the one in flight. */
  private wantSnapshot = false;
  private fullSnapshots = 0;
  private deltaSnapshots = 0;
  private lastStatus: { tick: number; at: number } | null = null;
  /**
   * Event frames each input unit had not yet applied as of the last snapshot
   * that reported a change; absent means none.
   */
  private inputProgress = new Map<number, number>();
  /**
   * Every `submitInput` by request id, until the worker answers it and,
   * where it moves a pending count, until a snapshot taken after it: the
   * worker handles messages in order, so snapshot `R` counts exactly the
   * requests below `R`. Those above it are what {@link pendingEvents} adds,
   * and an `error` under one of these ids is a refused input, never a
   * session failure.
   */
  private readonly submissions = new Map<number, readonly SubmittedEvents[]>();
  private nextWatchId = 1;
  /** State watches by the id the worker knows them under. */
  private readonly stateWatches = new Map<number, StateWatchEntry>();

  private readonly _measuredHz = signal(0);
  /** Measured simulation speed in ticks/s, computed from status-poll deltas. */
  public readonly measuredHz = this._measuredHz.asReadonly();

  private readonly _tick = signal(0);
  /** Engine tick count, updated from snapshots and status polls. */
  public readonly tick = this._tick.asReadonly();

  /**
   * Debug tallies of snapshots applied since the session started: `full` counts
   * engine delta→full fallbacks and seed/reset fulls alike, `delta` counts
   * empty deltas too. Reset on every {@link startSession}.
   */
  public get snapshotCounts(): { full: number; delta: number } {
    return { full: this.fullSnapshots, delta: this.deltaSnapshots };
  }

  /** Spawns the worker, waits for the engine, and builds the simulation.
   * Resolves once the session can run. */
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
      this._fail(
        event.message || this.translation.translate('simulation.workerCrashed'),
        { source: 'workerCrash', detail: event.message || undefined }
      );
    // A message that can't be deserialized never reaches onmessage.
    worker.onmessageerror = () =>
      this._fail(
        this.translation.translate('simulation.workerMessageUnreadable'),
        { source: 'messageError' }
      );
    await ready;
    if (this.worker !== worker) {
      throw new Error('Simulation session ended');
    }
    await this._request({ kind: 'init', descriptor });
    this.ready = true;
    // `_post` drops what was sent before the engine is up: a snapshot
    // request, and the state watches of inspections opened meanwhile. Send
    // them now, so neither is left dark.
    let watching = false;
    for (const [id, entry] of this.stateWatches) {
      if (entry.range) {
        watching = this._postStateWatch(id, entry) || watching;
      }
    }
    if (this.wantFullSnapshot || watching) {
      this._requestSnapshot();
    }
  }

  public endSession(): void {
    this._stopFrameLoop();
    this._stopStatusPolling();
    this.worker?.terminate();
    this.worker = null;
    this.ready = false;
    this.hooks = null;
    this.resolveReady = null;
    this.runMode = 'idle';
    this.snapshotInFlight = false;
    this.wantFullSnapshot = false;
    this.wantSnapshot = false;
    this.lastStatus = null;
    this.inputProgress.clear();
    this.submissions.clear();
    this.stateWatches.clear();
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
      // The frame loop drives the ticks in sync mode; the worker idles, so an
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
    // A rate measured under the previous pacing says nothing about this one.
    this.lastStatus = null;
    this._measuredHz.set(0);
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
   * Resets the simulation to tick 0 (worker-side destroy + rebuild). The caller
   * resets the applier and sim visuals; the next snapshot is a full one.
   */
  public async reset(): Promise<void> {
    if (!this.worker) {
      return;
    }
    this._stopFrameLoop();
    this._stopStatusPolling();
    this.runMode = 'idle';
    // The rebuilt engine has none of the input sent before the stop; what
    // came after it may already be queued there, so it still counts.
    const stopId = this.nextReqId;
    await this._request({ kind: 'stop' });
    this.inputProgress.clear();
    this._settleSubmissions(stopId);
    this._measuredHz.set(0);
    this._tick.set(0);
    this.lastStatus = null;
  }

  /**
   * Pulls one **full** snapshot, running or paused, seeding a freshly
   * registered watch applier that would otherwise only see future deltas. With
   * a snapshot in flight the full request carries over to the next one.
   */
  public requestSnapshot(): void {
    if (!this.worker) {
      return;
    }
    this.wantFullSnapshot = true;
    this._requestSnapshot();
  }

  /**
   * Hands input frames to the engine, which queues and sequences them inside
   * its ticks. Nothing awaits it: a request the engine refuses — one that
   * would take an input past `INPUT_QUEUE_LIMIT`, which the callers check
   * first, or a malformed one — queues nothing, is logged and reported as a
   * fault, and leaves the session running. While paused, a write that
   * changes what the engine counts pulls a snapshot, which is what reports
   * the count in {@link pendingEvents}.
   */
  public submitInput(writes: InputWrite[]): void {
    const reqId = this._post({ kind: 'submitInput', writes });
    if (reqId === null) {
      return;
    }
    const counts = writes.flatMap((write): SubmittedEvents[] => {
      const events = eventFrames(write.frames);
      const replace = write.replace === true;
      return events > 0 || replace
        ? [{ unit: write.comp, events, replace }]
        : [];
    });
    this.submissions.set(reqId, counts);
    if (this.runMode === 'idle' && counts.length > 0) {
      this._requestSnapshot();
    }
  }

  /**
   * Event frames of an input unit not yet applied, at most: the count the
   * last snapshot reported, plus the events submitted after that snapshot
   * was taken. The engine only applies frames meanwhile, so the count never
   * falls short of what it holds, and frames that fit behind it fit.
   */
  public pendingEvents(unit: number): number {
    let pending = this.inputProgress.get(unit) ?? 0;
    for (const counts of this.submissions.values()) {
      for (const { unit: submitted, events, replace } of counts) {
        if (submitted === unit) {
          pending = replace ? events : pending + events;
        }
      }
    }
    return pending;
  }

  /**
   * Starts a watch over a range of an engine unit's state, reading nothing
   * until its range is set. The worker reads the range beside each snapshot
   * whose tick moved the unit's state version, and once after the range is
   * set or moved; the bytes reach `onRead` ahead of the session's `onFrame`.
   * While paused, setting a range pulls a snapshot, so the bytes come
   * without waiting for a step. A watch does not survive the session.
   */
  public watchState(
    unit: number,
    onRead: (offset: number, bytes: Uint8Array) => void
  ): StateWatch {
    const id = this.nextWatchId++;
    const entry: StateWatchEntry = { unit, range: null, onRead };
    this.stateWatches.set(id, entry);
    return {
      setRange: (range) => {
        const next = range && range.end > range.start ? range : null;
        if (
          this.stateWatches.get(id) !== entry ||
          (next?.start === entry.range?.start && next?.end === entry.range?.end)
        ) {
          return;
        }
        entry.range = next;
        if (
          this._postStateWatch(id, entry) &&
          next &&
          this.runMode === 'idle'
        ) {
          this._requestSnapshotSoon();
        }
      },
      close: () => {
        if (this.stateWatches.get(id) !== entry) {
          return;
        }
        this.stateWatches.delete(id);
        if (entry.range) {
          this._post({ kind: 'unwatchState', id });
        }
      }
    };
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

  // One snapshot request in flight at most: a slow worker answers late rather
  // than piling up a queue. In sync mode the tick is skipped too, keeping the
  // tick rate at or below the frame rate.
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
    // Claim the in-flight slot only once the request is really out: a dropped
    // post answers with no snapshot, and the flag would never clear.
    if (
      this._post({ kind: 'requestSnapshot', full: this.wantFullSnapshot }) ===
      null
    ) {
      return;
    }
    this.snapshotInFlight = true;
    this.wantFullSnapshot = false;
  }

  /** {@link _requestSnapshot}, or the next one once the one in flight lands. */
  private _requestSnapshotSoon(): void {
    if (this.snapshotInFlight) {
      this.wantSnapshot = true;
    } else {
      this._requestSnapshot();
    }
  }

  /** Tells the worker a watch's range: one to read, or none. */
  private _postStateWatch(id: number, entry: StateWatchEntry): boolean {
    const { unit, range } = entry;
    const reqId = range
      ? this._post({
          kind: 'watchState',
          watch: {
            id,
            unit,
            offset: range.start,
            length: range.end - range.start
          }
        })
      : this._post({ kind: 'unwatchState', id });
    return reqId !== null;
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

  /**
   * Sends without registering a response promise, reporting the request id
   * the message went out under, or `null` where it did not go out. Nothing
   * is posted before the session is {@link ready}: the worker
   * holds no `Simulation` until it acks `init`, and an uncorrelated op in that
   * window would come back as an uncorrelated error and tear down a session
   * that was about to be usable. The switch/pulse-button tap path reaches this, since
   * simulation mode is entered while the engine is still starting. Dropping
   * beats queueing — an input predating the engine has no tick to apply at.
   */
  private _post(msg: MainRequest): number | null {
    if (!this.worker || !this.ready) {
      return null;
    }
    const reqId = this.nextReqId++;
    this.worker.postMessage({ ...msg, reqId } as MainToWorkerMessage);
    return reqId;
  }

  /**
   * Hands a snapshot's buffer back to the worker's pool: bookkeeping the
   * worker accepts with or without an engine.
   */
  private _returnBuffer(buffer: ArrayBuffer): void {
    this.worker?.postMessage(
      { kind: 'returnBuffer', buffer } satisfies MainToWorkerMessage,
      [buffer]
    );
  }

  /**
   * Forgets the input requests below `reqId`, which a snapshot or a rebuilt
   * engine now accounts for.
   */
  private _settleSubmissions(reqId: number): void {
    for (const id of this.submissions.keys()) {
      if (id >= reqId) {
        break;
      }
      this.submissions.delete(id);
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
        // Taken: a request that moved no count has nothing left to say.
        if (this.submissions.get(msg.reqId)?.length === 0) {
          this.submissions.delete(msg.reqId);
        }
        break;
      case 'error': {
        if (msg.reqId !== null && this.submissions.delete(msg.reqId)) {
          this._inputRefused(msg.message);
          break;
        }
        // A coded failure carries the raw detail in `message` for the log and
        // a translatable, user-facing message under the code.
        const userMessage =
          msg.code === 'engineInitFailed'
            ? this.translation.translate('simulation.engineInitFailed')
            : msg.message;
        const fault: FaultContext = {
          source: 'workerError',
          code: msg.code,
          detail: msg.message
        };
        const request =
          msg.reqId !== null ? this.pending.get(msg.reqId) : undefined;
        if (request) {
          this.pending.delete(msg.reqId!);
          const error = new Error(userMessage);
          this._reportFault(error, fault);
          request.reject(error);
        } else {
          if (msg.code) {
            this.logging.error(msg.message, 'SimulationWorker');
          }
          this._fail(userMessage, fault);
        }
        break;
      }
      case 'snapshot': {
        this.snapshotInFlight = false;
        this._tick.set(msg.tick);
        if (msg.inputProgress) {
          this.inputProgress = new Map(msg.inputProgress);
        }
        this._settleSubmissions(msg.reqId);
        if (msg.isDelta) {
          this.deltaSnapshots++;
        } else {
          this.fullSnapshots++;
        }
        // Before `onFrame`, where the frame's inspections show it.
        for (const read of msg.state ?? []) {
          this.stateWatches.get(read.id)?.onRead(read.offset, read.bytes);
        }
        const applier = this.hooks?.applier;
        if (applier) {
          const { ids, values } = unpackSnapshot(msg);
          if (msg.isDelta) {
            // An empty delta means nothing changed — hold current state.
            // applyFull would read the empty buffer and clear every link.
            if (ids) {
              applier.applyDelta(ids, values);
            }
          } else {
            applier.applyFull(values);
          }
        }
        this._returnBuffer(msg.buffer);
        this.hooks?.onFrame?.();
        if (this.runMode === 'idle') {
          this.hooks?.repaint();
        }
        // A full-snapshot request that arrived while this one was in flight,
        // or a state watch moved while paused. A run pulls the next frame's
        // snapshot anyway.
        const wanted = this.wantSnapshot && this.runMode === 'idle';
        this.wantSnapshot = false;
        if (this.wantFullSnapshot || wanted) {
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

  /**
   * Reports an engine fault to error tracking as a real exception: every worker
   * failure is an internal fault, but each is caught here and shown as a toast,
   * so none reaches the {@link GlobalErrorHandler} that owns `$exception`. The
   * call sites are mutually exclusive, so a fault is reported once. Not
   * called for {@link endSession}'s rejections — tearing a session down cancels
   * in-flight requests by design.
   */
  private _reportFault(error: Error, context: FaultContext): void {
    this.analytics.captureError(error, undefined, { ...context });
  }

  /**
   * The engine refused a `submitInput` whole, so nothing of it is queued.
   * Never fatal: the session runs on as if the input had not been sent, so
   * a race past the callers' room check, or an editor bug, costs that input
   * and nothing more. Still a fault, so it is logged and reported.
   */
  private _inputRefused(detail: string): void {
    const message = `The engine refused input frames: ${detail}`;
    this.logging.error(message, 'SimulationWorker');
    this._reportFault(new Error(message), { source: 'inputRefused', detail });
  }

  /** Unrecoverable failure: reject everything, notify the session owner. */
  private _fail(message: string, context: FaultContext): void {
    const hooks = this.hooks;
    const error = new Error(message);
    this._reportFault(error, context);
    for (const request of this.pending.values()) {
      request.reject(error);
    }
    this.pending.clear();
    this._stopFrameLoop();
    this._stopStatusPolling();
    hooks?.onError(message);
  }
}
