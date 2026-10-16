import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Point } from 'pixi.js';
import { configureTestBed } from '../../../testing/configure-test-bed';
import {
  makeButton,
  makeGamepad,
  makeKeyboard,
  makeSwitch
} from '../../../testing/factories';
import {
  FakeSimulationWorker,
  ManualFrameScheduler
} from '../../../testing/fake-simulation-worker';
import { Component } from '../component';
import { ComponentInspection } from '../component-inspection';
import { ComponentProviderService } from '../component-provider.service';
import { ButtonComponent } from '../component-types/button/button.component';
import { GamepadComponent } from '../component-types/gamepad/gamepad.component';
import { GamepadInspection } from '../component-types/gamepad/gamepad-inspection';
import { KeyboardComponent } from '../component-types/keyboard/keyboard.component';
import { KeyboardInspection } from '../component-types/keyboard/keyboard-inspection';
import { codeFromBits } from '../component-types/keyboard/ascii';
import { SwitchComponent } from '../component-types/switch/switch.component';
import { outputComponentConfig } from '../component-types/output/output.config';
import { Project } from '../../project/project';
import { ProjectService } from '../../project/project.service';
import { EditorSettingsService } from '../../settings/editor-settings.service';
import { InspectionService } from '../../inspection/inspection.service';
import { SimulationService } from '../../simulation/simulation.service';
import {
  FRAME_SCHEDULER,
  SIMULATION_WORKER_FACTORY
} from '../../simulation/worker/simulation-worker.service';
import { Wire } from '../../wires/wire';
import { WindowService } from '@logigator/ui';
import { KEYBOARD_DATA_BITS, WireDirection } from '@logigator/core';
import { OpenInspection } from '../../inspection/inspection-presenter';
import { CustomComponentRegistry } from './custom-component-registry.service';
import { CustomComponent } from './custom-component';
import { SubCircuitWatch } from './sub-circuit-watch';

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

function serializeBody(components: Component[], wires: Wire[]) {
  const body = {
    components: components.map((c) => {
      const s = Component.serialize(c);
      return {
        type: s.type,
        pos: s.pos,
        ...(s.direction ? { direction: s.direction } : {}),
        options: s.options
      };
    }),
    wires: wires.map((w) => {
      const s = Wire.serialize(w);
      return { pos: s.pos, direction: s.direction, length: s.length };
    })
  };
  components.forEach((c) => c.destroy({ children: true }));
  wires.forEach((w) => w.destroy());
  return body;
}

describe('SubCircuitWatch', () => {
  let simulation: SimulationService;
  let registry: CustomComponentRegistry;
  let provider: ComponentProviderService;
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
    simulation = TestBed.inject(SimulationService);
    registry = TestBed.inject(CustomComponentRegistry);
    provider = TestBed.inject(ComponentProviderService);
    // Keep the boot paused so the watch is set up before the run advances.
    TestBed.inject(EditorSettingsService).autoStartSimulation.set(false);
    project = new Project();
    TestBed.inject(ProjectService).setMainProject(project);
  });

  afterEach(() => {
    simulation.exit();
    project.destroy({ children: true });
  });

  /**
   * What the frames sent to `unit` set its output `pin` to, in order, the
   * frames that leave the pin alone skipped.
   */
  const levelsOf = (unit: number, pin: number) =>
    fakeWorker
      .sentFrames()
      .filter((frame) => frame.comp === unit && frame.state[pin] !== null)
      .map((frame) => frame.state[pin]);

  /**
   * SwitchBox nested inside Outer; a placed Outer instance in the project.
   * `makeInput` swaps the box's switch for another user input.
   */
  async function placeNestedFixture(
    makeInput: () => Component = makeSwitch
  ): Promise<CustomComponent> {
    const switchComp = makeInput();
    const plug = Component.deserialize(
      { pos: [8, 0], options: { label: '', index: 0 } },
      outputComponentConfig
    );
    const switchBox = registry.registerSnapshot({
      kind: 'snapshot',
      source: 'browser',
      name: 'SwitchBox',
      symbol: 'LB',
      description: '',
      numInputs: 0,
      numOutputs: 1,
      labels: ['O'],
      circuit: serializeBody(
        [switchComp, plug],
        [wireBetween(switchComp.connectionPoints[0], plug.connectionPoints[0])]
      )
    });

    const inner = Component.deserialize(
      { pos: [0, 0], options: {} },
      provider.getComponent(switchBox)!
    );
    const outerPlug = Component.deserialize(
      { pos: [10, 0], options: { label: '', index: 0 } },
      outputComponentConfig
    );
    const outer = registry.registerSnapshot({
      kind: 'snapshot',
      source: 'browser',
      name: 'Outer',
      symbol: 'OU',
      description: '',
      numInputs: 0,
      numOutputs: 1,
      labels: ['O'],
      circuit: serializeBody(
        [inner, outerPlug],
        [wireBetween(inner.connectionPoints[0], outerPlug.connectionPoints[0])]
      )
    });

    const instance = Component.deserialize(
      { pos: [0, 0], options: {} },
      provider.getComponent(outer)!
    ) as CustomComponent;
    project.addComponent(instance);
    simulation.enter();
    await vi.waitFor(() => expect(simulation.state()).toBe('ready'));
    return instance;
  }

  it('drills into a nested custom and navigates back, destroying the level', async () => {
    const instance = await placeNestedFixture();
    const watch = instance.config.inspection!(instance) as SubCircuitWatch;

    expect(watch.levels()).toHaveLength(1);
    expect(watch.title()).toBe('Outer');

    // Body index 0 of Outer is the SwitchBox copy.
    const innerCopy = watch.activeLevel().session.components[0];
    watch.activate(innerCopy);

    expect(watch.levels()).toHaveLength(2);
    expect(watch.title()).toBe('Outer › SwitchBox');
    const deepProject = watch.activeLevel().session.project;

    // Header breadcrumbs: the ancestor navigates, the visible level doesn't.
    const parts = watch.titleParts();
    expect(parts.map((part) => part.label)).toEqual(['Outer', 'SwitchBox']);
    expect(parts[1].navigate).toBeUndefined();
    parts[0].navigate!();

    expect(watch.levels()).toHaveLength(1);
    expect(watch.title()).toBe('Outer');
    expect(watch.titleParts()).toHaveLength(1);
    expect(deepProject.destroyed).toBe(true);

    watch.destroy();
  });

  it('routes an inner switch click to its flattened engine unit', async () => {
    const instance = await placeNestedFixture();
    const watch = instance.config.inspection!(instance) as SubCircuitWatch;
    watch.activate(watch.activeLevel().session.components[0]);

    const switchCopy = watch.activeLevel().session.components[0];
    expect(switchCopy).toBeInstanceOf(SwitchComponent);
    watch.activate(switchCopy);

    expect((switchCopy as SwitchComponent).isActive(0)).toBe(true);
    // The flattened board's only unit is the inner switch — index 0.
    expect(fakeWorker.sentFrames()).toEqual([
      { comp: 0, state: [true], coalesce: true }
    ]);

    watch.destroy();
  });

  describe('an inner button', () => {
    let watch: SubCircuitWatch;
    let buttonCopy: ButtonComponent;

    beforeEach(async () => {
      const instance = await placeNestedFixture(() => makeButton(0, 0));
      watch = instance.config.inspection!(instance) as SubCircuitWatch;
      watch.activate(watch.activeLevel().session.components[0]);
      buttonCopy = watch.activeLevel().session.components[0] as ButtonComponent;
      expect(buttonCopy).toBeInstanceOf(ButtonComponent);
    });

    afterEach(() => watch.destroy());

    /** What the frames sent to the flattened board's only unit, the button, set. */
    const levels = () => levelsOf(0, 0);

    it('is held for as long as its hold lasts', () => {
      const hold = watch.holdFor(buttonCopy)!;

      hold.press();
      expect(buttonCopy.isActive(0)).toBe(true);
      expect(levels()).toEqual([true]);

      hold.release();
      expect(buttonCopy.isActive(0)).toBe(false);
      expect(levels()).toEqual([true, false]);
    });

    it('is released when its level closes under the hold', () => {
      const hold = watch.holdFor(buttonCopy)!;
      hold.press();

      watch.navigateTo(0);
      expect(levels()).toEqual([true, false]);

      // The hold's own release, cancelled by the level swap, sends nothing.
      hold.release();
      expect(levels()).toEqual([true, false]);
    });

    it('opens the inspection it declares instead of triggering, routed to the copy', () => {
      const openFor = vi
        .spyOn(TestBed.inject(InspectionService), 'openFor')
        .mockImplementation(() => undefined);
      Object.defineProperty(buttonCopy, 'config', {
        value: {
          ...buttonCopy.config,
          inspection: () => ({}) as ComponentInspection
        }
      });

      watch.activate(buttonCopy);

      expect(openFor).toHaveBeenCalledWith(buttonCopy, {
        input: expect.anything(),
        state: expect.anything(),
        place: ['Outer', 'SwitchBox']
      });
      expect(levels()).toEqual([]);

      const route = openFor.mock.calls[0][1]!.input!;
      route.press(0);
      expect(buttonCopy.isActive(0)).toBe(true);
      expect(levels()).toEqual([true]);
      route.release(0);
      expect(levels()).toEqual([true, false]);

      route.send([{ state: [true] }]);
      expect(fakeWorker.submitted().at(-1)).toEqual({
        comp: 0,
        frames: [{ state: [true] }]
      });
      // Frames leave the copy's slot state alone.
      expect(buttonCopy.isActive(0)).toBe(false);

      route.cancel({ state: [false], coalesce: true });
      expect(fakeWorker.submitted().at(-1)).toEqual({
        comp: 0,
        frames: [{ state: [false], coalesce: true }],
        replace: true
      });
      expect(route.pending()).toBe(0);
    });

    it('takes an absolute value through setInput', () => {
      expect(watch.setInput(buttonCopy, true)).toBe(true);
      expect(watch.setInput(buttonCopy, true)).toBe(true);
      expect(levels()).toEqual([true]);

      expect(watch.setInput(buttonCopy, false)).toBe(true);
      expect(levels()).toEqual([true, false]);
    });
  });

  describe('an inner gamepad', () => {
    let inspections: InspectionService;
    let watchEntry: OpenInspection;
    let watch: SubCircuitWatch;
    let padCopy: GamepadComponent;
    /** The engine unit of the copy's slot 0. */
    let base: number;
    /** The gamepad's window, opened by a tap on the copy. */
    let played: GamepadInspection;

    beforeEach(async () => {
      const instance = await placeNestedFixture(() => makeGamepad());
      inspections = TestBed.inject(InspectionService);
      inspections.openFor(instance);
      watchEntry = inspections.open()[0];
      watch = watchEntry.inspection as SubCircuitWatch;
      watch.activate(watch.activeLevel().session.components[0]);
      padCopy = watch.activeLevel().session.components[0] as GamepadComponent;
      expect(padCopy).toBeInstanceOf(GamepadComponent);
      base = watch.activeLevel().session.info.unitIndexFor(0)!;

      watch.activate(padCopy);
      played = inspections.open().at(-1)!.inspection as GamepadInspection;
      expect(played).toBeInstanceOf(GamepadInspection);
    });

    afterEach(() => inspections.closeAll());

    /** What the frames sent to the copy's unit set one control's slot to. */
    const levelsOfControl = (control: string) =>
      levelsOf(base, padCopy.slotIds.indexOf(control as never));

    /** Stops the simulation and waits for the reset to land. */
    async function stop(): Promise<void> {
      simulation.stop();
      await new Promise((resolve) => setTimeout(resolve));
      expect(fakeWorker.postedOfKind('stop')).toHaveLength(1);
    }

    const anyActive = () =>
      padCopy.slotIds.some((_, slot) => padCopy.isActive(slot));

    it('plays the inner unit from its window, lighting the copy through its level, under the breadcrumb', () => {
      const repaint = vi.spyOn(
        watch.activeLevel().session.project,
        'triggerTicker'
      );

      played.keyDown('a', 'KeyX');

      expect(levelsOfControl('a')).toEqual([true]);
      expect(padCopy.isActive(padCopy.slotIds.indexOf('a'))).toBe(true);
      expect(repaint).toHaveBeenCalledWith('single');
      expect([...played.pressed()]).toEqual(['a']);

      const window = TestBed.inject(WindowService)
        .windows()
        .find(
          (candidate) => candidate.config.inputValues?.['inspection'] === played
        )!;
      const title = window.config.title as () => string;
      expect(title()).toBe(`Outer › SwitchBox › ${played.title()}`);
    });

    it('closes with the level it lives on, letting go of its slot once', async () => {
      played.keyDown('a', 'KeyX');
      played.pointerDown('a', 1);

      watch.navigateTo(0);

      expect(levelsOfControl('a')).toEqual([true, false]);
      expect(inspections.open()).toEqual([watchEntry]);

      // Nothing is left tracked: a stop has no slot of the copy to reset.
      await stop();
      expect(levelsOfControl('a')).toEqual([true, false]);
    });

    it('sends one release per held slot when the watch closes under it', () => {
      played.keyDown('a', 'KeyX');
      played.pointerDown('a', 1);
      played.pointerDown('up', 2);

      inspections.close(watchEntry);

      expect(levelsOfControl('a')).toEqual([true, false]);
      expect(levelsOfControl('up')).toEqual([true, false]);
      expect(inspections.open()).toEqual([]);
      expect(anyActive()).toBe(false);
    });

    it('is set low against the rebuilt engine by a stop, and plays again once let go', async () => {
      played.keyDown('a', 'KeyX');

      await stop();

      const posted = fakeWorker.posted;
      const reset = posted.findIndex((msg) => msg.kind === 'stop');
      const slot = padCopy.slotIds.indexOf('a');
      const low = posted.findIndex(
        (msg) =>
          msg.kind === 'submitInput' &&
          msg.writes.some(
            (write) =>
              write.comp === base &&
              write.frames.some((frame) => frame.state[slot] === false)
          )
      );
      expect(reset).toBeGreaterThanOrEqual(0);
      expect(low).toBeGreaterThan(reset);
      expect(anyActive()).toBe(false);
      expect(played.pressed().size).toBe(0);

      // The key the stop cut off lets go without a second release.
      played.keyUp('a', 'KeyX');
      expect(levelsOfControl('a')).toEqual([true, false]);

      played.keyDown('a', 'KeyX');
      expect(levelsOfControl('a')).toEqual([true, false, true]);
    });
  });

  describe('an inner keyboard', () => {
    let inspections: InspectionService;
    let watchEntry: OpenInspection;
    let watch: SubCircuitWatch;
    let keyboardCopy: KeyboardComponent;
    /** The engine unit of the copy. */
    let base: number;
    /** The unit of the board's own keyboard. */
    let boardBase: number;

    beforeEach(async () => {
      // A keyboard on the board too, whose units the copy's frames must miss.
      const boardKeyboard = makeKeyboard(0, 20);
      project.addComponent(boardKeyboard);
      const instance = await placeNestedFixture(() => makeKeyboard());
      boardBase = simulation.board!.userInputs.get(boardKeyboard.id)!;
      inspections = TestBed.inject(InspectionService);
      inspections.openFor(instance);
      watchEntry = inspections.open()[0];
      watch = watchEntry.inspection as SubCircuitWatch;
      watch.activate(watch.activeLevel().session.components[0]);
      keyboardCopy = watch.activeLevel().session
        .components[0] as KeyboardComponent;
      expect(keyboardCopy).toBeInstanceOf(KeyboardComponent);
      base = watch.activeLevel().session.info.unitIndexFor(0)!;
    });

    afterEach(() => inspections.closeAll());

    /** The code on the copy's data outputs after the last tick. */
    const copyCode = () =>
      codeFromBits((bit) => fakeWorker.engine.output(base, bit));

    it('opens its window on the copy, whose frames reach the copy’s unit and not the board’s', () => {
      watch.activate(keyboardCopy);
      const opened = inspections.open().at(-1)!;
      expect(opened.component).toBe(keyboardCopy);
      const typing = opened.inspection as KeyboardInspection;
      expect(typing).toBeInstanceOf(KeyboardInspection);

      typing.press('KeyA', 0x41);

      const units = fakeWorker.sentFrames().map((frame) => frame.comp);
      expect(new Set(units)).toEqual(new Set([base]));
      expect(base).not.toBe(boardBase);
      simulation.step();
      expect(copyCode()).toBe(0x41);
      expect(keyboardCopy.heldKey()).toEqual({ code: 0x41, key: 'KeyA' });
    });

    it('sets the copy’s data outputs low when the watch closes under a held key', () => {
      keyboardCopy.pressKey(
        { send: (frames) => watch.sendFrames(keyboardCopy, frames) },
        0x41
      );

      inspections.close(watchEntry);

      const seen: number[] = [];
      for (let step = 0; step < 4; step++) {
        simulation.step();
        seen.push(copyCode());
      }
      expect(seen).toEqual([0x41, 0x41, 0, 0]);
    });

    it('releases a key held from its window once when the watch closes', () => {
      watch.activate(keyboardCopy);
      const typing = inspections.open().at(-1)!
        .inspection as KeyboardInspection;
      typing.press('KeyA', 0x41);

      inspections.close(watchEntry);

      const releases = fakeWorker
        .sentFrames()
        .filter((frame) =>
          frame.state.slice(0, KEYBOARD_DATA_BITS).every((bit) => bit === false)
        );
      expect(releases).toHaveLength(1);
      for (let step = 0; step < 4; step++) {
        simulation.step();
      }
      expect(copyCode()).toBe(0);
    });
  });
});
