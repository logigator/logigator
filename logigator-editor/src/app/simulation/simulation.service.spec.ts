import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import {
  makeAnd,
  makeButton,
  makeNot,
  makeSwitch
} from '../../testing/factories';
import {
  FakeSimulationWorker,
  ManualFrameScheduler
} from '../../testing/fake-simulation-worker';
import { Point } from 'pixi.js';
import { Component } from '../components/component';
import { ComponentProviderService } from '../components/component-provider.service';
import { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import { ToastService } from '../logging/toast.service';
import { EditorSettingsService } from '../settings/editor-settings.service';
import { Project } from '../project/project';
import { Wire } from '../wires/wire';
import { WireDirection } from '../wires/wire-direction.enum';
import { ProjectService } from '../project/project.service';
import { WorkMode } from '../work-mode/work-mode.enum';
import { WorkModeService } from '../work-mode/work-mode.service';
import { SimulationService } from './simulation.service';
import { TOP_LEVEL_PATH } from './compiler/compiled-board.model';
import { packSnapshot } from './worker/protocol';
import {
  FRAME_SCHEDULER,
  SIMULATION_WORKER_FACTORY
} from './worker/simulation-worker.service';

/** Wire spanning the two given half-grid termination points (axis-aligned). */
function wireBetween(a: Point, b: Point): Wire {
  const horizontal = a.y === b.y;
  const wire = new Wire(
    horizontal ? WireDirection.HORIZONTAL : WireDirection.VERTICAL,
    horizontal ? Math.abs(b.x - a.x) : Math.abs(b.y - a.y)
  );
  wire.position.set(Math.min(a.x, b.x), Math.min(a.y, b.y));
  return wire;
}

describe('SimulationService', () => {
  let service: SimulationService;
  let workModeService: WorkModeService;
  let toastService: ToastService;
  let project: Project;
  let fakeWorker: FakeSimulationWorker;

  beforeEach(() => {
    configureTestBed([
      {
        provide: SIMULATION_WORKER_FACTORY,
        useValue: () => {
          fakeWorker = new FakeSimulationWorker();
          return fakeWorker.asWorker();
        }
      },
      { provide: FRAME_SCHEDULER, useValue: new ManualFrameScheduler() }
    ]);
    service = TestBed.inject(SimulationService);
    workModeService = TestBed.inject(WorkModeService);
    toastService = TestBed.inject(ToastService);
    // These tests drive the run controls by hand and assert on a paused boot;
    // keep auto-start off (its own test below covers the on path).
    TestBed.inject(EditorSettingsService).autoStartSimulation.set(false);
    project = new Project();
    TestBed.inject(ProjectService).setMainProject(project);
  });

  afterEach(() => {
    service.exit();
    project.destroy({ children: true });
  });

  /** enter() plus the worker boot round-trip (ready → init → ok). */
  async function enterAndBoot(): Promise<void> {
    service.enter();
    await vi.waitFor(() => expect(service.state()).toBe('ready'));
  }

  it('enters simulation mode with a compilable circuit', () => {
    project.addComponent(makeAnd(2, undefined, 0, 0));

    service.enter();

    expect(workModeService.mode()).toBe(WorkMode.SIMULATION);
    expect(service.board).not.toBeNull();
    expect(service.applier).not.toBeNull();
    expect(service.state()).toBe('starting');
  });

  it('switches to the main project before entering simulation', () => {
    project.addComponent(makeAnd(2, undefined, 0, 0));
    const projectService = TestBed.inject(ProjectService);
    const componentEditor = new Project();
    projectService.addOpenComponent(componentEditor);
    projectService.setActiveProject(componentEditor);

    service.enter();

    expect(projectService.activeProject()).toBe(project);
    expect(workModeService.mode()).toBe(WorkMode.SIMULATION);

    componentEditor.destroy({ children: true });
  });

  it('reaches ready once the worker session is up', async () => {
    project.addComponent(makeAnd(2, undefined, 0, 0));

    await enterAndBoot();

    expect(service.isReady()).toBe(true);
    const inits = fakeWorker.postedOfKind('init');
    expect(inits).toHaveLength(1);
    expect(inits[0].descriptor).toEqual(service.board!.descriptor);
  });

  it('auto-starts the run after boot when the setting is on', async () => {
    TestBed.inject(EditorSettingsService).autoStartSimulation.set(true);
    project.addComponent(makeSwitch());

    service.enter();

    await vi.waitFor(() => expect(service.isRunning()).toBe(true));
  });

  it('refuses to enter on diagnostics and reports via toast', () => {
    const error = vi.spyOn(toastService, 'error');
    // A custom whose circuit has no plugs but declares one port compiles to a
    // blocking plug-mismatch diagnostic.
    const broken = TestBed.inject(CustomComponentRegistry).registerSnapshot({
      kind: 'snapshot',
      source: 'browser',
      name: 'Broken',
      symbol: 'B',
      description: '',
      numInputs: 1,
      numOutputs: 0,
      labels: ['A'],
      circuit: { components: [], wires: [] }
    });
    const config = TestBed.inject(ComponentProviderService).getComponent(
      broken
    )!;
    project.addComponent(
      Component.deserialize({ pos: [0, 0], options: {} }, config)
    );
    const previousMode = workModeService.mode();

    service.enter();

    expect(workModeService.mode()).toBe(previousMode);
    expect(error).toHaveBeenCalledOnce();
  });

  it('leaves simulation mode and reports when the worker fails fatally', async () => {
    const error = vi.spyOn(toastService, 'error');
    project.addComponent(makeAnd(2, undefined, 0, 0));
    await enterAndBoot();

    fakeWorker.emit({ kind: 'error', reqId: null, message: 'engine died' });

    expect(workModeService.mode()).toBe(WorkMode.PAN);
    expect(service.state()).toBe('inactive');
    expect(error).toHaveBeenCalledWith('engine died', 'SimulationService');
  });

  it('runs through play/pause and tracks the run state', async () => {
    project.addComponent(makeSwitch());
    await enterAndBoot();

    service.play();
    expect(service.isRunning()).toBe(true);
    // Default mode is sync-to-frame: the worker idles, frames drive ticks.
    expect(fakeWorker.postedOfKind('start')).toHaveLength(0);

    await vi.waitFor(() =>
      expect(fakeWorker.postedOfKind('pause')).toHaveLength(1)
    );

    service.pause();
    expect(service.isRunning()).toBe(false);
    expect(service.state()).toBe('ready');
  });

  it('starts a worker-paced run when sync mode is off', async () => {
    project.addComponent(makeSwitch());
    await enterAndBoot();
    service.toggleSyncMode(); // off → continuous

    service.play();

    await vi.waitFor(() =>
      expect(fakeWorker.postedOfKind('start')).toHaveLength(1)
    );
    expect(fakeWorker.postedOfKind('start')[0].config).toEqual({
      mode: 'continuous'
    });
  });

  it('re-paces a running target-mode simulation when the rate changes', async () => {
    project.addComponent(makeSwitch());
    await enterAndBoot();
    service.toggleTargetMode();
    expect(service.mode()).toBe('target');

    service.play();
    await vi.waitFor(() =>
      expect(fakeWorker.postedOfKind('start')).toHaveLength(1)
    );
    expect(fakeWorker.postedOfKind('start')[0].config).toEqual({
      mode: 'target',
      hz: 1000
    });

    service.setTargetValue(250);
    await vi.waitFor(() =>
      expect(fakeWorker.postedOfKind('start')).toHaveLength(2)
    );
    expect(fakeWorker.postedOfKind('start')[1].config).toEqual({
      mode: 'target',
      hz: 250
    });
  });

  it('re-paces with the unit multiplier when the unit changes', async () => {
    project.addComponent(makeSwitch());
    await enterAndBoot();
    service.toggleTargetMode();
    service.setTargetValue(5);

    service.play();
    await vi.waitFor(() =>
      expect(fakeWorker.postedOfKind('start')).toHaveLength(1)
    );
    expect(fakeWorker.postedOfKind('start')[0].config).toEqual({
      mode: 'target',
      hz: 5
    });

    // 5 read in kHz is 5000 Hz; the typed value is kept, not converted.
    service.setTargetUnit('kHz');
    await vi.waitFor(() =>
      expect(fakeWorker.postedOfKind('start')).toHaveLength(2)
    );
    expect(service.targetValue()).toBe(5);
    expect(service.targetHz()).toBe(5000);
    expect(fakeWorker.postedOfKind('start')[1].config).toEqual({
      mode: 'target',
      hz: 5000
    });
  });

  it('ignores invalid target-speed input so the box is not rewritten mid-edit', () => {
    service.setTargetValue(0);
    expect(service.targetValue()).toBe(1000);
    service.setTargetValue(Number.NaN);
    expect(service.targetValue()).toBe(1000);
    service.setTargetValue(-5);
    expect(service.targetValue()).toBe(1000);
  });

  it('steps only while paused', async () => {
    project.addComponent(makeSwitch());
    await enterAndBoot();

    service.step();
    await vi.waitFor(() =>
      expect(fakeWorker.postedOfKind('step')).toHaveLength(1)
    );

    service.play();
    service.step();
    expect(fakeWorker.postedOfKind('step')).toHaveLength(1);
  });

  it('stop resets the engine and clears sim visuals', async () => {
    const switchComp = makeSwitch();
    project.addComponent(switchComp);
    await enterAndBoot();
    project.emitUserInput(switchComp);
    expect(switchComp.isOn).toBe(true);

    service.stop();

    await vi.waitFor(() =>
      expect(fakeWorker.postedOfKind('stop')).toHaveLength(1)
    );
    await vi.waitFor(() => expect(switchComp.isOn).toBe(false));
    expect(service.state()).toBe('ready');
  });

  it('toggles a switch on canvas user input and forwards a Cont event', async () => {
    const switchComp = makeSwitch();
    project.addComponent(switchComp);
    await enterAndBoot();

    project.emitUserInput(switchComp);
    expect(switchComp.isOn).toBe(true);

    const inputs = fakeWorker.postedOfKind('triggerInput');
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toMatchObject({ event: 0, state: [true] });
    expect(inputs[0].componentIndex).toBe(
      service.board!.userInputs.get(switchComp.id)
    );

    project.emitUserInput(switchComp);
    expect(switchComp.isOn).toBe(false);
    expect(fakeWorker.postedOfKind('triggerInput')[1]).toMatchObject({
      event: 0,
      state: [false]
    });
  });

  describe('setUserInput', () => {
    it('sets a switch absolutely, sending no event when already there', async () => {
      const switchComp = makeSwitch();
      project.addComponent(switchComp);
      await enterAndBoot();

      expect(service.setUserInput(switchComp.id, true)).toBe(true);
      expect(switchComp.isOn).toBe(true);
      expect(fakeWorker.postedOfKind('triggerInput')).toHaveLength(1);

      // Repeating the same absolute value is a no-op — no second engine event.
      expect(service.setUserInput(switchComp.id, true)).toBe(true);
      expect(switchComp.isOn).toBe(true);
      expect(fakeWorker.postedOfKind('triggerInput')).toHaveLength(1);

      expect(service.setUserInput(switchComp.id, false)).toBe(true);
      expect(switchComp.isOn).toBe(false);
      expect(fakeWorker.postedOfKind('triggerInput')[1]).toMatchObject({
        event: 0,
        state: [false]
      });
    });

    it('pulses a button on true and ignores false', async () => {
      const button = makeButton();
      project.addComponent(button);
      await enterAndBoot();

      expect(service.setUserInput(button.id, false)).toBe(true);
      expect(fakeWorker.postedOfKind('triggerInput')).toHaveLength(0);

      expect(service.setUserInput(button.id, true)).toBe(true);
      expect(fakeWorker.postedOfKind('triggerInput')[0]).toMatchObject({
        event: 1,
        state: [true]
      });
    });

    it('reports a component that is not a user input of this session', async () => {
      const and = makeAnd(2, undefined, 10, 10);
      project.addComponent(and);
      await enterAndBoot();

      expect(service.setUserInput(and.id, true)).toBe(false);
      expect(service.setUserInput(999999, true)).toBe(false);
    });
  });

  it('flashes a button on canvas user input and forwards a Pulse event', async () => {
    const button = makeButton();
    project.addComponent(button);
    await enterAndBoot();
    vi.useFakeTimers();
    try {
      project.emitUserInput(button);
      expect(button.pressed).toBe(true);

      const inputs = fakeWorker.postedOfKind('triggerInput');
      expect(inputs).toHaveLength(1);
      expect(inputs[0]).toMatchObject({ event: 1, state: [true] });

      vi.runAllTimers();
      expect(button.pressed).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('fans snapshots out to registered watch appliers, seeded by a full one', async () => {
    project.addComponent(makeSwitch());
    await enterAndBoot();
    const watch = { applyDelta: vi.fn(), applyFull: vi.fn() };

    const unregister = service.registerApplier(watch);
    service.requestSnapshot();

    // The seed request forces a full snapshot.
    const requests = fakeWorker.postedOfKind('requestSnapshot');
    expect(requests).toHaveLength(1);
    expect(requests[0].full).toBe(true);

    fakeWorker.emit({
      kind: 'snapshot',
      reqId: 99,
      tick: 1,
      isDelta: false,
      ...packSnapshot(undefined, null, new Uint8Array([0b1]))
    });
    expect(watch.applyFull).toHaveBeenCalledOnce();

    fakeWorker.emit({
      kind: 'snapshot',
      reqId: 100,
      tick: 2,
      isDelta: true,
      ...packSnapshot(
        undefined,
        new Uint8Array(new Uint32Array([0]).buffer),
        new Uint8Array([0])
      )
    });
    expect(watch.applyDelta).toHaveBeenCalledOnce();

    unregister();
    fakeWorker.emit({
      kind: 'snapshot',
      reqId: 101,
      tick: 3,
      isDelta: true,
      ...packSnapshot(
        undefined,
        new Uint8Array(new Uint32Array([0]).buffer),
        new Uint8Array([1])
      )
    });
    expect(watch.applyDelta).toHaveBeenCalledOnce();
  });

  it('completes the teardown when the visual reset throws', async () => {
    const and = makeAnd(2, undefined, 0, 0);
    const not = makeNot();
    not.position.set(10, 0);
    project.addComponent(and);
    project.addComponent(not);
    const wire = wireBetween(and.connectionPoints[2], not.connectionPoints[0]);
    project.addWire(wire);
    await enterAndBoot();

    // A powered wire freed under the live session: the mapping still addresses
    // it, so resetting its link writes to a destroyed PixiJS object.
    const targets = service.board!.mapping.get(TOP_LEVEL_PATH)!;
    const linkId = targets.findIndex((target) => target.wires.includes(wire));
    service.applier!.setLink(linkId, true);
    wire.destroy();

    expect(() => service.exit()).toThrow();

    expect(workModeService.mode()).toBe(WorkMode.PAN);
    expect(service.board).toBeNull();
    expect(service.applier).toBeNull();
    expect(service.state()).toBe('inactive');
  });

  it('drops watch appliers on exit', async () => {
    project.addComponent(makeSwitch());
    await enterAndBoot();
    const watch = { applyDelta: vi.fn(), applyFull: vi.fn() };
    service.registerApplier(watch);

    service.exit();
    await enterAndBoot();
    fakeWorker.emit({
      kind: 'snapshot',
      reqId: 99,
      tick: 1,
      isDelta: false,
      ...packSnapshot(undefined, null, new Uint8Array([0b1]))
    });

    expect(watch.applyFull).not.toHaveBeenCalled();
  });

  it('exit resets sim state and restores PAN mode', async () => {
    const switchComp = makeSwitch();
    project.addComponent(switchComp);
    await enterAndBoot();
    project.emitUserInput(switchComp);

    service.exit();

    expect(workModeService.mode()).toBe(WorkMode.PAN);
    expect(switchComp.isOn).toBe(false);
    expect(service.board).toBeNull();
    expect(service.applier).toBeNull();
    expect(service.state()).toBe('inactive');
    expect(fakeWorker.terminated).toBe(true);
  });

  it('leaves simulation when another project takes the main slot', async () => {
    const switchComp = makeSwitch();
    project.addComponent(switchComp);
    await enterAndBoot();
    project.emitUserInput(switchComp);
    const replacement = new Project();

    // Opening or creating a project; the outgoing one is destroyed right after.
    TestBed.inject(ProjectService).setMainProject(replacement);

    expect(workModeService.mode()).toBe(WorkMode.PAN);
    expect(service.state()).toBe('inactive');
    expect(service.board).toBeNull();
    // The teardown ran while the outgoing project was still live.
    expect(switchComp.isOn).toBe(false);
    expect(fakeWorker.terminated).toBe(true);

    replacement.destroy({ children: true });
  });

  it('keeps the session when the main project is re-set to itself', async () => {
    project.addComponent(makeSwitch());
    await enterAndBoot();

    TestBed.inject(ProjectService).setMainProject(project);

    expect(workModeService.mode()).toBe(WorkMode.SIMULATION);
    expect(service.isReady()).toBe(true);
  });

  it('ignores user input after exit', () => {
    const switchComp = makeSwitch();
    project.addComponent(switchComp);
    service.enter();
    service.exit();

    project.emitUserInput(switchComp);

    expect(switchComp.isOn).toBe(false);
  });
});
