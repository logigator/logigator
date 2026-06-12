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

  it('Right: origin at position, size = body only (no stubs)', () => {
    const comp = makeAnd(2); // height=2
    comp.position.set(3, 5);
    comp.direction = Direction.E;

    expect(comp.bodyGridBounds.x).toBeCloseTo(3, 5);
    expect(comp.bodyGridBounds.y).toBeCloseTo(5, 5);
    expect(comp.bodyGridBounds.width).toBeCloseTo(2, 5);
    expect(comp.bodyGridBounds.height).toBeCloseTo(2, 5);

    comp.destroy({ children: true });
  });

  it('Down: rotated AABB', () => {
    const comp = makeAnd(2); // bodyGridWidth=2, h=2
    comp.position.set(4, 3);
    comp.direction = Direction.S;

    // Down: Rectangle(x - h, y, h, w) = (4-2, 3, 2, 2)
    expect(comp.bodyGridBounds.x).toBeCloseTo(2, 5);
    expect(comp.bodyGridBounds.y).toBeCloseTo(3, 5);
    expect(comp.bodyGridBounds.width).toBeCloseTo(2, 5);
    expect(comp.bodyGridBounds.height).toBeCloseTo(2, 5);

    comp.destroy({ children: true });
  });

  it('Left: rotated AABB', () => {
    const comp = makeAnd(2);
    comp.position.set(4, 4);
    comp.direction = Direction.W;

    // Left: Rectangle(x - w, y - h, w, h) = (4-2, 4-2, 2, 2)
    expect(comp.bodyGridBounds.x).toBeCloseTo(2, 5);
    expect(comp.bodyGridBounds.y).toBeCloseTo(2, 5);
    expect(comp.bodyGridBounds.width).toBeCloseTo(2, 5);
    expect(comp.bodyGridBounds.height).toBeCloseTo(2, 5);

    comp.destroy({ children: true });
  });

  it('Up: rotated AABB', () => {
    const comp = makeAnd(2);
    comp.position.set(3, 6);
    comp.direction = Direction.N;

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

  it('survives a forced redraw (applyScale mid-power)', () => {
    const comp = makeAnd(2);

    comp.setPortPowered(0, true);
    const stubBefore = comp.portStubs[0];
    comp.applyScale(2);

    // The redraw rebuilt the stub registry and re-applied the power state.
    expect(comp.portStubs[0]).not.toBe(stubBefore);
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
