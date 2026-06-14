import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../../testing/configure-test-bed';
import {
  FakeSimulationWorker,
  ManualFrameScheduler
} from '../../../testing/fake-simulation-worker';
import { LinkStateApplier } from '../state/link-state-applier';
import { packSnapshot } from './protocol';
import {
  FRAME_SCHEDULER,
  SIMULATION_WORKER_FACTORY,
  SimulationSessionHooks,
  SimulationWorkerService
} from './simulation-worker.service';

const DESCRIPTOR = {
  links: 1,
  components: [{ type: 201, inputs: [], outputs: [0] }]
};

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

    // The response has not arrived yet — a second frame must not stack
    // another request.
    scheduler.fire();
    expect(fakeWorker.postedOfKind('requestSnapshot')).toHaveLength(1);

    // After the response is applied, the next frame requests again.
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

    // In-flight snapshot also skips the tick, capping at the frame rate.
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

    // Idle session (no run started): the snapshot triggers a repaint.
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
    // An empty delta (nothing changed since the last poll) must be a no-op:
    // it once fell through to applyFull with an empty buffer, reading every
    // link as 0 and clearing the board on every quiescent frame.
    const wire = { setPowered: vi.fn() };
    const realApplier = new LinkStateApplier([
      { wires: [wire], ports: [] }
    ] as unknown as ConstructorParameters<typeof LinkStateApplier>[0]);
    const applyFullSpy = vi.spyOn(realApplier, 'applyFull');
    await service.startSession(DESCRIPTOR, { ...hooks, applier: realApplier });

    // A non-empty delta powers link 0.
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

    // An empty delta must not touch the link: no applyFull, link stays on.
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

  it('computes the measured rate from consecutive status reports', async () => {
    await service.startSession(DESCRIPTOR, hooks);

    const now = vi.spyOn(performance, 'now');
    now.mockReturnValue(1000);
    fakeWorker.emit({
      kind: 'status',
      reqId: 1,
      tick: 100,
      componentCount: 1,
      linkCount: 1
    });
    expect(service.measuredHz()).toBe(0);

    now.mockReturnValue(2000);
    fakeWorker.emit({
      kind: 'status',
      reqId: 2,
      tick: 5100,
      componentCount: 1,
      linkCount: 1
    });
    expect(service.measuredHz()).toBe(5000);
    expect(service.tick()).toBe(5100);
  });

  it('pause interrupts the run and flushes one final snapshot', async () => {
    await service.startSession(DESCRIPTOR, hooks);
    await service.start('continuous', 1000);

    await service.pause();

    expect(fakeWorker.postedOfKind('pause')).toHaveLength(1);
    expect(fakeWorker.postedOfKind('requestSnapshot')).toHaveLength(1);
    expect(service.measuredHz()).toBe(0);

    // The flushed snapshot arrives while idle — repaint must fire.
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

  it('forwards user inputs fire-and-forget', async () => {
    await service.startSession(DESCRIPTOR, hooks);

    service.triggerInput(3, 0, [true]);

    const inputs = fakeWorker.postedOfKind('triggerInput');
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toMatchObject({
      componentIndex: 3,
      event: 0,
      state: [true]
    });
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
});
