import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Point } from 'pixi.js';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { makeLever } from '../../../testing/factories';
import { Component } from '../../components/component';
import { ComponentProviderService } from '../../components/component-provider.service';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import { outputComponentConfig } from '../../components/component-types/output/output.config';
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

function makeOutPlug(index: number, pos: [number, number]): Component {
  return Component.deserialize(
    { pos, options: { label: '', index } },
    outputComponentConfig
  );
}

/** Serializes live elements into a snapshot circuit body, destroying them. */
function liveToBody(
  components: Component[],
  wires: Wire[]
): SerializedCircuitBody {
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

describe('BoardCompilerService watch index', () => {
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

  function placeByType(typeId: number, pos: [number, number]): Component {
    const config = provider.getComponent(typeId)!;
    const instance = Component.deserialize(
      { pos, options: { direction: 0 } },
      config
    );
    project.addComponent(instance);
    return instance;
  }

  /**
   * Snapshot with a lever driving its single output plug, plus a floating
   * wire connected to nothing. Body order: components [lever, plug],
   * wires [lever→plug, floating].
   */
  function registerLeverBox(): number {
    const lever = makeLever(0, 0);
    const plug = makeOutPlug(0, [8, 0]);
    const wire = wireBetween(
      lever.connectionPoints[0],
      plug.connectionPoints[0]
    );
    const floating = wireBetween(new Point(0.5, 10.5), new Point(4.5, 10.5));
    return registry.registerSnapshot({
      kind: 'snapshot',
      source: 'browser',
      name: 'LeverBox',
      symbol: 'LB',
      description: '',
      numInputs: 0,
      numOutputs: 1,
      labels: ['O'],
      circuit: liveToBody([lever, plug], [wire, floating])
    });
  }

  /**
   * Snapshot nesting a LeverBox: its own lever on plug 0, the nested
   * instance's output on plug 1. Body order: components [lever, nested,
   * plug0, plug1].
   */
  function registerOuter(leverBox: number): number {
    const lever = makeLever(0, 0);
    const nested = Component.deserialize(
      { pos: [0, 6], options: { direction: 0 } },
      provider.getComponent(leverBox)!
    );
    const plug0 = makeOutPlug(0, [10, 0]);
    const plug1 = makeOutPlug(1, [10, 6]);
    const w0 = wireBetween(lever.connectionPoints[0], plug0.connectionPoints[0]);
    const w1 = wireBetween(
      nested.connectionPoints[0],
      plug1.connectionPoints[0]
    );
    return registry.registerSnapshot({
      kind: 'snapshot',
      source: 'browser',
      name: 'Outer',
      symbol: 'OU',
      description: '',
      numInputs: 0,
      numOutputs: 2,
      labels: ['A', 'B'],
      circuit: liveToBody([lever, nested, plug0, plug1], [w0, w1])
    });
  }

  it('resolves a top-level instance: wires, ports, and user inputs', () => {
    const leverBox = registerLeverBox();
    const instance = placeByType(leverBox, [0, 0]);

    const board = compiler.compile(project);
    const info = board.watch.infoFor(String(instance.id))!;

    expect(info).not.toBeNull();
    expect(info.typeId).toBe(leverBox);

    // The single unit is the inner lever (engine UserInput type).
    expect(board.descriptor.components).toEqual([
      { type: 200, inputs: [], outputs: [0] }
    ]);
    expect(info.unitIndexFor(0)).toBe(0);
    expect(info.unitIndexFor(1)).toBeUndefined();

    // Wire 0 and both ports share the lever's output link.
    const leverOutLink = board.descriptor.components[0].outputs[0];
    expect(info.linkOfLocalNet[info.tables.wireNets[0]]).toBe(leverOutLink);
    expect(info.linkOfLocalNet[info.tables.portNets[0][0]]).toBe(leverOutLink);
    expect(info.linkOfLocalNet[info.tables.portNets[1][0]]).toBe(leverOutLink);
  });

  it('gives a wire-only inner net a local id but no link', () => {
    const leverBox = registerLeverBox();
    const instance = placeByType(leverBox, [0, 0]);

    const board = compiler.compile(project);
    const info = board.watch.infoFor(String(instance.id))!;

    const floatingNet = info.tables.wireNets[1];
    expect(floatingNet).toBeGreaterThanOrEqual(0);
    expect(floatingNet).not.toBe(info.tables.wireNets[0]);
    expect(info.linkOfLocalNet[floatingNet]).toBe(-1);
  });

  it('composes nested levels through the child bridge', () => {
    const leverBox = registerLeverBox();
    const outer = registerOuter(leverBox);
    const instance = placeByType(outer, [0, 0]);

    const board = compiler.compile(project);

    // Flattening emits the outer lever first, then the nested one.
    expect(board.descriptor.components).toEqual([
      { type: 200, inputs: [], outputs: [0] },
      { type: 200, inputs: [], outputs: [1] }
    ]);

    const outerInfo = board.watch.infoFor(String(instance.id))!;
    expect(outerInfo.typeId).toBe(outer);
    expect(outerInfo.unitIndexFor(0)).toBe(0);
    // The nested instance (body index 1) is a child bridge, not a user input.
    expect(outerInfo.unitIndexFor(1)).toBeUndefined();
    expect([...outerInfo.tables.children.keys()]).toEqual([1]);

    const innerInfo = board.watch.infoFor(`${instance.id}/1`)!;
    expect(innerInfo.typeId).toBe(leverBox);
    expect(innerInfo.unitIndexFor(0)).toBe(1);

    // The inner lever's wire lights from the second unit's output link; the
    // floating inner wire still has no link.
    expect(innerInfo.linkOfLocalNet[innerInfo.tables.wireNets[0]]).toBe(1);
    expect(innerInfo.linkOfLocalNet[innerInfo.tables.wireNets[1]]).toBe(-1);

    // The inner level's plug net is the same link the outer level sees on the
    // nested instance's output port.
    expect(outerInfo.linkOfLocalNet[outerInfo.tables.portNets[1][0]]).toBe(
      innerInfo.linkOfLocalNet[innerInfo.tables.portNets[1][0]]
    );
  });

  it('keeps distinct placements of one snapshot apart', () => {
    const leverBox = registerLeverBox();
    const first = placeByType(leverBox, [0, 0]);
    const second = placeByType(leverBox, [0, 10]);

    const board = compiler.compile(project);
    const firstInfo = board.watch.infoFor(String(first.id))!;
    const secondInfo = board.watch.infoFor(String(second.id))!;

    expect(firstInfo.unitIndexFor(0)).toBe(0);
    expect(secondInfo.unitIndexFor(0)).toBe(1);
    expect(firstInfo.linkOfLocalNet[firstInfo.tables.wireNets[0]]).not.toBe(
      secondInfo.linkOfLocalNet[secondInfo.tables.wireNets[0]]
    );
  });

  it('returns null for paths that address nothing watchable', () => {
    const leverBox = registerLeverBox();
    const instance = placeByType(leverBox, [0, 0]);

    const board = compiler.compile(project);

    expect(board.watch.infoFor('999999')).toBeNull();
    // LeverBox nests no custom, so any deeper segment dead-ends.
    expect(board.watch.infoFor(`${instance.id}/0`)).toBeNull();
  });
});
