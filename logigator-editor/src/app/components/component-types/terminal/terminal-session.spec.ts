import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Point } from 'pixi.js';
import { configureTestBed } from '../../../../testing/configure-test-bed';
import { makeInput, makeTerminal } from '../../../../testing/factories';
import {
  FakeSimulationWorker,
  ManualFrameScheduler
} from '../../../../testing/fake-simulation-worker';
import { FakeUserInput } from '../../../../testing/fake-user-input';
import { byteFrames, byteTicks } from '../../../../testing/recorder-writes';
import { Component } from '../../component';
import { ComponentProviderService } from '../../component-provider.service';
import { CustomComponentRegistry } from '../../custom/custom-component-registry.service';
import { SubCircuitWatch } from '../../custom/sub-circuit-watch';
import { InspectionService } from '../../../inspection/inspection.service';
import { Project } from '../../../project/project';
import { ProjectService } from '../../../project/project.service';
import { EditorSettingsService } from '../../../settings/editor-settings.service';
import { SimulationService } from '../../../simulation/simulation.service';
import {
  FRAME_SCHEDULER,
  SIMULATION_WORKER_FACTORY
} from '../../../simulation/worker/simulation-worker.service';
import { TerminalComponent } from './terminal.component';
import { TerminalInspection } from './terminal-inspection';

/** Moves `component` so its port `port` lies on `target`. */
function placePortAt(component: Component, port: number, target: Point): void {
  const at = component.connectionPoints[port];
  component.position.set(
    component.position.x + target.x - at.x,
    component.position.y + target.y - at.y
  );
}

/** A user input whose output `i` touches input `i` of `target`. */
function drivingInput(target: Component): FakeUserInput {
  const input = new FakeUserInput(target.numInputs);
  placePortAt(input, 0, target.connectionPoints[0]);
  for (let pin = 0; pin < target.numInputs; pin++) {
    const from = input.connectionPoints[pin];
    const to = target.connectionPoints[pin];
    if (from.x !== to.x || from.y !== to.y) {
      throw new Error(`output ${pin} misses the input it should drive`);
    }
  }
  return input;
}

const codes = (text: string) => [...text].map((char) => char.charCodeAt(0));

/** The screen's rows, top to bottom. */
const rowsOf = (terminal: TerminalComponent) =>
  Array.from({ length: terminal.screen.rows }, (_, row) =>
    terminal.screen.rowText(row)
  );

describe('Terminal in a session', () => {
  let simulation: SimulationService;
  let inspections: InspectionService;
  let project: Project;
  let scheduler: ManualFrameScheduler;
  let fakeWorker: FakeSimulationWorker;

  beforeEach(() => {
    scheduler = new ManualFrameScheduler();
    configureTestBed([
      {
        provide: SIMULATION_WORKER_FACTORY,
        useValue: () => {
          fakeWorker = new FakeSimulationWorker();
          return fakeWorker.asWorker();
        }
      },
      { provide: FRAME_SCHEDULER, useValue: scheduler }
    ]);
    simulation = TestBed.inject(SimulationService);
    inspections = TestBed.inject(InspectionService);
    TestBed.inject(EditorSettingsService).autoStartSimulation.set(false);
    project = new Project();
    TestBed.inject(ProjectService).setMainProject(project);
  });

  afterEach(() => {
    inspections.closeAll();
    simulation.exit();
    project.destroy({ children: true });
  });

  /** Lets every worker round trip in flight land. */
  const settle = () => new Promise((resolve) => setTimeout(resolve));

  async function boot(): Promise<void> {
    void simulation.enter();
    await vi.waitFor(() => expect(simulation.state()).toBe('ready'));
    await settle();
  }

  /** Prints `text` through `input` while paused, stepping until done. */
  async function print(input: Component, text: string): Promise<void> {
    simulation.sendFrames(input.id, byteFrames(codes(text)));
    for (let tick = 0; tick < byteTicks(text.length); tick++) {
      simulation.step();
    }
    await settle();
  }

  function placeTerminal(): {
    terminal: TerminalComponent;
    input: FakeUserInput;
  } {
    const terminal = makeTerminal({ columns: 8, rows: 3 }, undefined, 10, 0);
    const input = drivingInput(terminal);
    project.addComponent(terminal);
    project.addComponent(input);
    return { terminal, input };
  }

  it('prints what the circuit writes with no window open, keeps it over a pause and run, clears it on a stop and prints again after', async () => {
    const { terminal, input } = placeTerminal();
    await boot();

    await print(input, 'hi\nthere');
    expect(rowsOf(terminal)).toEqual(['hi', 'there', '']);
    expect(terminal.screen.cursorColumn).toBe(5);

    simulation.sendFrames(input.id, byteFrames(codes('!')));
    simulation.play();
    for (let frame = 0; frame < 2 * byteTicks(1); frame++) {
      scheduler.fire();
      await settle();
    }
    simulation.pause();
    await settle();
    expect(rowsOf(terminal)).toEqual(['hi', 'there!', '']);
    simulation.step();
    await settle();
    expect(rowsOf(terminal)).toEqual(['hi', 'there!', '']);

    simulation.stop();
    await vi.waitFor(() => expect(simulation.resets()).toBe(1));
    expect(rowsOf(terminal)).toEqual(['', '', '']);
    expect(terminal.screen.scrollbackEnd).toBe(0);

    await print(input, 'again');
    expect(rowsOf(terminal)).toEqual(['again', '', '']);
  });

  it('scrolls lines past the bottom into the scrollback, each once', async () => {
    const { terminal, input } = placeTerminal();
    await boot();

    await print(input, 'one\ntwo\nthree\nfour\nfive');

    expect(terminal.screen.scrollbackEntries()).toEqual([
      { kind: 'line', text: 'one', wrapped: false },
      { kind: 'line', text: 'two', wrapped: false }
    ]);
    expect(rowsOf(terminal)).toEqual(['three', 'four', 'five']);
  });

  it('starts empty in the next session, reading it from its first record', async () => {
    const { terminal, input } = placeTerminal();
    await boot();
    await print(input, 'old');

    simulation.exit();
    expect(rowsOf(terminal)).toEqual(['', '', '']);
    await boot();
    await print(input, 'new');

    expect(rowsOf(terminal)).toEqual(['new', '', '']);
  });

  it('opens its window on the board terminal, showing what it printed before', async () => {
    const { terminal, input } = placeTerminal();
    await boot();
    await print(input, 'ab');

    inspections.openFor(terminal);
    const inspection = inspections.open().at(-1)!.inspection;

    expect(inspection).toBeInstanceOf(TerminalInspection);
    expect((inspection as TerminalInspection).transcript()).toBe('ab');
  });

  describe('inside a watch', () => {
    /**
     * A custom component holding a terminal whose inputs are its input
     * plugs, one for one, placed on the board with a user input driving
     * every pin, beside a board terminal of its own.
     */
    async function placeTerminalBox(): Promise<{
      instance: Component;
      input: FakeUserInput;
      board: TerminalComponent;
      boardInput: FakeUserInput;
    }> {
      const registry = TestBed.inject(CustomComponentRegistry);
      const provider = TestBed.inject(ComponentProviderService);
      const inner = makeTerminal({ columns: 8, rows: 3 }, undefined, 10, 0);
      const plugs = Array.from({ length: inner.numInputs }, (_, pin) => {
        const plug = makeInput(pin);
        placePortAt(plug, 0, inner.connectionPoints[pin]);
        return plug;
      });
      const components = [inner, ...plugs];
      const typeId = registry.registerSnapshot({
        kind: 'snapshot',
        source: 'browser',
        name: 'TerminalBox',
        symbol: 'TB',
        description: '',
        numInputs: plugs.length,
        numOutputs: 0,
        labels: plugs.map((_, pin) => `I${pin}`),
        circuit: {
          components: components.map((component) => {
            const { type, pos, options } = Component.serialize(component);
            return { type, pos, options };
          }),
          wires: []
        }
      });
      for (const component of components) component.destroy({ children: true });

      const instance = Component.deserialize(
        { pos: [10, 0], options: {} },
        provider.getComponent(typeId)!
      );
      const input = drivingInput(instance);
      const board = makeTerminal({ columns: 8, rows: 3 }, undefined, 10, 30);
      const boardInput = drivingInput(board);
      for (const component of [instance, input, board, boardInput]) {
        project.addComponent(component);
      }
      await boot();
      return { instance, input, board, boardInput };
    }

    function openWatch(instance: Component): {
      watch: SubCircuitWatch;
      copy: TerminalComponent;
    } {
      inspections.openFor(instance);
      const watch = inspections.open()[0].inspection as SubCircuitWatch;
      const copy = watch.activeLevel().session.components[0];
      expect(copy).toBeInstanceOf(TerminalComponent);
      return { watch, copy: copy as TerminalComponent };
    }

    it('replays what the inner terminal printed before the level opened, then follows it', async () => {
      const { instance, input, board, boardInput } = await placeTerminalBox();
      await print(input, 'one\ntwo\nthree\nfour');
      await print(boardInput, 'board');

      const { copy } = openWatch(instance);
      await settle();
      expect(copy.screen.scrollbackEntries()).toEqual([
        { kind: 'line', text: 'one', wrapped: false }
      ]);
      expect(rowsOf(copy)).toEqual(['two', 'three', 'four']);

      await print(input, '!');
      expect(rowsOf(copy)).toEqual(['two', 'three', 'four!']);
      expect(rowsOf(board)).toEqual(['board', '', '']);
    });

    it('clears the copy on a stop and prints again from the rebuilt recorder', async () => {
      const { instance, input } = await placeTerminalBox();
      const { copy } = openWatch(instance);
      await print(input, 'before');
      expect(rowsOf(copy)).toEqual(['before', '', '']);

      simulation.stop();
      await vi.waitFor(() => expect(simulation.resets()).toBe(1));
      expect(rowsOf(copy)).toEqual(['', '', '']);

      await print(input, 'after');
      expect(rowsOf(copy)).toEqual(['after', '', '']);
    });

    it('stops reading once its level closes', async () => {
      const { instance, input } = await placeTerminalBox();
      const { copy } = openWatch(instance);
      await print(input, 'a');

      inspections.closeAll();
      await print(input, 'b');

      expect(rowsOf(copy)).toEqual(['a', '', '']);
    });

    it('opens the copy’s window through the watch, with the breadcrumb as its place', async () => {
      const { instance, input } = await placeTerminalBox();
      const { watch, copy } = openWatch(instance);
      await print(input, 'hey');

      watch.activate(copy);
      const entry = inspections.open().at(-1)!;

      expect(entry.inspection).toBeInstanceOf(TerminalInspection);
      expect(entry.component).toBe(copy);
      expect(entry.place).toEqual(['TerminalBox']);
      expect((entry.inspection as TerminalInspection).transcript()).toBe('hey');
    });
  });
});
