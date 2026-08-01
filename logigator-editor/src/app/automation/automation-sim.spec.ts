import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { makeAnd, makeButton, makeSwitch } from '../../testing/factories';
import {
  FakeSimulationWorker,
  ManualFrameScheduler
} from '../../testing/fake-simulation-worker';
import { setStaticDIInjector } from '../utils/get-di';
import { Component } from '../components/component';
import { ComponentProviderService } from '../components/component-provider.service';
import { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import { EditorSettingsService } from '../settings/editor-settings.service';
import { Project } from '../project/project';
import { ProjectService } from '../project/project.service';
import { SimulationService } from '../simulation/simulation.service';
import { TOP_LEVEL_PATH } from '../simulation/compiler/compiled-board.model';
import {
  FRAME_SCHEDULER,
  SIMULATION_WORKER_FACTORY
} from '../simulation/worker/simulation-worker.service';
import { AutomationApiService } from './automation-api.service';
import { buildPortLinkIndex } from './port-index';

describe('AutomationApiService simulation', () => {
  let api: AutomationApiService;
  let simulation: SimulationService;
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
    setStaticDIInjector(TestBed.inject(Injector));
    api = TestBed.inject(AutomationApiService);
    simulation = TestBed.inject(SimulationService);
    TestBed.inject(EditorSettingsService).autoStartSimulation.set(false);
    project = new Project();
    TestBed.inject(ProjectService).setMainProject(project);
  });

  afterEach(() => {
    simulation.exit();
    project.destroy({ children: true });
  });

  it('enter resolves once the engine is ready', async () => {
    project.addComponent(makeSwitch());

    const status = await api.simEnter();

    expect(status.state).toBe('ready');
    expect(status.diagnostics).toBeUndefined();
  });

  it('enter reports the diagnostics that blocked entry instead of just refusing', async () => {
    const type = TestBed.inject(CustomComponentRegistry).registerSnapshot({
      kind: 'snapshot',
      source: 'browser',
      name: 'Hollow',
      symbol: 'H',
      description: '',
      numInputs: 0,
      numOutputs: 0,
      labels: []
    });
    const config = TestBed.inject(ComponentProviderService).getComponent(type)!;
    project.addComponent(
      Component.deserialize({ pos: [0, 0], options: {} }, config)
    );

    const status = await api.simEnter();

    expect(status.state).toBe('inactive');
    expect(status.diagnostics?.[0]).toMatchObject({ kind: 'missing-circuit' });
  });

  it('setInput drives a lever absolutely and is idempotent', async () => {
    const lever = makeSwitch();
    project.addComponent(lever);
    await api.simEnter();

    await api.simSetInput(lever.id, true);
    await api.simSetInput(lever.id, true);

    expect(lever.isOn).toBe(true);
    expect(fakeWorker.postedOfKind('triggerInput')).toHaveLength(1);
  });

  it('setInput rejects a component that is not a user input', async () => {
    const and = makeAnd(2, undefined, 5, 5);
    project.addComponent(and);
    await api.simEnter();

    await expect(api.simSetInput(and.id, true)).rejects.toThrow(/user input/);
  });

  it('setInput pulses a button', async () => {
    const button = makeButton();
    project.addComponent(button);
    await api.simEnter();

    await api.simSetInput(button.id, true);

    expect(fakeWorker.postedOfKind('triggerInput')[0]).toMatchObject({
      event: 1,
      state: [true]
    });
  });

  it('readPorts resolves against a freshly pulled snapshot', async () => {
    const lever = makeSwitch();
    project.addComponent(lever);
    await api.simEnter();
    const before = fakeWorker.postedOfKind('requestSnapshot').length;

    const readouts = await api.simReadPorts([lever.id]);

    expect(fakeWorker.postedOfKind('requestSnapshot').length).toBeGreaterThan(
      before
    );
    expect(readouts).toEqual([
      {
        componentId: lever.id,
        type: lever.config.type,
        inputs: [],
        outputs: [false]
      }
    ]);
  });

  it('readPorts reflects the powered links the applier holds', async () => {
    const lever = makeSwitch();
    project.addComponent(lever);
    await api.simEnter();

    // Power every link of the session directly through the applier — the same
    // entry point the worker bridge uses for a snapshot.
    const links = simulation.board!.mapping.get(TOP_LEVEL_PATH)!.length;
    for (let link = 0; link < links; link++) {
      simulation.applier!.setLink(link, true);
    }

    const [readout] = await api.simReadPorts([lever.id]);
    expect(readout.outputs).toEqual([true]);
  });

  it('readPorts refuses when no simulation is running', async () => {
    await expect(api.simReadPorts()).rejects.toThrow(/no simulation/);
  });

  it('readPorts covers every mapped component when none are named', async () => {
    const lever = makeSwitch();
    const and = makeAnd(2, undefined, 10, 10);
    project.addComponent(lever);
    project.addComponent(and);
    await api.simEnter();

    const ids = (await api.simReadPorts()).map((r) => r.componentId);
    expect(new Set(ids)).toEqual(
      new Set(buildPortLinkIndex(simulation.board!).keys())
    );
  });

  it('a frame that never arrives resolves the read instead of hanging', async () => {
    const lever = makeSwitch();
    project.addComponent(lever);
    await api.simEnter();
    // A worker that stops answering: the snapshot request goes unanswered.
    fakeWorker.autoRespond = false;

    vi.useFakeTimers();
    try {
      const pending = api.simReadPorts([lever.id]);
      await vi.advanceTimersByTimeAsync(2000);
      await expect(pending).resolves.toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
