import { beforeEach, describe, expect, it } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { setStaticDIInjector } from '../utils/get-di';
import { Component } from './component';
import { andComponentConfig } from './component-types/and/and.config';
import { Direction } from '../utils/direction';
import { makeAnd } from '../../testing/factories';
import { AndComponent } from './component-types/and/and.component';
import { configureTestBed } from '../../testing/configure-test-bed';
import { GraphicsProviderService } from '../rendering/graphics-provider.service';
import {
  POWERED_WIRE_THICKNESS,
  WireGraphics
} from '../rendering/graphics/wire.graphics';

describe('Component.deserialize (create() factory)', () => {
  beforeEach(() => {
    setStaticDIInjector(TestBed.inject(Injector));
  });

  it('builds an instance of the config implementation via create()', () => {
    const comp = Component.deserialize(
      { pos: [4, 7], options: { direction: Direction.E, numInputs: 3 } },
      andComponentConfig
    );

    expect(comp).toBeInstanceOf(AndComponent);
    expect(comp.numInputs).toBe(3);
    expect(comp.position.x).toBe(4);
    expect(comp.position.y).toBe(7);

    comp.destroy({ children: true });
  });

  it('preserves an explicit id when one is provided', () => {
    const comp = Component.deserialize(
      {
        id: 42,
        pos: [0, 0],
        options: { direction: Direction.E, numInputs: 2 }
      },
      andComponentConfig
    );

    expect(comp.id).toBe(42);

    comp.destroy({ children: true });
  });
});

describe('Component.gridBounds', () => {
  beforeEach(() => {
    setStaticDIInjector(TestBed.inject(Injector));
  });

  it('includes input and output stubs (x = -0.5, right = body_width + 0.5)', () => {
    const comp = makeAnd(2);

    // AndComponent body width = 2 grid units; stubs add 0.5 on each side.
    expect(comp.gridBounds.x).toBeCloseTo(-0.5, 5);
    expect(comp.gridBounds.right).toBeCloseTo(2.5, 5);

    comp.destroy({ children: true });
  });

  it('has no phantom 0.5-unit left padding when numInputs is zero', () => {
    const comp = makeAnd(2);
    comp.numInputs = 0;

    // Without input stubs the left edge comes from the body stroke (~-sqrt(2)/gridSize),
    // which is negligible (<0.1) and well above the -0.5 that a phantom stub would add.
    expect(comp.gridBounds.x).toBeGreaterThan(-0.5);

    comp.destroy({ children: true });
  });

  it('offset by position: bounds.x = position.x - 0.5 for component with inputs', () => {
    const comp = makeAnd(2);
    comp.position.set(5, 3);
    comp.direction = Direction.E;

    expect(comp.gridBounds.x).toBeCloseTo(5 - 0.5, 5);

    comp.destroy({ children: true });
  });
});

describe('Component.bodyGridBounds', () => {
  beforeEach(() => {
    setStaticDIInjector(TestBed.inject(Injector));
  });

  // AndComponent: bodyGridWidth=2, bodyGridHeight=max(inputs,outputs)

  // Construct with the direction (the constructor does not re-anchor) so these
  // assert the bodyGridBounds geometry for a known position. The interactive
  // re-anchoring of the `direction` setter is covered separately below.

  it('Right: origin at position, size = body only (no stubs)', () => {
    const comp = makeAnd(2, Direction.E, 3, 5); // height=2

    expect(comp.bodyGridBounds.x).toBeCloseTo(3, 5);
    expect(comp.bodyGridBounds.y).toBeCloseTo(5, 5);
    expect(comp.bodyGridBounds.width).toBeCloseTo(2, 5);
    expect(comp.bodyGridBounds.height).toBeCloseTo(2, 5);

    comp.destroy({ children: true });
  });

  it('Down: rotated AABB', () => {
    const comp = makeAnd(2, Direction.S, 4, 3); // bodyGridWidth=2, h=2

    // Down: Rectangle(x - h, y, h, w) = (4-2, 3, 2, 2)
    expect(comp.bodyGridBounds.x).toBeCloseTo(2, 5);
    expect(comp.bodyGridBounds.y).toBeCloseTo(3, 5);
    expect(comp.bodyGridBounds.width).toBeCloseTo(2, 5);
    expect(comp.bodyGridBounds.height).toBeCloseTo(2, 5);

    comp.destroy({ children: true });
  });

  it('Left: rotated AABB', () => {
    const comp = makeAnd(2, Direction.W, 4, 4);

    // Left: Rectangle(x - w, y - h, w, h) = (4-2, 4-2, 2, 2)
    expect(comp.bodyGridBounds.x).toBeCloseTo(2, 5);
    expect(comp.bodyGridBounds.y).toBeCloseTo(2, 5);
    expect(comp.bodyGridBounds.width).toBeCloseTo(2, 5);
    expect(comp.bodyGridBounds.height).toBeCloseTo(2, 5);

    comp.destroy({ children: true });
  });

  it('Up: rotated AABB', () => {
    const comp = makeAnd(2, Direction.N, 3, 6);

    // Up: Rectangle(x, y - w, h, w) = (3, 6-2, 2, 2)
    expect(comp.bodyGridBounds.x).toBeCloseTo(3, 5);
    expect(comp.bodyGridBounds.y).toBeCloseTo(4, 5);
    expect(comp.bodyGridBounds.width).toBeCloseTo(2, 5);
    expect(comp.bodyGridBounds.height).toBeCloseTo(2, 5);

    comp.destroy({ children: true });
  });

  it('bodyGridBounds strictly inside gridBounds for all rotations', () => {
    const rotations = [Direction.E, Direction.S, Direction.W, Direction.N];
    for (const dir of rotations) {
      const comp = makeAnd(2);
      comp.position.set(5, 5);
      comp.direction = dir;

      const b = comp.bodyGridBounds;
      const g = comp.gridBounds;
      expect(b.x).toBeGreaterThanOrEqual(g.x);
      expect(b.y).toBeGreaterThanOrEqual(g.y);
      expect(b.right).toBeLessThanOrEqual(g.right);
      expect(b.bottom).toBeLessThanOrEqual(g.bottom);

      comp.destroy({ children: true });
    }
  });
});

describe('Component.direction re-anchoring (legacy-editor behavior)', () => {
  beforeEach(() => {
    setStaticDIInjector(TestBed.inject(Injector));
  });

  it('keeps the body top-left fixed across every rotation', () => {
    const comp = makeAnd(3, Direction.E, 3, 4); // W=2, H=3
    const anchorX = comp.bodyGridBounds.x;
    const anchorY = comp.bodyGridBounds.y;

    for (const dir of [Direction.S, Direction.W, Direction.N, Direction.E]) {
      comp.direction = dir;
      expect(comp.bodyGridBounds.x).toBeCloseTo(anchorX, 5);
      expect(comp.bodyGridBounds.y).toBeCloseTo(anchorY, 5);
    }

    comp.destroy({ children: true });
  });

  it('shifts position to the rotation pivot per direction', () => {
    // Body anchor [3,4], W=2, H=3 → pivots E(3,4) S(6,4) W(5,7) N(3,6),
    // matching the v0→v1 migration's legacyAnchorToPivot offsets.
    const comp = makeAnd(3, Direction.E, 3, 4);

    const pivots: Record<Direction, [number, number]> = {
      [Direction.S]: [6, 4],
      [Direction.W]: [5, 7],
      [Direction.N]: [3, 6],
      [Direction.E]: [3, 4]
    };

    for (const dir of [Direction.S, Direction.W, Direction.N, Direction.E]) {
      comp.direction = dir;
      expect(comp.position.x).toBeCloseTo(pivots[dir][0], 5);
      expect(comp.position.y).toBeCloseTo(pivots[dir][1], 5);
    }

    comp.destroy({ children: true });
  });
});

describe('Component port-count re-anchoring (legacy-editor behavior)', () => {
  beforeEach(() => {
    setStaticDIInjector(TestBed.inject(Injector));
  });

  it('keeps the body top-left fixed when ports are added, in every direction', () => {
    for (const dir of [Direction.E, Direction.S, Direction.W, Direction.N]) {
      const comp = makeAnd(2, dir, 5, 5);
      const anchorX = comp.bodyGridBounds.x;
      const anchorY = comp.bodyGridBounds.y;

      comp.numInputs = 5;

      expect(comp.bodyGridBounds.x).toBeCloseTo(anchorX, 5);
      expect(comp.bodyGridBounds.y).toBeCloseTo(anchorY, 5);

      comp.destroy({ children: true });
    }
  });

  it('grows toward the bottom when horizontal-facing, the right when vertical-facing', () => {
    // E (horizontal): added inputs grow the body downward, width constant.
    const e = makeAnd(2, Direction.E, 0, 0);
    const eBefore = e.bodyGridBounds;
    e.numInputs = 5;
    expect(e.bodyGridBounds.width).toBeCloseTo(eBefore.width, 5);
    expect(e.bodyGridBounds.height).toBeGreaterThan(eBefore.height);
    e.destroy({ children: true });

    // S (vertical): added inputs grow the body rightward, height constant.
    const s = makeAnd(2, Direction.S, 0, 0);
    const sBefore = s.bodyGridBounds;
    s.numInputs = 5;
    expect(s.bodyGridBounds.height).toBeCloseTo(sBefore.height, 5);
    expect(s.bodyGridBounds.width).toBeGreaterThan(sBefore.width);
    s.destroy({ children: true });
  });
});

describe('Component port power', () => {
  let provider: GraphicsProviderService;

  beforeEach(() => {
    configureTestBed();
    provider = TestBed.inject(GraphicsProviderService);
  });

  function poweredContext() {
    return provider.getGraphicsContext(WireGraphics, POWERED_WIRE_THICKNESS);
  }

  function unpoweredContext() {
    return provider.getGraphicsContext(WireGraphics);
  }

  it('swaps only the addressed stub to the powered context', () => {
    const comp = makeAnd(2); // stubs 0,1 = inputs; 2 = output

    comp.setPortPowered(2, true);

    expect(comp.portStubs[2].context).toBe(poweredContext());
    expect(comp.portStubs[0].context).toBe(unpoweredContext());
    expect(comp.portStubs[1].context).toBe(unpoweredContext());

    comp.setPortPowered(2, false);
    expect(comp.portStubs[2].context).toBe(unpoweredContext());

    comp.destroy({ children: true });
  });

  it('preserves the powered stub across applyScale (no rebuild)', () => {
    const comp = makeAnd(2);

    comp.setPortPowered(0, true);
    const stubBefore = comp.portStubs[0];
    comp.applyScale(2);

    // applyScale updates scale-dependent props in place rather than rebuilding,
    // so the powered stub object and its context both survive untouched.
    expect(comp.portStubs[0]).toBe(stubBefore);
    expect(comp.portStubs[0].context).toBe(poweredContext());
    expect(comp.portStubs[1].context).toBe(unpoweredContext());

    comp.destroy({ children: true });
  });

  it('clearPortPower resets every stub, including across redraws', () => {
    const comp = makeAnd(2);

    comp.setPortPowered(0, true);
    comp.setPortPowered(2, true);
    comp.clearPortPower();

    for (const stub of comp.portStubs) {
      expect(stub.context).toBe(unpoweredContext());
    }
    comp.applyScale(2);
    for (const stub of comp.portStubs) {
      expect(stub.context).toBe(unpoweredContext());
    }

    comp.destroy({ children: true });
  });
});
