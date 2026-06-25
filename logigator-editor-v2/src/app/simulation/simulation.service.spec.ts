import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { makeAnd, makeButton, makeLever } from '../../testing/factories';
import {
  FakeSimulationWorker,
  ManualFrameScheduler
} from '../../testing/fake-simulation-worker';
import { Component } from '../components/component';
import { ComponentProviderService } from '../components/component-provider.service';
import { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import { ToastService } from '../logging/toast.service';
import { Project } from '../project/project';
import { ProjectService } from '../project/project.service';
import { WorkMode } from '../work-mode/work-mode.enum';
import { WorkModeService } from '../work-mode/work-mode.service';
import { SimulationService } from './simulation.service';
import {
  FRAME_SCHEDULER,
  SIMULATION_WORKER_FACTORY
} from './worker/simulation-worker.service';

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

  it('reaches ready once the worker session is up', async () => {
    project.addComponent(makeAnd(2, undefined, 0, 0));

    await enterAndBoot();

    expect(service.isReady()).toBe(true);
    const inits = fakeWorker.postedOfKind('init');
    expect(inits).toHaveLength(1);
    expect(inits[0].descriptor).toEqual(service.board!.descriptor);
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
    expect(error).toHaveBeenCalledWith('engine died');
  });

  it('runs through play/pause and tracks the run state', async () => {
    project.addComponent(makeLever());
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
    project.addComponent(makeLever());
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
    project.addComponent(makeLever());
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
    project.addComponent(makeLever());
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
    project.addComponent(makeLever());
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
    const lever = makeLever();
    project.addComponent(lever);
    await enterAndBoot();
    project.emitUserInput(lever);
    expect(lever.isOn).toBe(true);

    service.stop();

    await vi.waitFor(() =>
      expect(fakeWorker.postedOfKind('stop')).toHaveLength(1)
    );
    await vi.waitFor(() => expect(lever.isOn).toBe(false));
    expect(service.state()).toBe('ready');
  });

  it('toggles a lever on canvas user input and forwards a Cont event', async () => {
    const lever = makeLever();
    project.addComponent(lever);
    await enterAndBoot();

    project.emitUserInput(lever);
    expect(lever.isOn).toBe(true);

    const inputs = fakeWorker.postedOfKind('triggerInput');
    expect(inputs).toHaveLength(1);
    expect(inputs[0]).toMatchObject({ event: 0, state: [true] });
    expect(inputs[0].componentIndex).toBe(
      service.board!.userInputs.get(lever.id)
    );

    project.emitUserInput(lever);
    expect(lever.isOn).toBe(false);
    expect(fakeWorker.postedOfKind('triggerInput')[1]).toMatchObject({
      event: 0,
      state: [false]
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

  it('exit resets sim state and restores PAN mode', async () => {
    const lever = makeLever();
    project.addComponent(lever);
    await enterAndBoot();
    project.emitUserInput(lever);

    service.exit();

    expect(workModeService.mode()).toBe(WorkMode.PAN);
    expect(lever.isOn).toBe(false);
    expect(service.board).toBeNull();
    expect(service.applier).toBeNull();
    expect(service.state()).toBe('inactive');
    expect(fakeWorker.terminated).toBe(true);
  });

  it('ignores user input after exit', () => {
    const lever = makeLever();
    project.addComponent(lever);
    service.enter();
    service.exit();

    project.emitUserInput(lever);

    expect(lever.isOn).toBe(false);
  });
});
