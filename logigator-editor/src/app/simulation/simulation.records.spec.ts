import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Point } from 'pixi.js';
import { configureTestBed } from '../../testing/configure-test-bed';
import { fakeTerminalConfig } from '../../testing/fake-terminal';
import {
  FakeSimulationWorker,
  ManualFrameScheduler
} from '../../testing/fake-simulation-worker';
import { FakeUserInput } from '../../testing/fake-user-input';
import { byteFrames, byteTicks } from '../../testing/recorder-writes';
import { Component } from '../components/component';
import { Project } from '../project/project';
import { ProjectService } from '../project/project.service';
import { EditorSettingsService } from '../settings/editor-settings.service';
import { SimulationService } from './simulation.service';
import {
  FRAME_SCHEDULER,
  SIMULATION_WORKER_FACTORY
} from './worker/simulation-worker.service';

/** Moves `component` so its port `port` lies on `target`. */
function placePortAt(component: Component, port: number, target: Point): void {
  const at = component.connectionPoints[port];
  component.position.set(
    component.position.x + target.x - at.x,
    component.position.y + target.y - at.y
  );
}

describe('SimulationService record watches', () => {
  let simulation: SimulationService;
  let project: Project;

  beforeEach(() => {
    configureTestBed([
      {
        provide: SIMULATION_WORKER_FACTORY,
        useValue: () => new FakeSimulationWorker().asWorker()
      },
      { provide: FRAME_SCHEDULER, useValue: new ManualFrameScheduler() }
    ]);
    simulation = TestBed.inject(SimulationService);
    TestBed.inject(EditorSettingsService).autoStartSimulation.set(false);
    project = new Project();
    TestBed.inject(ProjectService).setMainProject(project);
  });

  afterEach(() => {
    simulation.exit();
    project.destroy({ children: true });
  });

  /** Lets every worker round trip in flight land. */
  const settle = () => new Promise((resolve) => setTimeout(resolve));

  /** A terminal on the board, every input driven by one user input. */
  function placeTerminal(): { terminal: Component; input: FakeUserInput } {
    const terminal = Component.deserialize(
      { pos: [10, 0], options: {} },
      fakeTerminalConfig
    );
    const input = new FakeUserInput(terminal.numInputs);
    placePortAt(input, 0, terminal.connectionPoints[0]);
    project.addComponent(terminal);
    project.addComponent(input);
    return { terminal, input };
  }

  async function write(input: Component, codes: number[]): Promise<void> {
    simulation.sendFrames(input.id, byteFrames(codes));
    for (let tick = 0; tick < byteTicks(codes.length); tick++) {
      simulation.step();
    }
    await settle();
  }

  it('reads a top-level terminal from its first record when watched as the session starts', async () => {
    const { terminal, input } = placeTerminal();
    const firsts: number[] = [];
    const records: number[] = [];

    void simulation.enter();
    const watch = simulation.watchRecords(terminal.id, (first, values) => {
      firsts.push(first);
      records.push(...values);
    });
    expect(watch).not.toBeNull();
    expect(simulation.watchRecords(input.id, () => undefined)).toBeNull();
    await vi.waitFor(() => expect(simulation.state()).toBe('ready'));

    await write(input, [0x54, 0x54, 0x59]);
    expect(records).toEqual([0x54, 0x54, 0x59]);

    // A stop starts the recorder over: its reads begin at record 0 again.
    simulation.stop();
    await vi.waitFor(() => expect(simulation.resets()).toBe(1));
    await write(input, [0x0c]);
    expect(firsts.at(-1)).toBe(0);
    expect(records).toEqual([0x54, 0x54, 0x59, 0x0c]);
  });
});
