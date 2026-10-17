import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { KEYBOARD_STROBE_OUTPUT } from '@logigator/core';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { makeKeyboard } from '../../../../testing/factories';
import {
  FakeSimulationWorker,
  ManualFrameScheduler
} from '../../../../testing/fake-simulation-worker';
import { InspectionService } from '../../../inspection/inspection.service';
import { Project } from '../../../project/project';
import { ProjectService } from '../../../project/project.service';
import { EditorSettingsService } from '../../../settings/editor-settings.service';
import { SimulationService } from '../../../simulation/simulation.service';
import {
  FRAME_SCHEDULER,
  SIMULATION_WORKER_FACTORY
} from '../../../simulation/worker/simulation-worker.service';
import { setStaticDIInjector } from '../../../utils/get-di';
import { INPUT_QUEUE_LIMIT } from '../../component-inspection';
import { codeFromBits, KEYBOARD_TEXT_LIMIT } from './ascii';
import { KeyboardComponent } from './keyboard.component';
import { KeyboardInspection } from './keyboard-inspection';

/** `length` printable codes, cycling through the letters so each is known. */
function text(length: number, first = 0x61): number[] {
  return Array.from({ length }, (_, i) => first + (i % 26));
}

describe('a keyboard against the engine’s input limit', () => {
  let simulation: SimulationService;
  let project: Project;
  let fakeWorker: FakeSimulationWorker;
  let keyboard: KeyboardComponent;
  let window: KeyboardInspection;
  /** The keyboard's unit, `D0`…`D6`, `STB`, then `KD`. */
  let base: number;

  beforeEach(async () => {
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
    simulation = TestBed.inject(SimulationService);
    TestBed.inject(EditorSettingsService).autoStartSimulation.set(false);
    project = new Project();
    TestBed.inject(ProjectService).setMainProject(project);
    keyboard = makeKeyboard();
    project.addComponent(keyboard);
    void simulation.enter();
    await vi.waitFor(() => expect(simulation.state()).toBe('ready'));
    base = simulation.board!.userInputs.get(keyboard.id)!;
    const inspections = TestBed.inject(InspectionService);
    inspections.openFor(keyboard);
    window = inspections.open()[0].inspection as KeyboardInspection;
  });

  afterEach(() => {
    TestBed.inject(InspectionService).closeAll();
    simulation.exit();
    project.destroy({ children: true });
  });

  /** The code on `D` at every rising edge of `STB` over `ticks` steps. */
  function latchedOver(ticks: number): number[] {
    const latched: number[] = [];
    let strobe = fakeWorker.engine.output(base, KEYBOARD_STROBE_OUTPUT);
    for (let tick = 0; tick < ticks; tick++) {
      simulation.step();
      const high = fakeWorker.engine.output(base, KEYBOARD_STROBE_OUTPUT);
      if (high && !strobe) {
        latched.push(
          codeFromBits((bit) => fakeWorker.engine.output(base, bit))
        );
      }
      strobe = high;
    }
    return latched;
  }

  /** Two full sends: 20 000 characters, 60 000 of the input's events. */
  function fillWithTwoSends(): number[] {
    const first = text(KEYBOARD_TEXT_LIMIT);
    expect(window.type(first)).toBe(true);
    expect(window.type(text(KEYBOARD_TEXT_LIMIT, 0x41))).toBe(true);
    return first;
  }

  it('refuses a send that does not fit behind the text still queued, whole, while that text keeps arriving', () => {
    const first = fillWithTwoSends();
    const submitted = fakeWorker.postedOfKind('submitInput').length;
    const history = window.history();

    // Sent within the same frame: no snapshot has counted the two yet.
    expect(window.type(text(KEYBOARD_TEXT_LIMIT))).toBe(false);

    expect(fakeWorker.postedOfKind('submitInput')).toHaveLength(submitted);
    expect(fakeWorker.engine.pending(base)).toBe(3 * 2 * KEYBOARD_TEXT_LIMIT);
    expect(window.history()).toBe(history);
    // Nothing was cut or replaced: the first text goes on in order.
    expect(latchedOver(4 * 5)).toEqual(first.slice(0, 5));
    expect(fakeWorker.engine.pending(base)).toBe(
      3 * 2 * KEYBOARD_TEXT_LIMIT - 3 * 5
    );
  });

  it('takes the longest send that fits, then no key until the queue has room for its three press frames', async () => {
    fillWithTwoSends();
    const room = Math.floor(
      (INPUT_QUEUE_LIMIT - 3 * 2 * KEYBOARD_TEXT_LIMIT) / 3
    );
    expect(window.room()).toBe(room);

    expect(window.type(text(room))).toBe(true);
    // Three events a character: the queue is one short of full.
    expect(fakeWorker.engine.pending(base)).toBe(INPUT_QUEUE_LIMIT - 1);
    expect(window.room()).toBe(0);
    const submitted = fakeWorker.postedOfKind('submitInput').length;

    expect(window.press('KeyA', 0x61)).toBe(false);
    expect(window.type([0x61])).toBe(false);
    expect(keyboard.heldKey()).toBeNull();
    expect(fakeWorker.postedOfKind('submitInput')).toHaveLength(submitted);

    // The first character's first press frame leaves room for two events.
    simulation.step();
    await vi.waitFor(() =>
      expect(simulation.pendingEvents(keyboard.id)).toBe(INPUT_QUEUE_LIMIT - 2)
    );
    expect(window.press('KeyA', 0x61)).toBe(false);

    // Its second leaves room for a press, which fills the queue exactly.
    simulation.step();
    await vi.waitFor(() =>
      expect(simulation.pendingEvents(keyboard.id)).toBe(INPUT_QUEUE_LIMIT - 3)
    );
    expect(window.press('KeyA', 0x61)).toBe(true);
    expect(fakeWorker.engine.pending(base)).toBe(INPUT_QUEUE_LIMIT);
  });

  it('cancels a full queue, its one event fitting and counting as no character', async () => {
    fillWithTwoSends();
    expect(window.type(text(window.room()))).toBe(true);
    simulation.step();
    simulation.step();
    await vi.waitFor(() =>
      expect(simulation.pendingEvents(keyboard.id)).toBe(INPUT_QUEUE_LIMIT - 3)
    );
    expect(window.press('KeyA', 0x61)).toBe(true);
    expect(fakeWorker.engine.pending(base)).toBe(INPUT_QUEUE_LIMIT);

    window.cancel();

    // The engine took it: only the cancel's own event is left.
    expect(fakeWorker.engine.pending(base)).toBe(1);
    expect(window.pending()).toBe(0);
    expect(window.room()).toBe(Math.floor(INPUT_QUEUE_LIMIT / 3));
    expect(keyboard.heldKey()).toBeNull();
  });
});
