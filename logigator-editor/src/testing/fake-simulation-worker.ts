import { InputFrameQueues } from '../app/simulation/worker/input-frames';
import {
  InputEventKind,
  MainToWorkerMessage,
  packSnapshot,
  UnitFrame,
  WorkerToMainMessage
} from '../app/simulation/worker/protocol';
import { FakeFrameEngine } from './fake-frame-engine';

/**
 * Message-level stand-in for the simulation worker, structurally compatible
 * with the `Worker` surface the bridge uses. Posted messages land in `posted`;
 * `emit()` delivers worker→main messages.
 *
 * With `autoRespond` it behaves like a healthy worker: `ready` after
 * construction, `ok` for every correlated request, an empty-delta snapshot
 * carrying the queues' counted remainder per `requestSnapshot`, a `status`
 * with `statusTick` per `requestStatus` — all on microtasks, like real worker
 * messages. Turn it off to script the conversation manually.
 *
 * Whatever it responds, it runs the worker's input-frame queues against a
 * {@link FakeFrameEngine} as each message is posted: `step` ticks the engine
 * and pumps, `init` and `stop` rebuild it and drop every queue. `engine`
 * then answers what the circuit sees, tick by tick.
 */
export class FakeSimulationWorker {
  public posted: MainToWorkerMessage[] = [];
  public onmessage:
    ((event: MessageEvent<WorkerToMainMessage>) => void) | null = null;
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public terminated = false;
  /** Tick reported by auto-responded status messages. */
  public statusTick = 0;
  public readonly engine = new FakeFrameEngine();
  private readonly frames = new InputFrameQueues(this.engine);

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
    this.runFrames(msg);
    if (!this.autoRespond || this.terminated) {
      return;
    }
    queueMicrotask(() => {
      if (this.terminated) {
        return;
      }
      switch (msg.kind) {
        case 'requestSnapshot': {
          const queues = this.frames.countedRemaining();
          this.emit({
            kind: 'snapshot',
            reqId: msg.reqId,
            tick: this.statusTick,
            isDelta: true,
            ...packSnapshot(undefined, new Uint8Array(0), new Uint8Array(0)),
            ...(queues.length > 0 ? { queues } : {})
          });
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
          break;
        default:
          this.emit({ kind: 'ok', reqId: msg.reqId });
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

  /**
   * Every unit write of every queued frame, in posting order, beside its
   * frame's kind — what was sent, whether or not the queue applied it yet.
   */
  public sentWrites(): {
    kind: UnitFrame['kind'];
    unit: number;
    event: InputEventKind;
    state: boolean;
  }[] {
    return this.postedOfKind('queueFrames').flatMap((msg) =>
      msg.frames.flatMap((frame) =>
        frame.units.map(([unit, event, state]) => ({
          kind: frame.kind,
          unit,
          event,
          state
        }))
      )
    );
  }

  private runFrames(msg: MainToWorkerMessage): void {
    switch (msg.kind) {
      case 'init':
      case 'stop':
        this.engine.reset();
        this.frames.dropAll();
        break;
      case 'step':
        this.engine.step();
        this.frames.pump();
        break;
      case 'queueFrames':
        this.frames.enqueue(msg.queue, msg.frames);
        break;
      case 'clearFrames':
        this.frames.clear(msg.queue, msg.reset);
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
