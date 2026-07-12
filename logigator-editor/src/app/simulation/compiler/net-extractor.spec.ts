import { beforeEach, describe, expect, it } from 'vitest';
import { Point } from 'pixi.js';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { makeAnd, makeNot, makeWire } from '../../../testing/factories';
import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
import { WireDirection } from '../../wires/wire-direction.enum';
import { extractNets, Net } from './net-extractor';

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

function netOf(nets: Net[], element: Wire | Component): Net | undefined {
  if (element instanceof Wire) {
    return nets.find((net) => net.wires.includes(element));
  }
  return nets.find((net) =>
    net.ports.some((port) => port.component === element)
  );
}

describe('extractNets', () => {
  beforeEach(() => {
    configureTestBed();
  });

  it('returns no nets for an empty circuit', () => {
    expect(extractNets({ components: [], wires: [] })).toEqual([]);
  });

  it('joins two gate pins through a straight wire into one net', () => {
    const and = makeAnd(2, undefined, 0, 0);
    const not = makeNot();
    not.position.set(10, 0);
    const wire = wireBetween(and.connectionPoints[2], not.connectionPoints[0]);

    const nets = extractNets({ components: [and, not], wires: [wire] });

    const net = netOf(nets, wire)!;
    expect(net.ports).toEqual(
      expect.arrayContaining([
        { component: and, portIndex: 2 },
        { component: not, portIndex: 0 }
      ])
    );
    expect(net.ports).toHaveLength(2);
  });

  it('chains multiple wire segments into one net', () => {
    const w1 = makeWire(0, 0, WireDirection.HORIZONTAL, 4); // (0.5,0.5) → (4.5,0.5)
    const w2 = makeWire(4, 0, WireDirection.VERTICAL, 3); // (4.5,0.5) → (4.5,3.5)
    const w3 = makeWire(4, 3, WireDirection.HORIZONTAL, 2); // (4.5,3.5) → (6.5,3.5)

    const nets = extractNets({ components: [], wires: [w1, w2, w3] });

    expect(nets).toHaveLength(1);
    expect(nets[0].wires).toHaveLength(3);
  });

  it('merges a T-junction (3 terminations at one point) into one net', () => {
    const left = makeWire(0, 2, WireDirection.HORIZONTAL, 4); // ends at (4.5,2.5)
    const right = makeWire(4, 2, WireDirection.HORIZONTAL, 4); // starts at (4.5,2.5)
    const down = makeWire(4, 2, WireDirection.VERTICAL, 3); // starts at (4.5,2.5)

    const nets = extractNets({ components: [], wires: [left, right, down] });

    expect(nets).toHaveLength(1);
  });

  it('merges an L-corner (2 terminations, no connection dot) into one net', () => {
    const horizontal = makeWire(0, 0, WireDirection.HORIZONTAL, 4); // ends (4.5,0.5)
    const vertical = makeWire(4, 0, WireDirection.VERTICAL, 4); // starts (4.5,0.5)

    const nets = extractNets({
      components: [],
      wires: [horizontal, vertical]
    });

    expect(nets).toHaveLength(1);
  });

  it('keeps crossing wire interiors as two separate nets', () => {
    const horizontal = makeWire(0, 2, WireDirection.HORIZONTAL, 4); // y=2.5, x 0.5→4.5
    const vertical = makeWire(2, 0, WireDirection.VERTICAL, 4); // x=2.5, y 0.5→4.5

    const nets = extractNets({
      components: [],
      wires: [horizontal, vertical]
    });

    expect(nets).toHaveLength(2);
  });

  it('joins a split crossing (4 endpoints coincide) into one net', () => {
    const left = makeWire(0, 2, WireDirection.HORIZONTAL, 2); // ends (2.5,2.5)
    const right = makeWire(2, 2, WireDirection.HORIZONTAL, 2); // starts (2.5,2.5)
    const top = makeWire(2, 0, WireDirection.VERTICAL, 2); // ends (2.5,2.5)
    const bottom = makeWire(2, 2, WireDirection.VERTICAL, 2); // starts (2.5,2.5)

    const nets = extractNets({
      components: [],
      wires: [left, right, top, bottom]
    });

    expect(nets).toHaveLength(1);
  });

  it('connects ports placed directly on each other without a wire', () => {
    const and = makeAnd(2, undefined, 0, 0);
    const out = and.connectionPoints[2];
    const not = makeNot();
    // The NOT's input port sits at local (-0.5, 0.5) relative to its position.
    not.position.set(out.x + 0.5, out.y - 0.5);

    const nets = extractNets({ components: [and, not], wires: [] });

    const net = netOf(nets, not)!;
    expect(net.ports).toEqual(
      expect.arrayContaining([
        { component: and, portIndex: 2 },
        { component: not, portIndex: 0 }
      ])
    );
  });

  it('yields a singleton net per dangling pin', () => {
    const and = makeAnd(2, undefined, 0, 0);

    const nets = extractNets({ components: [and], wires: [] });

    expect(nets).toHaveLength(3);
    for (const net of nets) {
      expect(net.wires).toHaveLength(0);
      expect(net.ports).toHaveLength(1);
      expect(net.ports[0].component).toBe(and);
    }
    expect(nets.map((net) => net.ports[0].portIndex).sort()).toEqual([0, 1, 2]);
  });

  it('never unions a component’s own ports through the component itself', () => {
    const not = makeNot();

    const nets = extractNets({ components: [not], wires: [] });

    expect(nets).toHaveLength(2);
  });

  it('yields a wire-only net with no ports', () => {
    const wire = makeWire(0, 0, WireDirection.HORIZONTAL, 4);

    const nets = extractNets({ components: [], wires: [wire] });

    expect(nets).toEqual([{ wires: [wire], ports: [] }]);
  });
});
