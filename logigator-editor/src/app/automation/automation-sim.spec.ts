import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { KEYBOARD_STROBE_OUTPUT } from '@logigator/core';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import {
  makeAnd,
  makeButton,
  makeGamepad,
  makeKeyboard,
  makePulseButton,
  makeSwitch
} from '../../testing/factories';
import {
  FakeSimulationWorker,
  ManualFrameScheduler
} from '../../testing/fake-simulation-worker';
import { FakeUserInput } from '../../testing/fake-user-input';
import { setStaticDIInjector } from '../utils/get-di';
import { Component } from '../components/component';
import { ComponentProviderService } from '../components/component-provider.service';
import { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import { EditorSettingsService } from '../settings/editor-settings.service';
import { Project } from '../project/project';
import { ProjectService } from '../project/project.service';
import { SimulationService } from '../simulation/simulation.service';
import { TOP_LEVEL_PATH } from '../simulation/compiler/compiled-board.model';
import { InspectionService } from '../inspection/inspection.service';
import { KeyboardComponent } from '../components/component-types/keyboard/keyboard.component';
import { KeyboardInspection } from '../components/component-types/keyboard/keyboard-inspection';
import { codeFromBits } from '../components/component-types/keyboard/ascii';
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

  /** Every slot the frames sent to `unit` set, as `[slot, value]`, in order. */
  const slotWrites = (unit: number) =>
    fakeWorker
      .sentFrames()
      .filter((frame) => frame.comp === unit)
      .flatMap((frame) =>
        frame.state.flatMap((value, slot) =>
          value === null ? [] : [[slot, value]]
        )
      );

  it('enter resolves once the engine is ready', async () => {
    project.addComponent(makeSwitch());

    const status = await api.simEnter();

    expect(status.state).toBe('ready');
    expect(status.diagnostics).toBeUndefined();
  });

  it('enter resolves with a running session when auto-start is on', async () => {
    // The shipped default, so the documented pause → setInput → step recipe has
    // to work from a running session.
    TestBed.inject(EditorSettingsService).autoStartSimulation.set(true);
    const lever = makeSwitch();
    project.addComponent(lever);

    const status = await api.simEnter();
    expect(status.state).toBe('running');

    simulation.pause();
    expect(simulation.state()).toBe('ready');
    await api.simSetInput(lever.id, true);
    await api.simStep();
    expect(fakeWorker.postedOfKind('step').length).toBeGreaterThan(0);
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

  it('step runs a batch of ticks, then pulls the state after the last one', async () => {
    project.addComponent(makeSwitch());
    await api.simEnter();
    fakeWorker.posted.length = 0;

    await api.simStep(5);

    expect(fakeWorker.postedOfKind('step')).toHaveLength(5);
    // The pull is posted behind all five ticks, so it resolves with the state
    // after the last one — one pull, not one per tick.
    const kinds = fakeWorker.posted.map((message) => message.kind);
    expect(kinds.indexOf('requestSnapshot')).toBe(5);
    expect(
      kinds.filter((kind) => kind === 'requestSnapshot').length
    ).toBeLessThan(5);
  });

  it('step rejects a count that is not a whole number of ticks', async () => {
    project.addComponent(makeSwitch());
    await api.simEnter();

    await expect(api.simStep(0)).rejects.toThrow(/positive integer/);
    await expect(api.simStep(1.5)).rejects.toThrow(/positive integer/);
  });

  it('setInput drives a lever absolutely and is idempotent', async () => {
    const lever = makeSwitch();
    project.addComponent(lever);
    await api.simEnter();

    await api.simSetInput(lever.id, true);
    await api.simSetInput(lever.id, true);

    expect(lever.isActive(0)).toBe(true);
    expect(fakeWorker.sentFrames()).toHaveLength(1);
  });

  it('setInput rejects a component that is not a user input', async () => {
    const and = makeAnd(2, undefined, 5, 5);
    project.addComponent(and);
    await api.simEnter();

    await expect(api.simSetInput(and.id, true)).rejects.toThrow(/user input/);
  });

  it('setInput holds a button until false releases it', async () => {
    const button = makeButton();
    project.addComponent(button);
    await api.simEnter();

    await api.simSetInput(button.id, true);
    await api.simSetInput(button.id, true);
    expect(button.isActive(0)).toBe(true);

    await api.simSetInput(button.id, false);
    expect(button.isActive(0)).toBe(false);
    expect(fakeWorker.sentFrames().map((frame) => frame.state)).toEqual([
      [true],
      [false]
    ]);
  });

  describe('setInput with a slot address', () => {
    let input: FakeUserInput;
    let base: number;

    beforeEach(async () => {
      input = new FakeUserInput(3, { slotIds: ['up', 'a', 'b'] });
      project.addComponent(input);
      await api.simEnter();
      base = simulation.board!.userInputs.get(input.id)!;
    });

    const sent = () => slotWrites(base);

    it('reaches the same slot by slot id and by index', async () => {
      await api.simSetInput(input.id, true, 'b');
      expect(input.isActive(2)).toBe(true);
      expect(sent()).toEqual([[2, true]]);

      await api.simSetInput(input.id, false, 2);
      expect(input.isActive(2)).toBe(false);
      expect(sent()).toEqual([
        [2, true],
        [2, false]
      ]);
    });

    it('drives slot 0 without an address', async () => {
      await api.simSetInput(input.id, true);

      expect(input.isActive(0)).toBe(true);
      expect(sent()).toEqual([[0, true]]);
    });

    it('rejects an address the input does not have, naming the valid ones', async () => {
      await expect(api.simSetInput(input.id, true, 'start')).rejects.toThrow(
        /0–2, ids "up", "a", "b"/
      );
      await expect(api.simSetInput(input.id, true, 3)).rejects.toThrow(
        /0–2, ids "up", "a", "b"/
      );
      expect(sent()).toEqual([]);
    });
  });

  describe('setInput with a value for every slot', () => {
    let input: FakeUserInput;
    let base: number;

    beforeEach(async () => {
      input = new FakeUserInput(3, { slotIds: ['up', 'a', 'b'] });
      project.addComponent(input);
      await api.simEnter();
      base = simulation.board!.userInputs.get(input.id)!;
    });

    const sent = () => slotWrites(base);

    it('sets each slot absolutely, sending only for the ones that change', async () => {
      await api.simSetInput(input.id, [true, false, true]);
      expect(sent()).toEqual([
        [0, true],
        [2, true]
      ]);
      expect(fakeWorker.postedOfKind('submitInput')).toHaveLength(1);

      await api.simSetInput(input.id, [true, false, true]);
      expect(sent()).toHaveLength(2);

      await api.simSetInput(input.id, [false, false, true]);
      expect(sent()).toEqual([
        [0, true],
        [2, true],
        [0, false]
      ]);
    });

    it('rejects a wrong length or an address beside it, applying nothing', async () => {
      await expect(api.simSetInput(input.id, [true, true])).rejects.toThrow(
        /has 3 slots/
      );
      await expect(
        api.simSetInput(input.id, [true, true, true, true])
      ).rejects.toThrow(/has 3 slots/);
      await expect(
        api.simSetInput(input.id, [true, false, true], 'a')
      ).rejects.toThrow(/has 3 slots/);

      expect(sent()).toEqual([]);
      expect([0, 1, 2].some((slot) => input.isActive(slot))).toBe(false);
    });
  });

  it('drives a gamepad by control id and as an array, with names written as an option', async () => {
    const pad = makeGamepad();
    project.addComponent(pad);
    const edit = api.applyEdit([
      { op: 'setOption', id: pad.id, key: 'face', value: 4 },
      { op: 'setOption', id: pad.id, key: 'names', value: { a: 'Jump' } }
    ]);
    expect(edit.ok).toBe(true);
    expect(pad.options.names.value).toEqual({ a: 'Jump' });

    await api.simEnter();
    const base = simulation.board!.userInputs.get(pad.id)!;
    const sent = () => slotWrites(base);

    // Addressed by id, never by the custom name; the ids follow the options.
    await api.simSetInput(pad.id, true, 'a');
    await api.simSetInput(pad.id, true, 'x');
    expect(sent()).toEqual([
      [4, true],
      [6, true]
    ]);
    await expect(api.simSetInput(pad.id, true, 'Jump')).rejects.toThrow(/"a"/);

    const all = pad.slotIds.map((id) => id === 'up' || id === 'start');
    await api.simSetInput(pad.id, all);
    expect(pad.slotIds.map((_, slot) => pad.isActive(slot))).toEqual(all);
    expect(sent().slice(2)).toEqual([
      [0, true],
      [4, false],
      [6, false],
      [9, true]
    ]);
  });

  it('sets a gamepad array as one frame while running, so its slots land on one tick', async () => {
    const pad = makeGamepad();
    project.addComponent(pad);
    await api.simEnter();
    simulation.play();
    await api.simSetInput(pad.id, true, 0);
    const base = simulation.board!.userInputs.get(pad.id)!;

    // Slot 0 falls and every odd slot rises; the rest stay low, unsent.
    await api.simSetInput(
      pad.id,
      pad.slotIds.map((_, slot) => slot % 2 === 1)
    );

    const queued = fakeWorker.postedOfKind('submitInput');
    expect(queued).toHaveLength(2);
    expect(queued[1].writes).toEqual([
      {
        comp: base,
        frames: [
          {
            state: pad.slotIds.map((_, slot) =>
              slot === 0 ? false : slot % 2 === 1 ? true : null
            ),
            coalesce: true
          }
        ]
      }
    ]);
  });

  it('setInput takes a one-element array on a lever', async () => {
    const lever = makeSwitch();
    project.addComponent(lever);
    await api.simEnter();

    await api.simSetInput(lever.id, [true]);

    expect(lever.isActive(0)).toBe(true);
    expect(fakeWorker.sentFrames()).toHaveLength(1);
  });

  it('setInput rejects a slot past 0 on a lever', async () => {
    const lever = makeSwitch();
    project.addComponent(lever);
    await api.simEnter();

    await expect(api.simSetInput(lever.id, true, 1)).rejects.toThrow(
      /only slot is 0/
    );
    expect(lever.isActive(0)).toBe(false);
  });

  it('setInput takes a one-element array on a pulse button, pulsing only on true', async () => {
    const button = makePulseButton();
    project.addComponent(button);
    await api.simEnter();

    const unit = simulation.board!.userInputs.get(button.id)!;

    await api.simSetInput(button.id, [false]);
    expect(fakeWorker.sentFrames()).toHaveLength(0);

    await api.simSetInput(button.id, [true]);
    expect(fakeWorker.sentFrames()).toEqual([
      { comp: unit, state: [true] },
      { comp: unit, state: [false], coalesce: true }
    ]);
  });

  it('setInput pulses a pulse button for the next step alone', async () => {
    const button = makePulseButton();
    project.addComponent(button);
    await api.simEnter();
    const unit = simulation.board!.userInputs.get(button.id)!;

    await api.simSetInput(button.id, true);

    const seen: boolean[] = [];
    for (let step = 0; step < 3; step++) {
      await api.simStep();
      seen.push(fakeWorker.engine.output(unit));
    }
    expect(seen).toEqual([true, false, false]);
  });

  describe('a keyboard', () => {
    let keyboard: KeyboardComponent;
    /** The keyboard's unit, its outputs `D0`…`D6` and `STB` in port order. */
    let base: number;

    beforeEach(async () => {
      keyboard = makeKeyboard();
      project.addComponent(keyboard);
      await api.simEnter();
      base = simulation.board!.userInputs.get(keyboard.id)!;
    });

    afterEach(() => TestBed.inject(InspectionService).closeAll());

    /** The code of every press sent so far, the frames raising `STB`. */
    const pressed = () =>
      fakeWorker
        .sentFrames()
        .filter(
          (frame) =>
            frame.comp === base && frame.state[KEYBOARD_STROBE_OUTPUT] === true
        )
        .map((frame) => codeFromBits((bit) => frame.state[bit] === true));

    /** The code on `D` after the last tick. */
    const onD = () =>
      codeFromBits((bit) => fakeWorker.engine.output(base, bit));

    it('types a text as one tap per character, a CRLF as one LF', async () => {
      await api.simType(keyboard.id, 'a\r\nb');

      expect(pressed()).toEqual([0x61, 0x0a, 0x62]);
    });

    it('refuses a text with a character it has no key for, naming its position and queueing nothing', async () => {
      await expect(api.simType(keyboard.id, 'ab\r\nä!')).rejects.toThrow(
        /"ä" \(U\+00E4\) at position 4/
      );

      expect(fakeWorker.postedOfKind('submitInput')).toEqual([]);
    });

    it('presses a key setKey already holds once', async () => {
      await api.simSetKey(keyboard.id, 'A');
      await api.simSetKey(keyboard.id, 'A');

      expect(pressed()).toEqual([0x41]);
    });

    it('shows a key set and let go of while paused before it falls back to 0', async () => {
      await api.simSetKey(keyboard.id, 'A');
      await api.simSetKey(keyboard.id, null);

      const seen: number[] = [];
      for (let step = 0; step < 4; step++) {
        await api.simStep();
        seen.push(onD());
      }
      expect(seen).toEqual([0x41, 0x41, 0, 0]);
    });

    it('counts what a text still has to send in its window, one character per four steps', async () => {
      api.inspectOpen(keyboard.id);
      const window = TestBed.inject(InspectionService).open()[0]
        .inspection as KeyboardInspection;

      await api.simType(keyboard.id, 'abc');
      expect(window.pending()).toBe(3);

      const counts: number[] = [];
      for (let step = 0; step < 12; step++) {
        await api.simStep();
        counts.push(window.pending());
      }
      // A character is no longer waiting from the step that puts it on D.
      expect(counts).toEqual([2, 2, 2, 2, 1, 1, 1, 1, 0, 0, 0, 0]);
    });

    it('agrees with its window on the key held', async () => {
      api.inspectOpen(keyboard.id);
      const window = TestBed.inject(InspectionService).open()[0]
        .inspection as KeyboardInspection;

      window.press('KeyA', 0x61);
      await api.simSetKey(keyboard.id, 'a');
      expect(pressed()).toEqual([0x61]);

      await api.simSetKey(keyboard.id, null);
      // The window's key is up already: its keyup sends nothing more.
      window.release('KeyA');
      for (let step = 0; step < 4; step++) {
        await api.simStep();
      }
      expect(onD()).toBe(0);
      expect(window.heldEntry()).toBeNull();
    });

    it('refuses setInput, naming the calls that drive it', async () => {
      await expect(api.simSetInput(keyboard.id, true)).rejects.toThrow(
        /is a keyboard — use sim\.type or sim\.setKey$/
      );
      expect(fakeWorker.postedOfKind('submitInput')).toEqual([]);
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

    // Power every link through the applier, the entry point the worker bridge
    // uses for a snapshot.
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
