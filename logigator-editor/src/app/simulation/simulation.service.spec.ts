import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import {
  makeAnd,
  makeButton,
  makePulseButton,
  makeLed,
  makeNot,
  makeClock,
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
import { WireDirection } from '@logigator/core';
import { ProjectService } from '../project/project.service';
import { WorkMode } from '../work-mode/work-mode.enum';
import { WorkModeService } from '../work-mode/work-mode.service';
import { SimulationService } from './simulation.service';
import { TOP_LEVEL_PATH } from './compiler/compiled-board.model';
import { MIN_TARGET_HZ } from './worker/pacing';
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
    // These tests drive the run controls by hand and assert on a paused boot.
    TestBed.inject(EditorSettingsService).autoStartSimulation.set(false);
    project = new Project();
    TestBed.inject(ProjectService).setMainProject(project);
  });

  afterEach(() => {
    service.exit();
    project.destroy({ children: true });
  });

  /**
   * The level the engine holds `unit` at: the last Cont event it was sent for
   * it since its last rebuild, `false` if none — an input starts low.
   */
  function engineLevel(unit: number): boolean {
    const posted = fakeWorker.posted;
    const rebuilt = posted.map((msg) => msg.kind).lastIndexOf('stop');
    let level = false;
    for (const msg of posted.slice(rebuilt + 1)) {
      if (
        msg.kind === 'triggerInput' &&
        msg.componentIndex === unit &&
        msg.event === 0
      ) {
        level = msg.state[0];
      }
    }
    return level;
  }

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
    // No plugs but one declared port: a blocking plug-mismatch diagnostic.
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
    // Sync-to-frame is the default: the worker idles, frames drive ticks.
    expect(fakeWorker.postedOfKind('start')).toHaveLength(0);

    await vi.waitFor(() =>
      expect(fakeWorker.postedOfKind('pause')).toHaveLength(1)
    );

    service.pause();
    expect(service.isRunning()).toBe(false);
    expect(service.state()).toBe('ready');
  });

  it('starts a free run when as-fast-as-possible is chosen', async () => {
    project.addComponent(makeSwitch());
    await enterAndBoot();
    service.setMode('continuous');

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
    service.setMode('target');

    service.play();
    await vi.waitFor(() =>
      expect(fakeWorker.postedOfKind('start')).toHaveLength(1)
    );
    expect(fakeWorker.postedOfKind('start')[0].config).toEqual({
      mode: 'target',
      hz: 1000
    });

    service.setTargetHz(0.5);
    await vi.waitFor(() =>
      expect(fakeWorker.postedOfKind('start')).toHaveLength(2)
    );
    expect(fakeWorker.postedOfKind('start')[1].config).toEqual({
      mode: 'target',
      hz: 0.5
    });
  });

  it('switches a running sync-mode simulation to target mode when a speed is entered', async () => {
    project.addComponent(makeSwitch());
    await enterAndBoot();
    expect(service.mode()).toBe('sync');
    service.play();

    // The current rate re-entered still counts as asking for it.
    service.setTargetHz(1000);
    expect(service.mode()).toBe('target');
    await vi.waitFor(() =>
      expect(fakeWorker.postedOfKind('start')).toHaveLength(1)
    );
    expect(fakeWorker.postedOfKind('start')[0].config).toEqual({
      mode: 'target',
      hz: 1000
    });
  });

  it('ignores a rate that is not finite or below the slowest pace', () => {
    service.setTargetHz(MIN_TARGET_HZ / 2);
    service.setTargetHz(Number.NaN);
    service.setTargetHz(-5);
    expect(service.targetHz()).toBe(1000);
    expect(service.mode()).toBe('sync');

    service.setTargetHz(MIN_TARGET_HZ);
    expect(service.targetHz()).toBe(MIN_TARGET_HZ);
  });

  it('reports the distinct clock half-periods of the session board', async () => {
    project.addComponent(makeClock(10, 0, 0));
    project.addComponent(makeClock(1, 0, 4));
    project.addComponent(makeClock(10, 0, 8));
    await enterAndBoot();
    expect(service.clockHalfPeriods()).toEqual([1, 10]);

    service.exit();
    expect(service.clockHalfPeriods()).toEqual([]);
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

  it('lights a negated display for the length of the session', async () => {
    // The LED's net stays low throughout, so the engine reports nothing about
    // it: only the session's own start and end tell it to invert.
    const led = makeLed(4, 0);
    led.setPortNegated('in', 0, true);
    project.addComponent(led);
    project.addComponent(makeAnd(2, undefined, 0, 0));
    expect(led.isInputHigh(0)).toBe(false);

    await enterAndBoot();
    expect(led.isInputHigh(0)).toBe(true);

    service.stop();
    await vi.waitFor(() =>
      expect(fakeWorker.postedOfKind('stop')).toHaveLength(1)
    );
    expect(led.isInputHigh(0)).toBe(true);

    service.exit();
    expect(led.isInputHigh(0)).toBe(false);
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

  describe('a button', () => {
    let button: ReturnType<typeof makeButton>;
    let unit: number;

    async function bootWithButton(): Promise<void> {
      button = makeButton();
      project.addComponent(button);
      await enterAndBoot();
      unit = service.board!.userInputs.get(button.id)!;
    }

    it('is held from press to release, one Cont event each way', async () => {
      await bootWithButton();

      project.emitUserInput(button, 'press');
      expect(button.held).toBe(true);
      expect(fakeWorker.postedOfKind('triggerInput')).toEqual([
        expect.objectContaining({
          componentIndex: unit,
          event: 0,
          state: [true]
        })
      ]);

      project.emitUserInput(button, 'press'); // already held
      expect(fakeWorker.postedOfKind('triggerInput')).toHaveLength(1);

      project.emitUserInput(button, 'release');
      expect(button.held).toBe(false);
      project.emitUserInput(button, 'release'); // already released
      expect(fakeWorker.postedOfKind('triggerInput')).toHaveLength(2);
      expect(engineLevel(unit)).toBe(false);
    });

    it('ignores a press while the engine is still starting', () => {
      button = makeButton();
      project.addComponent(button);
      service.enter();

      project.emitUserInput(button, 'press');
      project.emitUserInput(button, 'release');

      expect(button.held).toBe(false);
      expect(fakeWorker.postedOfKind('triggerInput')).toHaveLength(0);
    });

    it('does not act on a tap, which cannot hold it', async () => {
      await bootWithButton();

      project.emitUserInput(button);

      expect(button.held).toBe(false);
      expect(fakeWorker.postedOfKind('triggerInput')).toHaveLength(0);
    });

    it('is released by stop, against the rebuilt engine', async () => {
      await bootWithButton();
      project.emitUserInput(button, 'press');

      service.stop();
      await vi.waitFor(() => expect(button.held).toBe(false));

      expect(engineLevel(unit)).toBe(false);
      // The hold's own release, arriving later, sends nothing further.
      const sent = fakeWorker.postedOfKind('triggerInput').length;
      project.emitUserInput(button, 'release');
      expect(fakeWorker.postedOfKind('triggerInput')).toHaveLength(sent);
    });

    it('never stays high after a press lands while a reset is in flight', async () => {
      await bootWithButton();

      service.stop();
      project.emitUserInput(button, 'press'); // reaches the rebuilt engine
      await vi.waitFor(() => expect(button.held).toBe(false));

      expect(engineLevel(unit)).toBe(false);
    });

    it('is released by exit', async () => {
      await bootWithButton();
      project.emitUserInput(button, 'press');

      service.exit();

      expect(button.held).toBe(false);
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

      // Repeating an absolute value sends no second engine event.
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

    it('holds a button on true and releases it on false, absolutely', async () => {
      const button = makeButton();
      project.addComponent(button);
      await enterAndBoot();
      const unit = service.board!.userInputs.get(button.id)!;

      expect(service.setUserInput(button.id, false)).toBe(true);
      expect(fakeWorker.postedOfKind('triggerInput')).toHaveLength(0);

      expect(service.setUserInput(button.id, true)).toBe(true);
      expect(service.setUserInput(button.id, true)).toBe(true);
      expect(button.held).toBe(true);
      expect(fakeWorker.postedOfKind('triggerInput')).toHaveLength(1);
      expect(engineLevel(unit)).toBe(true);

      expect(service.setUserInput(button.id, false)).toBe(true);
      expect(button.held).toBe(false);
      expect(engineLevel(unit)).toBe(false);
    });

    it('pulses a pulse button on true and ignores false', async () => {
      const button = makePulseButton();
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

  it('flashes a pulse button on canvas user input and forwards a Pulse event', async () => {
    const button = makePulseButton();
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

    // The outgoing project is destroyed right after this notification.
    TestBed.inject(ProjectService).setMainProject(replacement);

    expect(workModeService.mode()).toBe(WorkMode.PAN);
    expect(service.state()).toBe('inactive');
    expect(service.board).toBeNull();
    // The teardown ran while the outgoing project was live.
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
