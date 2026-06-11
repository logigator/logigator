import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Point } from 'pixi.js';
import { configureTestBed } from '../../../testing/configure-test-bed';
import {
  makeAnd,
  makeButton,
  makeLever,
  makeNot
} from '../../../testing/factories';
import { Component } from '../../components/component';
import { ComponentProviderService } from '../../components/component-provider.service';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import { inputComponentConfig } from '../../components/component-types/input/input.config';
import { outputComponentConfig } from '../../components/component-types/output/output.config';
import { textComponentConfig } from '../../components/component-types/text/text.config';
import { romComponentConfig } from '../../components/component-types/rom/rom.config';
import { SerializedCircuitBody } from '../../persistence/serialized-circuit';
import { Project } from '../../project/project';
import { Wire } from '../../wires/wire';
import { WireDirection } from '../../wires/wire-direction.enum';
import { BoardCompilerService } from './board-compiler.service';

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

function makePlug(
  kind: 'input' | 'output',
  index: number,
  pos: [number, number]
): Component {
  const config =
    kind === 'input' ? inputComponentConfig : outputComponentConfig;
  return Component.deserialize({ pos, options: { label: '', index } }, config);
}

/** Serializes live elements into a snapshot circuit body, destroying them. */
function liveToBody(components: Component[], wires: Wire[]): SerializedCircuitBody {
  const body: SerializedCircuitBody = {
    components: components.map((component) => {
      const serialized = Component.serialize(component);
      return {
        type: serialized.type,
        pos: serialized.pos,
        options: serialized.options
      };
    }),
    wires: wires.map((wire) => {
      const serialized = Wire.serialize(wire);
      return {
        pos: serialized.pos,
        direction: serialized.direction,
        length: serialized.length
      };
    })
  };
  components.forEach((component) => component.destroy({ children: true }));
  wires.forEach((wire) => wire.destroy());
  return body;
}

describe('BoardCompilerService', () => {
  let compiler: BoardCompilerService;
  let registry: CustomComponentRegistry;
  let provider: ComponentProviderService;
  let project: Project;

  beforeEach(() => {
    configureTestBed();
    compiler = TestBed.inject(BoardCompilerService);
    registry = TestBed.inject(CustomComponentRegistry);
    provider = TestBed.inject(ComponentProviderService);
    project = new Project();
  });

  afterEach(() => {
    project.destroy({ children: true });
  });

  function place(component: Component): Component {
    project.addComponent(component);
    return component;
  }

  function placeWire(a: Point, b: Point): Wire {
    const wire = wireBetween(a, b);
    project.addWire(wire);
    return wire;
  }

  function placeByType(typeId: number, pos: [number, number]): Component {
    const config = provider.getComponent(typeId)!;
    return place(
      Component.deserialize({ pos, options: { direction: 0 } }, config)
    );
  }

  /** Registers a snapshot wrapping a single NOT behind one in and one out plug. */
  function registerWrapNot(): number {
    const inPlug = makePlug('input', 0, [0, 0]);
    const not = makeNot();
    not.position.set(4, 0);
    const outPlug = makePlug('output', 0, [9, 0]);
    const w1 = wireBetween(inPlug.connectionPoints[0], not.connectionPoints[0]);
    const w2 = wireBetween(
      not.connectionPoints[1],
      outPlug.connectionPoints[0]
    );
    return registry.registerSnapshot({
      kind: 'snapshot',
      source: 'browser',
      name: 'WrapNot',
      symbol: 'WN',
      description: '',
      numInputs: 1,
      numOutputs: 1,
      labels: ['I', 'O'],
      circuit: liveToBody([inPlug, not, outPlug], [w1, w2])
    });
  }

  it('compiles a NOT feeding an AND into a shared link', () => {
    const not = place(makeNot());
    const and = makeAnd(2, undefined, 6, 0);
    place(and);
    const wire = placeWire(not.connectionPoints[1], and.connectionPoints[0]);

    const board = compiler.compile(project);

    // Emission order is ascending component id (creation order here); link
    // ids are dense in pin-visit order: NOT.in, NOT.out, AND.in1, AND.out.
    expect(board.descriptor).toEqual({
      links: 4,
      components: [
        { type: 1, inputs: [0], outputs: [1] },
        { type: 2, inputs: [1, 2], outputs: [3] }
      ]
    });
    expect(board.diagnostics).toEqual([]);
    expect(board.userInputs.size).toBe(0);

    const targets = board.mapping.get('')!;
    expect(targets).toHaveLength(4);
    expect(targets[1].wires).toEqual([wire]);
    expect(targets[1].ports).toEqual(
      expect.arrayContaining([
        { component: not, portIndex: 1 },
        { component: and, portIndex: 0 }
      ])
    );
    expect(targets[0].ports).toEqual([{ component: not, portIndex: 0 }]);
  });

  it('assigns fresh singleton links to dangling gate pins', () => {
    place(makeAnd(2, undefined, 0, 0));

    const board = compiler.compile(project);

    expect(board.descriptor).toEqual({
      links: 3,
      components: [{ type: 2, inputs: [0, 1], outputs: [2] }]
    });
  });

  it('gives wire-only nets no link and keeps them out of the mapping', () => {
    place(makeNot());
    const loneWire = placeWire(new Point(10.5, 10.5), new Point(14.5, 10.5));

    const board = compiler.compile(project);

    expect(board.descriptor.links).toBe(2);
    const targets = board.mapping.get('')!;
    expect(targets.every((t) => !t.wires.includes(loneWire))).toBe(true);
  });

  it('treats top-level plugs as inert but maps their stubs', () => {
    const plug = place(makePlug('input', 0, [0, 0]));
    const and = makeAnd(2, undefined, 6, 0);
    place(and);
    placeWire(plug.connectionPoints[0], and.connectionPoints[0]);
    const dangling = place(makePlug('output', 0, [0, 10]));

    const board = compiler.compile(project);

    // Only the AND becomes a unit; the wired plug's stub shares its link.
    expect(board.descriptor.components).toEqual([
      { type: 2, inputs: [0, 1], outputs: [2] }
    ]);
    const targets = board.mapping.get('')!;
    expect(targets[0].ports).toEqual(
      expect.arrayContaining([{ component: plug, portIndex: 0 }])
    );
    // The dangling plug's net has no unit pin — no link, never powered.
    expect(
      targets.every((t) => t.ports.every((p) => p.component !== dangling))
    ).toBe(true);
  });

  it('skips TEXT components without diagnostics', () => {
    place(
      Component.deserialize({ pos: [0, 0], options: {} }, textComponentConfig)
    );

    const board = compiler.compile(project);

    expect(board.descriptor).toEqual({ links: 0, components: [] });
    expect(board.diagnostics).toEqual([]);
  });

  it('reports a blocking diagnostic for ROM', () => {
    const rom = placeByType(romComponentConfig.type, [0, 0]);

    const board = compiler.compile(project);

    expect(board.diagnostics).toEqual([
      expect.objectContaining({
        kind: 'unsupported',
        instancePath: '',
        componentType: romComponentConfig.type,
        componentId: rom.id
      })
    ]);
  });

  it('expands two placements of one snapshot into distinct global links', () => {
    const wrapNot = registerWrapNot();
    const getDefinition = vi.spyOn(registry, 'getDefinition');
    placeByType(wrapNot, [0, 0]);
    placeByType(wrapNot, [0, 10]);

    const board = compiler.compile(project);

    expect(board.descriptor).toEqual({
      links: 4,
      components: [
        { type: 1, inputs: [0], outputs: [1] },
        { type: 1, inputs: [2], outputs: [3] }
      ]
    });

    // The template is built once and cached for the session.
    expect(
      getDefinition.mock.calls.filter(([typeId]) => typeId === wrapNot)
    ).toHaveLength(1);
    compiler.compile(project);
    expect(
      getDefinition.mock.calls.filter(([typeId]) => typeId === wrapNot)
    ).toHaveLength(1);
  });

  it('maps a custom instance’s port stubs to the inner unit links', () => {
    const wrapNot = registerWrapNot();
    const instance = placeByType(wrapNot, [0, 0]);

    const board = compiler.compile(project);

    const targets = board.mapping.get('')!;
    expect(targets[0].ports).toEqual([{ component: instance, portIndex: 0 }]);
    expect(targets[1].ports).toEqual([{ component: instance, portIndex: 1 }]);
  });

  it('expands customs nested inside customs', () => {
    const wrapNot = registerWrapNot();

    // A second snapshot whose circuit places a WrapNot instance between plugs.
    const inPlug = makePlug('input', 0, [0, 0]);
    const inner = Component.deserialize(
      { pos: [4, 0], options: { direction: 0 } },
      provider.getComponent(wrapNot)!
    );
    const outPlug = makePlug('output', 0, [10, 0]);
    const w1 = wireBetween(
      inPlug.connectionPoints[0],
      inner.connectionPoints[0]
    );
    const w2 = wireBetween(
      inner.connectionPoints[1],
      outPlug.connectionPoints[0]
    );
    const nested = registry.registerSnapshot({
      kind: 'snapshot',
      source: 'browser',
      name: 'Nested',
      symbol: 'NW',
      description: '',
      numInputs: 1,
      numOutputs: 1,
      labels: ['I', 'O'],
      circuit: liveToBody([inPlug, inner, outPlug], [w1, w2])
    });

    placeByType(nested, [0, 0]);

    const board = compiler.compile(project);

    expect(board.descriptor).toEqual({
      links: 2,
      components: [{ type: 1, inputs: [0], outputs: [1] }]
    });
    expect(board.diagnostics).toEqual([]);
  });

  it('merges two outer nets through a plug passthrough', () => {
    // A snapshot whose input plug wires straight to its output plug.
    const inPlug = makePlug('input', 0, [0, 0]);
    const outPlug = makePlug('output', 0, [5, 0]);
    const w = wireBetween(
      inPlug.connectionPoints[0],
      outPlug.connectionPoints[0]
    );
    const passthrough = registry.registerSnapshot({
      kind: 'snapshot',
      source: 'browser',
      name: 'Pass',
      symbol: 'P',
      description: '',
      numInputs: 1,
      numOutputs: 1,
      labels: ['I', 'O'],
      circuit: liveToBody([inPlug, outPlug], [w])
    });

    const not = place(makeNot());
    const instance = placeByType(passthrough, [6, 0]);
    const and = makeAnd(2, undefined, 14, 0);
    place(and);
    placeWire(not.connectionPoints[1], instance.connectionPoints[0]);
    placeWire(instance.connectionPoints[1], and.connectionPoints[0]);

    const board = compiler.compile(project);

    const notUnit = board.descriptor.components.find((c) => c.type === 1)!;
    const andUnit = board.descriptor.components.find((c) => c.type === 2)!;
    expect(notUnit.outputs[0]).toBe(andUnit.inputs[0]);
  });

  it('reports a plug-mismatch diagnostic when plugs disagree with the summary', () => {
    const inPlug = makePlug('input', 0, [0, 0]);
    const broken = registry.registerSnapshot({
      kind: 'snapshot',
      source: 'browser',
      name: 'Broken',
      symbol: 'B',
      description: '',
      numInputs: 2,
      numOutputs: 0,
      labels: ['A', 'B'],
      circuit: liveToBody([inPlug], [])
    });

    placeByType(broken, [0, 0]);

    const board = compiler.compile(project);

    expect(board.diagnostics).toEqual([
      expect.objectContaining({ kind: 'plug-mismatch' })
    ]);
  });

  it('prefixes inner diagnostics with the instance path', () => {
    const rom = Component.deserialize(
      { pos: [0, 0], options: {} },
      romComponentConfig
    );
    const romId = rom.id;
    const withRom = registry.registerSnapshot({
      kind: 'snapshot',
      source: 'browser',
      name: 'WithRom',
      symbol: 'R',
      description: '',
      numInputs: 0,
      numOutputs: 0,
      labels: [],
      circuit: liveToBody([rom], [])
    });

    const instance = placeByType(withRom, [0, 0]);

    const board = compiler.compile(project);

    expect(board.diagnostics).toHaveLength(1);
    expect(board.diagnostics[0].kind).toBe('unsupported');
    expect(board.diagnostics[0].instancePath).toBe(String(instance.id));
    // The inner component id is template-local (fresh per build), not romId.
    expect(board.diagnostics[0].componentId).not.toBe(romId);
  });

  it('emits button/lever units and registers them as user inputs', () => {
    // The example-board shape (gate subset): user input feeding gates.
    const lever = place(makeLever(0, 0));
    const button = place(makeButton(0, 4));
    const and = makeAnd(2, undefined, 8, 0);
    place(and);
    placeWire(lever.connectionPoints[0], and.connectionPoints[0]);
    const corner = new Point(
      button.connectionPoints[0].x,
      and.connectionPoints[1].y
    );
    placeWire(button.connectionPoints[0], corner);
    placeWire(corner, and.connectionPoints[1]);

    const board = compiler.compile(project);

    expect(board.diagnostics).toEqual([]);
    expect(board.descriptor).toEqual({
      links: 3,
      components: [
        { type: 201, inputs: [], outputs: [0] },
        { type: 200, inputs: [], outputs: [1] },
        { type: 2, inputs: [0, 1], outputs: [2] }
      ]
    });
    expect(board.userInputs).toEqual(
      new Map([
        [lever.id, 0],
        [button.id, 1]
      ])
    );
  });

  it('compiles deterministically', () => {
    const wrapNot = registerWrapNot();
    const not = place(makeNot());
    const instance = placeByType(wrapNot, [6, 0]);
    placeWire(not.connectionPoints[1], instance.connectionPoints[0]);

    const first = compiler.compile(project);
    const second = compiler.compile(project);

    expect(JSON.stringify(first.descriptor)).toBe(
      JSON.stringify(second.descriptor)
    );
  });
});
