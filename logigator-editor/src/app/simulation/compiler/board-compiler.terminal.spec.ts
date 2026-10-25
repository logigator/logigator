import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Point } from 'pixi.js';
import { SerializedCircuitBody, TERMINAL_CLOCK_INPUT } from '@logigator/core';
import { configureTestBed } from '../../../testing/configure-test-bed';
import {
  FakeTerminal,
  fakeTerminalConfig
} from '../../../testing/fake-terminal';
import { FakeUserInput } from '../../../testing/fake-user-input';
import { SimEngine } from '../../../testing/sim-engine';
import { Component } from '../../components/component';
import { ComponentProviderService } from '../../components/component-provider.service';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import { Project } from '../../project/project';
import { BoardCompilerService } from './board-compiler.service';
import {
  CompiledBoard,
  ENGINE_RECORDER_TYPE,
  TERMINAL_RECORD_CAPACITY
} from './compiled-board.model';

/** Moves `component` so its port `port` lies on `target`. */
function placePortAt(component: Component, port: number, target: Point): void {
  const at = component.connectionPoints[port];
  component.position.set(
    component.position.x + target.x - at.x,
    component.position.y + target.y - at.y
  );
}

/** A user input whose output `i` touches the terminal's input `i`. */
function drivingInput(terminal: Component): FakeUserInput {
  const input = new FakeUserInput(terminal.numInputs);
  placePortAt(input, 0, terminal.connectionPoints[0]);
  for (let pin = 0; pin < terminal.numInputs; pin++) {
    const from = input.connectionPoints[pin];
    const to = terminal.connectionPoints[pin];
    if (from.x !== to.x || from.y !== to.y) {
      throw new Error(`output ${pin} misses the input it should drive`);
    }
  }
  return input;
}

/** Frames putting each `[data, clock]` pair on `D0`…`D7` and `CLK`. */
function busFrames(steps: [data: number, clock: boolean][]) {
  return steps.map(([data, clock]) => ({
    state: [
      ...Array.from({ length: 8 }, (_, bit) => ((data >> bit) & 1) === 1),
      clock
    ]
  }));
}

describe('BoardCompilerService terminals', () => {
  let compiler: BoardCompilerService;
  let registry: CustomComponentRegistry;
  let provider: ComponentProviderService;
  let project: Project;

  beforeEach(() => {
    configureTestBed();
    compiler = TestBed.inject(BoardCompilerService);
    registry = TestBed.inject(CustomComponentRegistry);
    provider = TestBed.inject(ComponentProviderService);
    provider.register(fakeTerminalConfig);
    project = new Project();
  });

  afterEach(() => {
    project.destroy({ children: true });
  });

  function makeTerminal(px = 0, py = 0): FakeTerminal {
    return Component.deserialize(
      { pos: [px, py], options: {} },
      fakeTerminalConfig
    ) as FakeTerminal;
  }

  /** A terminal on the board, every input driven by one user input. */
  function placeDriven(): {
    terminal: FakeTerminal;
    input: FakeUserInput;
  } {
    const terminal = makeTerminal(10, 0);
    const input = drivingInput(terminal);
    project.addComponent(terminal);
    project.addComponent(input);
    return { terminal, input };
  }

  /** Runs `steps` through the board's input; the terminal's records. */
  function record(
    board: CompiledBoard,
    input: Component,
    terminal: Component,
    steps: [data: number, clock: boolean][]
  ): number[] {
    const engine = new SimEngine(board.descriptor);
    engine.submit([
      { comp: board.userInputs.get(input.id)!, frames: busFrames(steps) }
    ]);
    engine.steps(steps.length + 1);
    const unit = board.recordUnits.get(terminal.id)!;
    return [...engine.readRecords(unit, 0).values];
  }

  it('emits a terminal as one engine recorder over D0…D7 then CLK', () => {
    const { terminal, input } = placeDriven();

    const board = compiler.compile(project);
    const units = board.descriptor.components;
    const unit = board.recordUnits.get(terminal.id)!;

    expect(units[unit]).toEqual({
      type: ENGINE_RECORDER_TYPE,
      inputs: units[board.userInputs.get(input.id)!].outputs,
      outputs: [],
      capacity: TERMINAL_RECORD_CAPACITY
    });
    expect([...board.recordUnits.keys()]).toEqual([terminal.id]);
    expect(board.stateUnits.size).toBe(0);
  });

  it('passes bubbles on the data bits and on CLK through to the recorder', () => {
    const { terminal } = placeDriven();
    terminal.setPortNegated('in', TERMINAL_CLOCK_INPUT, true);
    terminal.setPortNegated('in', 2, true);

    const board = compiler.compile(project);

    expect(
      board.descriptor.components[board.recordUnits.get(terminal.id)!].negInputs
    ).toEqual([2, TERMINAL_CLOCK_INPUT]);
  });

  it('addresses each placement’s inner terminal by its own recorder unit', () => {
    const inner = makeTerminal(0, 0);
    const body: SerializedCircuitBody = {
      components: [Component.serialize(inner)],
      wires: []
    };
    inner.destroy();
    const box = registry.registerSnapshot({
      kind: 'snapshot',
      source: 'browser',
      name: 'TerminalBox',
      symbol: 'TB',
      description: '',
      numInputs: 0,
      numOutputs: 0,
      labels: [],
      circuit: body
    });
    const place = (py: number) => {
      const instance = Component.deserialize(
        { pos: [0, py], options: {} },
        provider.getComponent(box)!
      );
      project.addComponent(instance);
      return instance;
    };
    const first = place(0);
    const second = place(20);
    const { terminal } = placeDriven();

    const board = compiler.compile(project);
    const units = board.descriptor.components;
    const firstUnit = board.watch.infoFor(String(first.id))!.recordUnitFor(0)!;
    const secondUnit = board.watch
      .infoFor(String(second.id))!
      .recordUnitFor(0)!;
    const boardUnit = board.recordUnits.get(terminal.id)!;

    expect(new Set([firstUnit, secondUnit, boardUnit]).size).toBe(3);
    for (const unit of [firstUnit, secondUnit, boardUnit]) {
      expect(units[unit]).toMatchObject({
        type: ENGINE_RECORDER_TYPE,
        capacity: TERMINAL_RECORD_CAPACITY
      });
    }
    // An inner terminal is the watch's to address, never the board's.
    expect([...board.recordUnits.keys()]).toEqual([terminal.id]);
  });

  it('records the byte on D at each rising CLK, on the real engine', () => {
    const { terminal, input } = placeDriven();
    const board = compiler.compile(project);

    // D changes with every falling edge, so each edge names its own byte.
    expect(
      record(board, input, terminal, [
        [0x41, true],
        [0x42, false],
        [0x43, false],
        [0xe9, true],
        [0x0a, false],
        [0x0a, true]
      ])
    ).toEqual([0x41, 0xe9, 0x0a]);
  });

  it('records at each falling CLK behind a bubble, and inverts a negated data bit', () => {
    const { terminal, input } = placeDriven();
    terminal.setPortNegated('in', TERMINAL_CLOCK_INPUT, true);
    terminal.setPortNegated('in', 0, true);
    const board = compiler.compile(project);

    expect(
      record(board, input, terminal, [
        [0x41, true],
        [0x42, false],
        [0x43, true],
        [0x44, false]
      ])
    ).toEqual([0x42 ^ 1, 0x44 ^ 1]);
  });
});
