import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../../testing/configure-test-bed';
import {
  FakeSimulationWorker,
  ManualFrameScheduler
} from '../../../testing/fake-simulation-worker';
import { AnalyticsService } from '../../analytics/analytics.service';
import { INPUT_QUEUE_LIMIT } from '../../components/component-inspection';
import { LoggingService } from '../../logging/logging.service';
import { LinkStateApplier } from '../state/link-state-applier';
import { packSnapshot } from './protocol';
import {
  FRAME_SCHEDULER,
  SIMULATION_WORKER_FACTORY,
  SimulationSessionHooks,
  SimulationWorkerService
} from './simulation-worker.service';
import { userInputBoard } from '../../../testing/sim-engine';
import {
  byteFrames,
  byteTicks,
  RECORDER_UNIT,
  recorderBoard
} from '../../../testing/recorder-writes';

const DESCRIPTOR = userInputBoard(8);

describe('SimulationWorkerService', () => {
  let service: SimulationWorkerService;
  let fakeWorker: FakeSimulationWorker;
  let scheduler: ManualFrameScheduler;
  let applier: LinkStateApplier;
  let hooks: SimulationSessionHooks;
  let autoRespond: boolean;

  beforeEach(() => {
    autoRespond = true;
    scheduler = new ManualFrameScheduler();
    configureTestBed([
      {
        provide: SIMULATION_WORKER_FACTORY,
        useValue: () => {
          fakeWorker = new FakeSimulationWorker(autoRespond);
          return fakeWorker.asWorker();
        }
      },
      { provide: FRAME_SCHEDULER, useValue: scheduler }
    ]);
    service = TestBed.inject(SimulationWorkerService);
    applier = {
      applyDelta: vi.fn(),
      applyFull: vi.fn(),
      applyConflicts: vi.fn(),
      reset: vi.fn()
    } as unknown as LinkStateApplier;
    hooks = { applier, repaint: vi.fn(), onError: vi.fn() };
  });

  afterEach(() => {
    service.endSession();
  });

  it('boots a session: init after ready, resolved by the ok ack', async () => {
    await service.startSession(DESCRIPTOR, hooks);

    const inits = fakeWorker.postedOfKind('init');
    expect(inits).toHaveLength(1);
    expect(inits[0].descriptor).toEqual(DESCRIPTOR);
  });

  it('rejects a request when the worker reports a correlated error', async () => {
    autoRespond = false;
    const session = service.startSession(DESCRIPTOR, hooks);
    fakeWorker.emit({ kind: 'ready' });
    await vi.waitFor(() =>
      expect(fakeWorker.postedOfKind('init')).toHaveLength(1)
    );

    const reqId = fakeWorker.postedOfKind('init')[0].reqId;
    fakeWorker.emit({ kind: 'error', reqId, message: 'bad board' });

    await expect(session).rejects.toThrow('bad board');
    expect(hooks.onError).not.toHaveBeenCalled();
  });

  it('reports uncorrelated worker errors through the session hook', async () => {
    await service.startSession(DESCRIPTOR, hooks);

    fakeWorker.emit({ kind: 'error', reqId: null, message: 'engine died' });

    expect(hooks.onError).toHaveBeenCalledWith('engine died');
  });

  it('starts a worker-paced run and pulls one snapshot per frame', async () => {
    await service.startSession(DESCRIPTOR, hooks);
    await service.start('continuous', 1000);

    expect(fakeWorker.postedOfKind('start')).toHaveLength(1);
    expect(fakeWorker.postedOfKind('start')[0].config).toEqual({
      mode: 'continuous'
    });

    scheduler.fire();
    expect(fakeWorker.postedOfKind('requestSnapshot')).toHaveLength(1);

    // The response has not arrived — a second frame must not stack a request.
    scheduler.fire();
    expect(fakeWorker.postedOfKind('requestSnapshot')).toHaveLength(1);

    await vi.waitFor(() =>
      expect(fakeWorker.postedOfKind('returnBuffer')).toHaveLength(1)
    );
    scheduler.fire();
    expect(fakeWorker.postedOfKind('requestSnapshot')).toHaveLength(2);
  });

  it('drives sync mode from the frame loop: one step per snapshot round-trip', async () => {
    await service.startSession(DESCRIPTOR, hooks);
    await service.start('sync', 1000);

    // Sync mode keeps the worker idle: it pauses instead of starting a run.
    expect(fakeWorker.postedOfKind('start')).toHaveLength(0);
    expect(fakeWorker.postedOfKind('pause')).toHaveLength(1);

    scheduler.fire();
    expect(fakeWorker.postedOfKind('step')).toHaveLength(1);
    expect(fakeWorker.postedOfKind('requestSnapshot')).toHaveLength(1);

    // An in-flight snapshot skips the tick, capping at the frame rate.
    scheduler.fire();
    expect(fakeWorker.postedOfKind('step')).toHaveLength(1);
  });

  it('applies delta snapshots and recycles the buffer', async () => {
    autoRespond = false;
    const session = service.startSession(DESCRIPTOR, hooks);
    fakeWorker.emit({ kind: 'ready' });
    await vi.waitFor(() =>
      expect(fakeWorker.postedOfKind('init')).toHaveLength(1)
    );
    fakeWorker.emit({
      kind: 'ok',
      reqId: fakeWorker.postedOfKind('init')[0].reqId
    });
    await session;

    const ids = new Uint8Array(new Uint32Array([0, 2]).buffer);
    const packed = packSnapshot(undefined, ids, new Uint8Array([0b10]));
    fakeWorker.emit({
      kind: 'snapshot',
      reqId: 7,
      tick: 5,
      isDelta: true,
      ...packed
    });

    expect(applier.applyDelta).toHaveBeenCalledOnce();
    const [deltaIds, deltaValues] = vi.mocked(applier.applyDelta).mock.calls[0];
    expect([...deltaIds]).toEqual([0, 2]);
    expect([...deltaValues]).toEqual([0b10]);
    expect(service.tick()).toBe(5);

    const returns = fakeWorker.postedOfKind('returnBuffer');
    expect(returns).toHaveLength(1);
    expect(returns[0].buffer).toBe(packed.buffer);

    // Idle session: the snapshot triggers a repaint.
    expect(hooks.repaint).toHaveBeenCalledOnce();
  });

  it('applies full snapshots through applyFull', async () => {
    await service.startSession(DESCRIPTOR, hooks);

    const packed = packSnapshot(undefined, null, new Uint8Array([0b1]));
    fakeWorker.emit({
      kind: 'snapshot',
      reqId: 9,
      tick: 1,
      isDelta: false,
      ...packed
    });

    expect(applier.applyFull).toHaveBeenCalledOnce();
    expect(applier.applyDelta).not.toHaveBeenCalled();
  });

  it('holds powered links across an empty delta instead of clearing them', async () => {
    // An empty delta must be a no-op: falling through to applyFull with an
    // empty buffer would read every link as 0 and clear the board.
    const wire = { setPowered: vi.fn() };
    const realApplier = new LinkStateApplier([
      { wires: [wire], ports: [], junctions: [] }
    ] as unknown as ConstructorParameters<typeof LinkStateApplier>[0]);
    const applyFullSpy = vi.spyOn(realApplier, 'applyFull');
    await service.startSession(DESCRIPTOR, { ...hooks, applier: realApplier });

    fakeWorker.emit({
      kind: 'snapshot',
      reqId: 1,
      tick: 1,
      isDelta: true,
      ...packSnapshot(
        undefined,
        new Uint8Array(new Uint32Array([0]).buffer),
        new Uint8Array([0b1])
      )
    });
    expect(wire.setPowered).toHaveBeenCalledExactlyOnceWith(true);

    // No applyFull, and the link stays on.
    fakeWorker.emit({
      kind: 'snapshot',
      reqId: 2,
      tick: 1,
      isDelta: true,
      ...packSnapshot(undefined, new Uint8Array(0), new Uint8Array(0))
    });

    expect(applyFullSpy).not.toHaveBeenCalled();
    expect(wire.setPowered).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('hands every snapshot its conflict set, an empty delta included', async () => {
    const wire = { setPowered: vi.fn(), setConflict: vi.fn() };
    const realApplier = new LinkStateApplier([
      { wires: [], ports: [], junctions: [] },
      { wires: [wire], ports: [], junctions: [] }
    ] as unknown as ConstructorParameters<typeof LinkStateApplier>[0]);
    await service.startSession(DESCRIPTOR, { ...hooks, applier: realApplier });

    fakeWorker.emit({
      kind: 'snapshot',
      reqId: 1,
      tick: 1,
      isDelta: false,
      ...packSnapshot(
        undefined,
        null,
        new Uint8Array([0]),
        new Uint8Array(new Uint32Array([1]).buffer)
      )
    });
    expect(wire.setConflict).toHaveBeenCalledExactlyOnceWith(true);
    // The link was never powered: a conflict is not power.
    expect(wire.setPowered).not.toHaveBeenCalled();

    // Nothing changed but the conflict is gone: the set still arrives.
    fakeWorker.emit({
      kind: 'snapshot',
      reqId: 2,
      tick: 2,
      isDelta: true,
      ...packSnapshot(undefined, new Uint8Array(0), new Uint8Array(0))
    });
    expect(wire.setConflict).toHaveBeenLastCalledWith(false);
  });

  it('tallies full and delta snapshots (empty deltas included)', async () => {
    await service.startSession(DESCRIPTOR, hooks);
    expect(service.snapshotCounts).toEqual({ full: 0, delta: 0 });

    const emitDelta = (reqId: number, ids: number[], values: number[]): void =>
      fakeWorker.emit({
        kind: 'snapshot',
        reqId,
        tick: reqId,
        isDelta: true,
        ...packSnapshot(
          undefined,
          new Uint8Array(new Uint32Array(ids).buffer),
          new Uint8Array(values)
        )
      });

    emitDelta(1, [0], [0b1]);
    emitDelta(2, [], []); // empty delta still counts
    fakeWorker.emit({
      kind: 'snapshot',
      reqId: 3,
      tick: 3,
      isDelta: false,
      ...packSnapshot(undefined, null, new Uint8Array([0b1]))
    });

    expect(service.snapshotCounts).toEqual({ full: 1, delta: 2 });

    await service.startSession(DESCRIPTOR, hooks);
    expect(service.snapshotCounts).toEqual({ full: 0, delta: 0 });
  });

  it('measures the rate on the worker clock, over the last three polls', async () => {
    await service.startSession(DESCRIPTOR, hooks);
    const report = (reqId: number, tick: number, at: number) =>
      fakeWorker.emit({
        kind: 'status',
        reqId,
        tick,
        at,
        componentCount: 1,
        linkCount: 1
      });

    report(1, 100, 1000);
    expect(service.measuredHz()).toBe(0);

    report(2, 5100, 2000);
    expect(service.measuredHz()).toBe(5000);
    expect(service.tick()).toBe(5100);

    // A slow second: averaged with the one before, not shown alone.
    report(3, 6100, 3000);
    expect(service.measuredHz()).toBe(3000);

    report(4, 11_100, 4000);
    expect(service.measuredHz()).toBe(3667);

    // The first report leaves the window.
    report(5, 16_100, 5000);
    expect(service.measuredHz()).toBe(3667);
    report(6, 21_100, 6000);
    expect(service.measuredHz()).toBe(5000);
  });

  it('pause interrupts the run and flushes one final snapshot', async () => {
    await service.startSession(DESCRIPTOR, hooks);
    await service.start('continuous', 1000);

    await service.pause();

    expect(fakeWorker.postedOfKind('pause')).toHaveLength(1);
    expect(fakeWorker.postedOfKind('requestSnapshot')).toHaveLength(1);
    expect(service.measuredHz()).toBe(0);

    // The flushed snapshot arrives while idle.
    await vi.waitFor(() => expect(hooks.repaint).toHaveBeenCalled());
  });

  it('step only works while paused', async () => {
    await service.startSession(DESCRIPTOR, hooks);

    await service.step();
    expect(fakeWorker.postedOfKind('step')).toHaveLength(1);

    await service.start('continuous', 1000);
    await service.step();
    expect(fakeWorker.postedOfKind('step')).toHaveLength(1);
  });

  it('reset sends stop and zeroes the readouts', async () => {
    await service.startSession(DESCRIPTOR, hooks);
    fakeWorker.statusTick = 50;
    await service.start('target', 250);
    expect(fakeWorker.postedOfKind('start')[0].config).toEqual({
      mode: 'target',
      hz: 250
    });

    await service.reset();

    expect(fakeWorker.postedOfKind('stop')).toHaveLength(1);
    expect(service.measuredHz()).toBe(0);
    expect(service.tick()).toBe(0);
  });

  it('hands a request to the engine whole, every input of it applied by the next step', async () => {
    await service.startSession(DESCRIPTOR, hooks);

    service.submitInput([
      { comp: 3, frames: [{ state: [true] }] },
      { comp: 5, frames: [{ state: [true], coalesce: true }] }
    ]);
    expect(fakeWorker.engine.output(3)).toBe(false);
    await service.step();

    expect(fakeWorker.engine.output(3)).toBe(true);
    expect(fakeWorker.engine.output(5)).toBe(true);
  });

  it('keeps the input progress the last snapshot reporting it carried', async () => {
    autoRespond = false;
    const session = service.startSession(DESCRIPTOR, hooks);
    fakeWorker.emit({ kind: 'ready' });
    await vi.waitFor(() =>
      expect(fakeWorker.postedOfKind('init')).toHaveLength(1)
    );
    fakeWorker.emit({
      kind: 'ok',
      reqId: fakeWorker.postedOfKind('init')[0].reqId
    });
    await session;
    const snapshot = (reqId: number, inputProgress?: [number, number][]) =>
      fakeWorker.emit({
        kind: 'snapshot',
        reqId,
        tick: reqId,
        isDelta: true,
        ...packSnapshot(undefined, new Uint8Array(0), new Uint8Array(0)),
        ...(inputProgress ? { inputProgress } : {})
      });

    snapshot(1, [
      [3, 12],
      [6, 1]
    ]);
    expect(service.pendingEvents(3)).toBe(12);
    expect(service.pendingEvents(6)).toBe(1);
    expect(service.pendingEvents(4)).toBe(0);

    // The worker reports progress only when it moved.
    snapshot(2);
    expect(service.pendingEvents(3)).toBe(12);

    snapshot(3, [[3, 5]]);
    expect(service.pendingEvents(3)).toBe(5);
    expect(service.pendingEvents(6)).toBe(0);

    snapshot(4, []);
    expect(service.pendingEvents(3)).toBe(0);
  });

  it("counts an input's event frames down to zero as the engine applies them", async () => {
    const onFrame = vi.fn();
    await service.startSession(DESCRIPTOR, { ...hooks, onFrame });

    service.submitInput([
      {
        comp: 3,
        frames: [
          { state: [true], hold: 2 },
          { state: [false], coalesce: true },
          { state: [true] }
        ]
      }
    ]);
    // Paused, an event pulls a snapshot of its own, so its count shows.
    await vi.waitFor(() => expect(service.pendingEvents(3)).toBe(2));

    const counts: number[] = [];
    for (let step = 0; step < 4; step++) {
      await service.step();
      await vi.waitFor(() => expect(onFrame).toHaveBeenCalledTimes(step + 2));
      counts.push(service.pendingEvents(3));
    }

    // The second event waits out the first one's hold and the state frame
    // between them, which is never counted.
    expect(counts).toEqual([1, 1, 1, 0]);
    expect(service.pendingEvents(4)).toBe(0);
  });

  it('counts the events sent since the last snapshot, never fewer than the engine holds', async () => {
    await service.startSession(DESCRIPTOR, hooks);
    const event = { state: [true] };

    // Both go out before any snapshot answers; the one pulled counts only
    // the first.
    service.submitInput([{ comp: 3, frames: [event, event, event] }]);
    service.submitInput([
      { comp: 3, frames: [event, event] },
      { comp: 4, frames: [event] }
    ]);
    expect([service.pendingEvents(3), service.pendingEvents(4)]).toEqual([
      5, 1
    ]);
    await vi.waitFor(() =>
      expect(fakeWorker.snapshots.length).toBeGreaterThan(0)
    );
    expect(service.pendingEvents(3)).toBe(fakeWorker.engine.pending(3));

    await service.step();
    expect(service.pendingEvents(3)).toBeGreaterThanOrEqual(
      fakeWorker.engine.pending(3)
    );
    await vi.waitFor(() => expect(service.pendingEvents(3)).toBe(4));

    service.submitInput([{ comp: 3, frames: [event], replace: true }]);
    expect(service.pendingEvents(3)).toBe(1);
  });

  it('keeps the session when the engine refuses an input, logging and reporting it', async () => {
    const captureError = vi.spyOn(
      TestBed.inject(AnalyticsService),
      'captureError'
    );
    const logError = vi.spyOn(TestBed.inject(LoggingService), 'error');
    await service.startSession(DESCRIPTOR, hooks);
    const event = { state: [true] };

    // One event past what an input holds: the engine queues none of it.
    service.submitInput([
      { comp: 3, frames: new Array(INPUT_QUEUE_LIMIT + 1).fill(event) }
    ]);
    await vi.waitFor(() => expect(captureError).toHaveBeenCalledOnce());

    expect(hooks.onError).not.toHaveBeenCalled();
    expect(captureError.mock.calls[0][2]).toMatchObject({
      source: 'inputRefused'
    });
    expect(logError).toHaveBeenCalledOnce();
    expect(service.pendingEvents(3)).toBe(0);
    service.submitInput([{ comp: 3, frames: [event] }]);
    await service.step();
    expect(fakeWorker.engine.output(3)).toBe(true);
  });

  it('pulls no snapshot for a state frame sent while paused', async () => {
    await service.startSession(DESCRIPTOR, hooks);

    service.submitInput([
      { comp: 3, frames: [{ state: [true], coalesce: true }] }
    ]);
    expect(fakeWorker.postedOfKind('requestSnapshot')).toHaveLength(0);

    service.submitInput([{ comp: 3, frames: [], replace: true }]);
    expect(fakeWorker.postedOfKind('requestSnapshot')).toHaveLength(1);
  });

  it('reports worker faults to error tracking, but not session teardown', async () => {
    const captureError = vi.spyOn(
      TestBed.inject(AnalyticsService),
      'captureError'
    );
    await service.startSession(DESCRIPTOR, hooks);

    // Caught and shown as a toast, so `GlobalErrorHandler` never sees it.
    fakeWorker.emit({ kind: 'error', reqId: null, message: 'engine died' });
    expect(captureError).toHaveBeenCalledOnce();
    expect(captureError.mock.calls[0][0]).toMatchObject({
      message: 'engine died'
    });

    captureError.mockClear();
    service.endSession();
    expect(captureError).not.toHaveBeenCalled();
  });

  it('reports the untranslated reason behind a coded engine failure', async () => {
    const captureError = vi.spyOn(
      TestBed.inject(AnalyticsService),
      'captureError'
    );
    await service.startSession(DESCRIPTOR, hooks);

    const detail =
      'Failed to initialize the simulation engine: CompileError: expected magic word';
    fakeWorker.emit({
      kind: 'error',
      reqId: null,
      code: 'engineInitFailed',
      message: detail
    });

    // The message is the localised catch-all toast text; what names the reason
    // rides along as properties.
    const [error, , properties] = captureError.mock.calls[0];
    expect((error as Error).message).not.toContain('CompileError');
    expect(properties).toEqual({
      source: 'workerError',
      code: 'engineInitFailed',
      detail
    });
  });

  it('drops user inputs sent before the engine is initialized', async () => {
    autoRespond = false;
    const session = service.startSession(DESCRIPTOR, hooks);
    fakeWorker.emit({ kind: 'ready' });
    await vi.waitFor(() =>
      expect(fakeWorker.postedOfKind('init')).toHaveLength(1)
    );

    // A switch tapped before the engine is up: reaching the worker, it would
    // fail there uncorrelated and take the session down.
    const writes = [{ comp: 3, frames: [{ state: [true], coalesce: true }] }];
    service.submitInput(writes);
    service.submitInput([{ comp: 3, frames: [], replace: true }]);
    expect(fakeWorker.postedOfKind('submitInput')).toHaveLength(0);

    fakeWorker.emit({
      kind: 'ok',
      reqId: fakeWorker.postedOfKind('init')[0].reqId
    });
    await session;

    service.submitInput(writes);
    expect(fakeWorker.postedOfKind('submitInput')).toHaveLength(1);
    expect(hooks.onError).not.toHaveBeenCalled();
  });

  it('serves a snapshot requested before the engine was up once it is', async () => {
    autoRespond = false;
    const session = service.startSession(DESCRIPTOR, hooks);
    fakeWorker.emit({ kind: 'ready' });
    await vi.waitFor(() =>
      expect(fakeWorker.postedOfKind('init')).toHaveLength(1)
    );

    // A watch applier registering while the session starts.
    service.requestSnapshot();
    expect(fakeWorker.postedOfKind('requestSnapshot')).toHaveLength(0);

    fakeWorker.emit({
      kind: 'ok',
      reqId: fakeWorker.postedOfKind('init')[0].reqId
    });
    await session;

    // Dropped, not lost: reissued, and still full — a fresh applier has no
    // baseline to apply a delta over.
    const requests = fakeWorker.postedOfKind('requestSnapshot');
    expect(requests).toHaveLength(1);
    expect(requests[0].full).toBe(true);
  });

  it('endSession terminates the worker and rejects in-flight requests', async () => {
    autoRespond = false;
    const session = service.startSession(DESCRIPTOR, hooks);
    fakeWorker.emit({ kind: 'ready' });
    await vi.waitFor(() =>
      expect(fakeWorker.postedOfKind('init')).toHaveLength(1)
    );

    service.endSession();

    await expect(session).rejects.toThrow('session ended');
    expect(fakeWorker.terminated).toBe(true);
  });

  describe('record watches', () => {
    const BOARD = recorderBoard(64);
    /** Lets every worker round trip in flight land. */
    const settle = () => new Promise((resolve) => setTimeout(resolve));

    /** Records `codes` through the board's input, stepping until done. */
    async function write(codes: readonly number[]): Promise<void> {
      service.submitInput([{ comp: 0, frames: byteFrames(codes) }]);
      for (let tick = 0; tick < byteTicks(codes.length); tick++) {
        await service.step();
      }
      await settle();
    }

    /** Every record a watch was handed, in order, with where each read began. */
    function collect(): {
      onRead: (first: number, values: Uint32Array) => void;
      firsts: number[];
      records: number[];
    } {
      const firsts: number[] = [];
      const records: number[] = [];
      return {
        firsts,
        records,
        onRead: (first, values) => {
          firsts.push(first);
          records.push(...values);
        }
      };
    }

    it('hands every record over once, in order, ahead of its own frame', async () => {
      let frames = 0;
      await service.startSession(BOARD, { ...hooks, onFrame: () => frames++ });
      const readAt: number[] = [];
      const records: number[] = [];
      let next = 0;
      service.watchRecords(RECORDER_UNIT, (first, values) => {
        expect(first).toBe(next);
        next = first + values.length;
        readAt.push(frames);
        records.push(...values);
      });
      const codes = [0x48, 0x69, 0x0a, 0xe9, 0x20, 0x7e];

      await write(codes.slice(0, 2));
      await write(codes.slice(2));

      expect(records).toEqual(codes);
      // Each read lands before the `onFrame` of the snapshot carrying it.
      const carrying = fakeWorker.snapshots.flatMap((snapshot, index) =>
        snapshot.records ? [index] : []
      );
      expect(readAt).toEqual(carrying);
    });

    it('delivers what a recorder already holds to a watch started while paused, with no step', async () => {
      await service.startSession(BOARD, hooks);
      await write([1, 2, 3]);
      const steps = fakeWorker.postedOfKind('step').length;
      const watch = collect();

      service.watchRecords(RECORDER_UNIT, watch.onRead);
      await settle();

      expect(watch.records).toEqual([1, 2, 3]);
      expect(fakeWorker.postedOfKind('step')).toHaveLength(steps);
    });

    it('reads for watches started before the engine was up once it is', async () => {
      const early = collect();
      service.watchRecords(RECORDER_UNIT, early.onRead);
      const session = service.startSession(BOARD, hooks);
      const starting = collect();
      service.watchRecords(RECORDER_UNIT, starting.onRead);
      await session;

      await write([7, 8]);

      expect(early.records).toEqual([7, 8]);
      expect(starting.records).toEqual([7, 8]);
    });

    it('reads a stopped engine from its first record again, and nothing once closed', async () => {
      await service.startSession(BOARD, hooks);
      const watch = collect();
      const handle = service.watchRecords(RECORDER_UNIT, watch.onRead);
      await write([1, 2]);

      await service.reset();
      await write([3]);
      expect(watch.firsts.at(-1)).toBe(0);
      expect(watch.records).toEqual([1, 2, 3]);

      handle.close();
      await write([4]);
      expect(watch.records).toEqual([1, 2, 3]);
      expect(fakeWorker.postedOfKind('unwatchRecords')).toHaveLength(1);
    });

    it('keeps no watch past the session', async () => {
      await service.startSession(BOARD, hooks);
      const watch = collect();
      service.watchRecords(RECORDER_UNIT, watch.onRead);
      service.endSession();

      await service.startSession(BOARD, hooks);
      await write([5]);

      expect(watch.records).toEqual([]);
      expect(fakeWorker.postedOfKind('watchRecords')).toHaveLength(0);
    });
  });
});
