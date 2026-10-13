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
import { FakeUserInput } from '../../testing/fake-user-input';
import { Point } from 'pixi.js';
import { Component } from '../components/component';
import { InputFrame } from '../components/component-inspection';
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
   * The level the engine latches `unit` at once the writes the worker's
   * queues have applied so far take effect; an input starts low.
   */
  const engineLevel = (unit: number): boolean => fakeWorker.engine.held(unit);

  /** Whether `unit` drives its output high after the last tick. */
  const engineOutput = (unit: number): boolean =>
    fakeWorker.engine.output(unit);

  /** Every unit write sent in a frame, as `[unit, event, state]`, in order. */
  const sent = () =>
    fakeWorker
      .sentWrites()
      .map(({ unit, event, state }) => [unit, event, state]);

  /** The kind of every frame sent, in order. */
  const sentKinds = () =>
    fakeWorker
      .postedOfKind('queueFrames')
      .flatMap((msg) => msg.frames.map((frame) => frame.kind));

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

  it('reports the distinct clock delays of the session board', async () => {
    project.addComponent(makeClock(10, 0, 0));
    project.addComponent(makeClock(1, 0, 4));
    project.addComponent(makeClock(10, 0, 8));
    await enterAndBoot();
    expect(service.clockDelays()).toEqual([1, 10]);

    service.exit();
    expect(service.clockDelays()).toEqual([]);
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
    expect(switchComp.isActive(0)).toBe(true);

    service.stop();

    await vi.waitFor(() =>
      expect(fakeWorker.postedOfKind('stop')).toHaveLength(1)
    );
    await vi.waitFor(() => expect(switchComp.isActive(0)).toBe(false));
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

  it('toggles a switch on canvas user input with a state frame on its own queue', async () => {
    const switchComp = makeSwitch();
    project.addComponent(switchComp);
    await enterAndBoot();
    const unit = service.board!.userInputs.get(switchComp.id)!;

    project.emitUserInput(switchComp);
    expect(switchComp.isActive(0)).toBe(true);
    expect(fakeWorker.postedOfKind('queueFrames')).toEqual([
      expect.objectContaining({
        queue: unit,
        frames: [{ kind: 'state', units: [[unit, 0, true]], counted: false }]
      })
    ]);

    project.emitUserInput(switchComp);
    expect(switchComp.isActive(0)).toBe(false);
    expect(sent()).toEqual([
      [unit, 0, true],
      [unit, 0, false]
    ]);
    expect(sentKinds()).toEqual(['state', 'state']);
  });

  it('shows a switch flipped several times while paused only in its final position', async () => {
    const switchComp = makeSwitch();
    project.addComponent(switchComp);
    await enterAndBoot();
    const unit = service.board!.userInputs.get(switchComp.id)!;

    /** Flips the switch `flips` times, then reads the next two steps. */
    const flipAndStep = (flips: number): boolean[] => {
      for (let flip = 0; flip < flips; flip++) {
        project.emitUserInput(switchComp);
      }
      const seen: boolean[] = [];
      for (let step = 0; step < 2; step++) {
        service.step();
        seen.push(engineOutput(unit));
      }
      return seen;
    };

    // The engine takes a write up on the next tick and drives it on the one
    // after, so a position shows from the second step.
    expect(flipAndStep(3)).toEqual([false, true]);
    expect(flipAndStep(3)).toEqual([true, false]);
    expect(flipAndStep(2)).toEqual([false, false]);
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

    it('is held from press to release, one event frame each way', async () => {
      await bootWithButton();

      project.emitUserInput(button, 'press');
      expect(button.isActive(0)).toBe(true);
      expect(sent()).toEqual([[unit, 0, true]]);

      project.emitUserInput(button, 'press'); // already held
      expect(sent()).toHaveLength(1);

      project.emitUserInput(button, 'release');
      expect(button.isActive(0)).toBe(false);
      project.emitUserInput(button, 'release'); // already released
      expect(sent()).toEqual([
        [unit, 0, true],
        [unit, 0, false]
      ]);
      expect(sentKinds()).toEqual(['event', 'event']);
    });

    it('reaches the circuit when tapped while paused, then lets go', async () => {
      await bootWithButton();

      project.emitUserInput(button, 'press');
      project.emitUserInput(button, 'release');

      const seen: boolean[] = [];
      for (let step = 0; step < 4; step++) {
        service.step();
        seen.push(engineOutput(unit));
      }
      expect(seen).toEqual([false, true, true, false]);
    });

    it('ignores a press while the engine is still starting', () => {
      button = makeButton();
      project.addComponent(button);
      service.enter();

      project.emitUserInput(button, 'press');
      project.emitUserInput(button, 'release');

      expect(button.isActive(0)).toBe(false);
      expect(fakeWorker.postedOfKind('queueFrames')).toHaveLength(0);
    });

    it('does not act on a tap, which cannot hold it', async () => {
      await bootWithButton();

      project.emitUserInput(button);

      expect(button.isActive(0)).toBe(false);
      expect(fakeWorker.postedOfKind('queueFrames')).toHaveLength(0);
    });

    it('is released by stop, against the rebuilt engine', async () => {
      await bootWithButton();
      project.emitUserInput(button, 'press');

      service.stop();
      await vi.waitFor(() => expect(button.isActive(0)).toBe(false));

      expect(engineLevel(unit)).toBe(false);
      // The hold's own release, arriving later, sends nothing further.
      const count = sent().length;
      project.emitUserInput(button, 'release');
      expect(sent()).toHaveLength(count);
    });

    it('never stays high after a press lands while a reset is in flight', async () => {
      await bootWithButton();

      service.stop();
      project.emitUserInput(button, 'press'); // reaches the rebuilt engine
      await vi.waitFor(() => expect(button.isActive(0)).toBe(false));

      // The press is an event and reaches the outputs; the reset's release
      // follows it there.
      const seen: boolean[] = [];
      for (let step = 0; step < 4; step++) {
        service.step();
        seen.push(engineOutput(unit));
      }
      expect(seen).toEqual([false, true, true, false]);
      expect(engineLevel(unit)).toBe(false);
    });

    it('is released by exit', async () => {
      await bootWithButton();
      project.emitUserInput(button, 'press');

      service.exit();

      expect(button.isActive(0)).toBe(false);
    });
  });

  describe('a hold input with several slots', () => {
    let input: FakeUserInput;
    let base: number;

    async function bootWithInput(): Promise<void> {
      // An AND with a lower id, so the input's units do not start at 0.
      project.addComponent(makeAnd(2, undefined, 8, 0));
      input = new FakeUserInput(3);
      project.addComponent(input);
      await enterAndBoot();
      base = service.board!.userInputs.get(input.id)!;
    }

    it('drives each slot through its own unit, once per change', async () => {
      await bootWithInput();

      project.emitUserInput(input, 'press', 2);
      project.emitUserInput(input, 'press', 2); // already held
      expect(fakeWorker.postedOfKind('queueFrames')).toEqual([
        expect.objectContaining({
          queue: base,
          frames: [
            { kind: 'event', units: [[base + 2, 0, true]], counted: false }
          ]
        })
      ]);
      expect(input.isActive(2)).toBe(true);
      expect(input.isActive(0)).toBe(false);

      expect(service.setUserInput(input.id, true, 0)).toBe(true);
      service.step();
      service.step();
      expect(engineLevel(base)).toBe(true);
      expect(engineLevel(base + 1)).toBe(false);
      expect(engineLevel(base + 2)).toBe(true);
    });

    it('refuses a slot the input does not have', async () => {
      await bootWithInput();

      project.emitUserInput(input, 'press', 3);
      expect(service.setUserInput(input.id, true, 3)).toBe(false);
      expect(service.setUserInput(input.id, true, -1)).toBe(false);

      expect(fakeWorker.postedOfKind('queueFrames')).toHaveLength(0);
      expect(input.isActive(3)).toBe(false);
    });

    it('has every held slot released by stop in one state frame, against the rebuilt engine', async () => {
      await bootWithInput();
      project.emitUserInput(input, 'press', 0);
      project.emitUserInput(input, 'press', 2);

      service.stop();
      await vi.waitFor(() => expect(input.isActive(2)).toBe(false));

      expect(input.isActive(0)).toBe(false);
      expect(fakeWorker.postedOfKind('queueFrames').at(-1)!.frames).toEqual([
        {
          kind: 'state',
          units: [
            [base, 0, false],
            [base + 2, 0, false]
          ],
          counted: false
        }
      ]);
      expect(engineLevel(base)).toBe(false);
      expect(engineLevel(base + 2)).toBe(false);
    });

    it('sets every slot in one state frame of the slots that change', async () => {
      await bootWithInput();
      project.emitUserInput(input, 'press', 1);
      fakeWorker.posted.length = 0;

      expect(service.setUserInputs(input.id, [true, true, true])).toBe(true);

      expect(fakeWorker.postedOfKind('queueFrames')).toEqual([
        expect.objectContaining({
          frames: [
            {
              kind: 'state',
              units: [
                [base, 0, true],
                [base + 2, 0, true]
              ],
              counted: false
            }
          ]
        })
      ]);
      expect([0, 1, 2].map((slot) => input.isActive(slot))).toEqual([
        true,
        true,
        true
      ]);
    });

    it('refuses a value list that is not one per slot, writing nothing', async () => {
      await bootWithInput();

      expect(service.setUserInputs(input.id, [true, true])).toBe(false);
      expect(service.setUserInputs(input.id, [true, true, true, true])).toBe(
        false
      );

      expect(fakeWorker.postedOfKind('queueFrames')).toHaveLength(0);
      expect(input.isActive(0)).toBe(false);
    });
  });

  describe('a slot, by drive and gesture', () => {
    let base: number;

    /** Boots a 3-slot input of the given kind, its units not starting at 0. */
    async function bootWith(input: FakeUserInput): Promise<void> {
      project.addComponent(makeAnd(2, undefined, 8, 0));
      project.addComponent(input);
      await enterAndBoot();
      base = service.board!.userInputs.get(input.id)!;
    }

    it('sets a level slot absolutely, sending nothing when it is already there', async () => {
      const input = new FakeUserInput(3, { gesture: 'toggle' });
      await bootWith(input);

      expect(service.setUserInput(input.id, true, 1)).toBe(true);
      expect(service.setUserInput(input.id, true, 1)).toBe(true);
      expect(service.setUserInput(input.id, false, 1)).toBe(true);

      expect(sent()).toEqual([
        [base + 1, 0, true],
        [base + 1, 0, false]
      ]);
    });

    it('pulses a pulse slot on every true and ignores false', async () => {
      const input = new FakeUserInput(3, { drive: 'pulse', gesture: 'tap' });
      await bootWith(input);

      expect(service.setUserInput(input.id, false, 1)).toBe(true);
      expect(service.setUserInput(input.id, true, 1)).toBe(true);
      expect(service.setUserInput(input.id, true, 1)).toBe(true);

      expect(sent()).toEqual([
        [base + 1, 1, true],
        [base + 1, 1, true]
      ]);
    });

    it('flips only the tapped slot of a toggle input', async () => {
      const input = new FakeUserInput(3, { gesture: 'toggle' });
      await bootWith(input);

      project.emitUserInput(input, 'tap', 1);
      expect([0, 1, 2].map((slot) => input.isActive(slot))).toEqual([
        false,
        true,
        false
      ]);
      project.emitUserInput(input, 'tap', 1);

      expect(input.isActive(1)).toBe(false);
      expect(sent()).toEqual([
        [base + 1, 0, true],
        [base + 1, 0, false]
      ]);
      expect(sentKinds()).toEqual(['state', 'state']);
    });

    it('holds a hold slot with event frames', async () => {
      const input = new FakeUserInput(3);
      await bootWith(input);

      project.emitUserInput(input, 'press', 1);
      project.emitUserInput(input, 'release', 1);

      expect(sentKinds()).toEqual(['event', 'event']);
    });

    it('gives two pulses for two taps between ticks', async () => {
      const input = new FakeUserInput(3, { drive: 'pulse', gesture: 'tap' });
      await bootWith(input);

      project.emitUserInput(input, 'tap', 1);
      project.emitUserInput(input, 'tap', 1);
      expect(sentKinds()).toEqual(['event', 'event']);

      const seen: boolean[] = [];
      for (let tick = 0; tick < 5; tick++) {
        service.step();
        seen.push(engineOutput(base + 1));
      }
      expect(seen).toEqual([false, true, false, true, false]);
    });

    it('sends one pulse for a tap on a pulse slot and clears it after the flash', async () => {
      const input = new FakeUserInput(3, { drive: 'pulse', gesture: 'tap' });
      await bootWith(input);
      vi.useFakeTimers();
      try {
        project.emitUserInput(input, 'tap', 1);
        expect(input.isActive(1)).toBe(true);
        expect(sent()).toEqual([[base + 1, 1, true]]);

        vi.runAllTimers();
        expect(input.isActive(1)).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('has a toggled-on level slot set low by stop, against the rebuilt engine', async () => {
      const input = new FakeUserInput(3, { gesture: 'toggle' });
      await bootWith(input);
      project.emitUserInput(input, 'tap', 1);

      service.stop();
      await vi.waitFor(() => expect(input.isActive(1)).toBe(false));

      const posted = fakeWorker.posted;
      const rebuilt = posted.map((msg) => msg.kind).lastIndexOf('stop');
      expect(posted.slice(rebuilt + 1)).toContainEqual(
        expect.objectContaining({
          kind: 'queueFrames',
          frames: [
            { kind: 'state', units: [[base + 1, 0, false]], counted: false }
          ]
        })
      );
    });

    it('never leaves a slot toggled while a reset is in flight high', async () => {
      const input = new FakeUserInput(3, { gesture: 'toggle' });
      await bootWith(input);

      service.stop();
      project.emitUserInput(input, 'tap', 1); // reaches the rebuilt engine
      await vi.waitFor(() => expect(input.isActive(1)).toBe(false));

      expect(engineLevel(base + 1)).toBe(false);
    });
  });

  describe('setUserInput', () => {
    it('sets a switch absolutely, sending no event when already there', async () => {
      const switchComp = makeSwitch();
      project.addComponent(switchComp);
      await enterAndBoot();

      const unit = service.board!.userInputs.get(switchComp.id)!;
      expect(service.setUserInput(switchComp.id, true)).toBe(true);
      expect(switchComp.isActive(0)).toBe(true);
      expect(sent()).toHaveLength(1);

      // Repeating an absolute value sends no second engine event.
      expect(service.setUserInput(switchComp.id, true)).toBe(true);
      expect(switchComp.isActive(0)).toBe(true);
      expect(sent()).toHaveLength(1);

      expect(service.setUserInput(switchComp.id, false)).toBe(true);
      expect(switchComp.isActive(0)).toBe(false);
      expect(sent()).toEqual([
        [unit, 0, true],
        [unit, 0, false]
      ]);
      expect(sentKinds()).toEqual(['state', 'state']);
    });

    it('holds a button on true and releases it on false, absolutely', async () => {
      const button = makeButton();
      project.addComponent(button);
      await enterAndBoot();
      const unit = service.board!.userInputs.get(button.id)!;

      expect(service.setUserInput(button.id, false)).toBe(true);
      expect(sent()).toHaveLength(0);

      expect(service.setUserInput(button.id, true)).toBe(true);
      expect(service.setUserInput(button.id, true)).toBe(true);
      expect(button.isActive(0)).toBe(true);
      expect(sent()).toHaveLength(1);
      expect(engineLevel(unit)).toBe(true);

      expect(service.setUserInput(button.id, false)).toBe(true);
      expect(button.isActive(0)).toBe(false);
      expect(engineLevel(unit)).toBe(false);
    });

    it('pulses a pulse button on true and ignores false', async () => {
      const button = makePulseButton();
      project.addComponent(button);
      await enterAndBoot();

      expect(service.setUserInput(button.id, false)).toBe(true);
      expect(sent()).toHaveLength(0);

      expect(service.setUserInput(button.id, true)).toBe(true);
      expect(sent()).toEqual([
        [service.board!.userInputs.get(button.id)!, 1, true]
      ]);
    });

    it('reports a component that is not a user input of this session', async () => {
      const and = makeAnd(2, undefined, 10, 10);
      project.addComponent(and);
      await enterAndBoot();

      expect(service.setUserInput(and.id, true)).toBe(false);
      expect(service.setUserInput(999999, true)).toBe(false);
    });

    it('refuses a slot past 0 on a lever, which has only one', async () => {
      const switchComp = makeSwitch();
      project.addComponent(switchComp);
      await enterAndBoot();

      expect(service.setUserInput(switchComp.id, true, 1)).toBe(false);
      expect(switchComp.isActive(0)).toBe(false);
      expect(sent()).toHaveLength(0);
    });
  });

  describe('frames sent to a component', () => {
    let input: FakeUserInput;
    let base: number;

    async function bootWithInput(): Promise<void> {
      project.addComponent(makeAnd(2, undefined, 8, 0));
      input = new FakeUserInput(3);
      project.addComponent(input);
      await enterAndBoot();
      base = service.board!.userInputs.get(input.id)!;
    }

    const press: InputFrame = {
      kind: 'event',
      writes: [
        { slot: 0, drive: 'level', value: true },
        { slot: 2, drive: 'pulse', value: true }
      ],
      counted: true
    };
    const release: InputFrame = {
      kind: 'event',
      writes: [{ slot: 0, drive: 'level', value: false }]
    };

    it('reach the units the slots and drives name, leaving the slot state alone', async () => {
      await bootWithInput();

      expect(service.sendFrames(input.id, [press, release])).toBe(true);

      expect(fakeWorker.postedOfKind('queueFrames')).toEqual([
        expect.objectContaining({
          queue: base,
          frames: [
            {
              kind: 'event',
              units: [
                [base, 0, true],
                [base + 2, 1, true]
              ],
              counted: true
            },
            { kind: 'event', units: [[base, 0, false]], counted: false }
          ]
        })
      ]);
      expect(input.isActive(0)).toBe(false);
    });

    it('are refused whole when one write addresses a slot past the outputs', async () => {
      await bootWithInput();
      const stray: InputFrame = {
        kind: 'state',
        writes: [{ slot: 3, drive: 'level', value: true }]
      };

      expect(service.sendFrames(input.id, [press, stray])).toBe(false);
      expect(service.cancelFrames(input.id, stray)).toBe(false);
      expect(service.sendFrames(input.id, [press])).toBe(true);

      expect(fakeWorker.postedOfKind('queueFrames')).toHaveLength(1);
      expect(fakeWorker.postedOfKind('clearFrames')).toHaveLength(0);
    });

    it('are dropped before the engine is ready', () => {
      input = new FakeUserInput(3);
      project.addComponent(input);
      service.enter();

      service.sendFrames(input.id, [press]);

      expect(fakeWorker.postedOfKind('queueFrames')).toHaveLength(0);
    });

    it('are counted while queued and dropped by a cancel, which applies its reset', async () => {
      await bootWithInput();

      service.sendFrames(input.id, [press, release, press, release]);
      // The first press applied on arrival; one counted frame is left.
      await vi.waitFor(() => expect(service.pendingFrames(input.id)).toBe(1));

      expect(service.cancelFrames(input.id, release)).toBe(true);
      expect(service.pendingFrames(input.id)).toBe(0);
      service.step();
      service.step();
      expect(engineOutput(base)).toBe(false);
      expect(fakeWorker.engine.writes.map((write) => write.state)).toEqual([
        true,
        true,
        false
      ]);
    });
  });

  it('flashes a pulse button on canvas user input and forwards a Pulse event', async () => {
    const button = makePulseButton();
    project.addComponent(button);
    await enterAndBoot();
    vi.useFakeTimers();
    try {
      project.emitUserInput(button);
      expect(button.isActive(0)).toBe(true);

      expect(fakeWorker.sentWrites()).toEqual([
        expect.objectContaining({ kind: 'event', event: 1, state: true })
      ]);

      vi.runAllTimers();
      expect(button.isActive(0)).toBe(false);
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
    expect(switchComp.isActive(0)).toBe(false);
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
    expect(switchComp.isActive(0)).toBe(false);
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

    expect(switchComp.isActive(0)).toBe(false);
  });
});
