import {
  MainToWorkerMessage,
  packSnapshot,
  WorkerToMainMessage
} from '../app/simulation/worker/protocol';

/**
 * Message-level stand-in for the simulation worker, structurally compatible
 * with the `Worker` surface the bridge uses. Posted messages land in `posted`;
 * `emit()` delivers worker→main messages.
 *
 * With `autoRespond` it behaves like a healthy worker: `ready` after
 * construction, `ok` for every correlated request, an empty-delta snapshot per
 * `requestSnapshot`, a `status` with `statusTick` per `requestStatus` — all on
 * microtasks, like real worker messages. Turn it off to script the
 * conversation manually.
 */
export class FakeSimulationWorker {
  public posted: MainToWorkerMessage[] = [];
  public onmessage:
    ((event: MessageEvent<WorkerToMainMessage>) => void) | null = null;
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public terminated = false;
  /** Tick reported by auto-responded status messages. */
  public statusTick = 0;

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
    if (!this.autoRespond || this.terminated) {
      return;
    }
    queueMicrotask(() => {
      if (this.terminated) {
        return;
      }
      switch (msg.kind) {
        case 'requestSnapshot':
          this.emit({
            kind: 'snapshot',
            reqId: msg.reqId,
            tick: this.statusTick,
            isDelta: true,
            ...packSnapshot(undefined, new Uint8Array(0), new Uint8Array(0))
          });
          break;
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
