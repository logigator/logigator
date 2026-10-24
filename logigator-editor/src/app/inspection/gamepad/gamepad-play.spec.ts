import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GamepadControlId } from '@logigator/core';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { makeGamepad } from '../../../testing/factories';
import {
  FakeSimulationWorker,
  ManualFrameScheduler
} from '../../../testing/fake-simulation-worker';
import { GamepadComponent } from '../../components/component-types/gamepad/gamepad.component';
import { GamepadInspection } from '../../components/component-types/gamepad/gamepad-inspection';
import { Project } from '../../project/project';
import { ProjectService } from '../../project/project.service';
import { EditorSettingsService } from '../../settings/editor-settings.service';
import { HELD_INPUT_BACKLOG } from '../../simulation/held-input';
import { SimulationService } from '../../simulation/simulation.service';
import {
  FRAME_SCHEDULER,
  SIMULATION_WORKER_FACTORY
} from '../../simulation/worker/simulation-worker.service';
import { setStaticDIInjector } from '../../utils/get-di';
import { InspectionService } from '../inspection.service';
import { GamepadReading } from './gamepad-hardware.service';

/** A standard-mapped controller at rest, as `getGamepads` lists it. */
type FakeController = GamepadReading & {
  buttons: { pressed: boolean; value: number }[];
  axes: number[];
};

function fakeController(): FakeController {
  return {
    index: 0,
    id: 'Pad (STANDARD GAMEPAD Vendor: 045e Product: 0b13)',
    mapping: 'standard',
    connected: true,
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    axes: [0, 0, 0, 0]
  };
}

/** The standard mapping's button for a control (`gamepad-hardware-mapping`). */
const BUTTON: Partial<Record<GamepadControlId, number>> = { a: 1, up: 12 };

/**
 * A gamepad on the board, played in its window through the top-level route
 * into the real engine, paused, so what reaches the circuit is read tick by
 * tick.
 */
describe('A gamepad played into the simulation', () => {
  let simulation: SimulationService;
  let fakeWorker: FakeSimulationWorker;
  let frames: ManualFrameScheduler;
  let project: Project;
  let pad: GamepadComponent;
  let played: GamepadInspection;
  let unit: number;
  let controller: FakeController;

  /** Whether the pad drives `control`'s output high after the last tick. */
  const output = (control: GamepadControlId): boolean =>
    fakeWorker.engine.output(unit, pad.slotIds.indexOf(control));

  /** `steps` steps, and what `controls` show after each. */
  const stepAndRead = (
    steps: number,
    controls: readonly GamepadControlId[]
  ): boolean[][] =>
    Array.from({ length: steps }, () => {
      simulation.step();
      return controls.map(output);
    });

  function pressButton(control: GamepadControlId, pressed: boolean): void {
    controller.buttons[BUTTON[control]!] = { pressed, value: pressed ? 1 : 0 };
  }

  beforeEach(async () => {
    controller = fakeController();
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => [controller]
    });
    frames = new ManualFrameScheduler();
    configureTestBed([
      {
        provide: SIMULATION_WORKER_FACTORY,
        useValue: () => {
          fakeWorker = new FakeSimulationWorker();
          return fakeWorker.asWorker();
        }
      },
      { provide: FRAME_SCHEDULER, useValue: frames }
    ]);
    setStaticDIInjector(TestBed.inject(Injector));
    simulation = TestBed.inject(SimulationService);
    TestBed.inject(EditorSettingsService).autoStartSimulation.set(false);
    project = new Project();
    TestBed.inject(ProjectService).setMainProject(project);
    pad = makeGamepad();
    project.addComponent(pad);

    void simulation.enter();
    await vi.waitFor(() => expect(simulation.state()).toBe('ready'));
    unit = simulation.board!.userInputs.get(pad.id)!;
    const inspections = TestBed.inject(InspectionService);
    inspections.openFor(pad);
    played = inspections.open().at(-1)!.inspection as GamepadInspection;
  });

  afterEach(() => {
    TestBed.inject(InspectionService).closeAll();
    simulation.exit();
    project.destroy({ children: true });
    delete (navigator as { getGamepads?: unknown }).getGamepads;
  });

  it('puts every control one controller poll presses on the same tick', () => {
    pressButton('a', true);
    pressButton('up', true);
    frames.fire();

    expect(stepAndRead(2, ['a', 'up'])).toEqual([
      [true, true],
      [true, true]
    ]);
  });

  it('puts both directions a pointer rolls onto in one move on the same tick', () => {
    played.pointerMove(1, ['up', 'left'], []);

    expect(stepAndRead(1, ['up', 'left'])).toEqual([[true, true]]);
  });

  it('lets go of every held key on the same tick when the window loses the keyboard', () => {
    played.keyDown('a', 'KeyX');
    played.keyDown('up', 'ArrowUp');
    stepAndRead(2, []);

    played.releaseKeys();

    expect(stepAndRead(1, ['a', 'up'])).toEqual([[false, false]]);
  });

  it('keeps a bounded backlog when a control is mashed faster than it steps, the last press still seen', () => {
    for (let tap = 0; tap < 10; tap++) {
      played.pointerDown('a', 1);
      played.pointerUp('a', 1);
      expect(fakeWorker.engine.pending(unit)).toBeLessThanOrEqual(
        HELD_INPUT_BACKLOG
      );
    }

    expect(stepAndRead(4, ['a'])).toEqual([[true], [false], [false], [false]]);
  });

  it('keeps a held control high while another is mashed past the backlog', () => {
    played.keyDown('up', 'ArrowUp');
    stepAndRead(1, []);
    for (let tap = 0; tap < 10; tap++) {
      played.pointerDown('a', 1);
      played.pointerUp('a', 1);
    }

    const trace = stepAndRead(HELD_INPUT_BACKLOG + 1, ['up', 'a']);
    expect(trace.map(([up]) => up)).toEqual(trace.map(() => true));
    // The last press is seen, once, and the backlog has run out after it.
    const a = trace.map(([, high]) => high);
    expect(a.filter((high, i) => high && !a[i - 1])).toHaveLength(1);
    expect(a.slice(-2)).toEqual([false, false]);
  });
});
