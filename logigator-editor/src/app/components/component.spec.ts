import { beforeEach, describe, expect, it } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Container, BitmapText } from 'pixi.js';
import { setStaticDIInjector } from '../utils/get-di';
import { Component } from './component';
import { ComponentConfig } from './component-config.model';
import { andComponentConfig } from './component-types/and/and.config';
import { romComponentConfig } from './component-types/rom/rom.config';
import { PX } from '../utils/grid';
import { Direction } from '../utils/direction';
import {
  makeAnd,
  makeButton,
  makeInput,
  makeSwitch
} from '../../testing/factories';
import { AndComponent } from './component-types/and/and.component';
import { configureTestBed } from '../../testing/configure-test-bed';
import { GraphicsProviderService } from '../rendering/graphics-provider.service';
import {
  POWERED_WIRE_PIVOT,
  POWERED_WIRE_THICKNESS,
  WireGraphics
} from '../rendering/graphics/wire.graphics';
import {
  NegationBubbleGraphics,
  scaleForScale,
  BORDER
} from '../rendering/graphics/negation-bubble.graphics';
import { environment } from '../../environments/environment';

describe('Component.deserialize (create() factory)', () => {
  beforeEach(() => {
    setStaticDIInjector(TestBed.inject(Injector));
  });

  it('builds an instance of the config implementation via create()', () => {
    const comp = Component.deserialize(
      { pos: [4, 7], options: { numInputs: 3 } },
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
        options: { numInputs: 2 }
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

describe('Component.connectionPoints', () => {
  beforeEach(() => {
    configureTestBed();
  });

  it('places ports at the stub tips (inputs at -0.5, outputs at body width + 0.5)', () => {
    const comp = makeAnd(2, Direction.E, 3, 5); // bodyGridWidth=2

    expect(comp.connectionPoints.map((p) => `${p.x},${p.y}`)).toEqual([
      '2.5,5.5',
      '2.5,6.5',
      '5.5,5.5'
    ]);

    comp.destroy({ children: true });
  });

  it('keeps ports at the stub tips at far zoom-out scales, where the screen-constant body stroke outgrows the stub tip', () => {
    const comp = makeAnd(2, Direction.E, 3, 5);
    const before = comp.connectionPoints.map((p) => `${p.x},${p.y}`);

    comp.applyScale(Math.pow(1.2, -12));

    expect(comp.connectionPoints.map((p) => `${p.x},${p.y}`)).toEqual(before);

    comp.destroy({ children: true });
  });

  it('lands exactly on the half-grid lattice in every direction, even near the origin', () => {
    // Near the origin the coordinates are small enough that trig-based
    // rotation noise (~1e-16) would survive the position offset and produce
    // off-lattice values like -0.4999999999999998.
    for (const dir of [Direction.E, Direction.S, Direction.W, Direction.N]) {
      const comp = makeAnd(2, dir, 1, 1);
      for (const p of comp.connectionPoints) {
        expect(Number.isInteger(p.x * 2)).toBe(true);
        expect(Number.isInteger(p.y * 2)).toBe(true);
      }
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

describe('Component port-stub pixel side', () => {
  beforeEach(() => {
    configureTestBed();
  });

  // The stub's 1-px thickness hangs on one side of the port centre-line; the
  // W/N rotations must mirror it (scale.y < 0) so it rasterizes onto the same
  // screen-side pixel as a connecting wire (below for horizontal, left for
  // vertical).
  it.each([
    [Direction.E, 1],
    [Direction.S, 1],
    [Direction.W, -1],
    [Direction.N, -1]
  ])('hangs the stub on the wire-side pixel (direction %i)', (dir, sign) => {
    const comp = makeAnd(2, dir);

    expect(comp.portStubs.length).toBe(3);
    for (const stub of comp.portStubs) {
      expect(Math.sign(stub.scale.y)).toBe(sign);
    }

    comp.destroy({ children: true });
  });

  it('re-applies the stub side on a runtime rotation', () => {
    const comp = makeAnd(2, Direction.E);

    comp.direction = Direction.N;
    for (const stub of comp.portStubs) {
      expect(Math.sign(stub.scale.y)).toBe(-1);
    }

    comp.direction = Direction.S;
    for (const stub of comp.portStubs) {
      expect(Math.sign(stub.scale.y)).toBe(1);
    }

    comp.destroy({ children: true });
  });
});

describe('Component port-label anchoring', () => {
  beforeEach(() => {
    configureTestBed();
  });

  function makeRom(direction: Direction): Component {
    return Component.deserialize(
      {
        pos: [0, 0],
        ...(direction ? { direction } : {}),
        options: {}
      },
      romComponentConfig as unknown as ComponentConfig
    );
  }

  function labelText(comp: Component, label: string): BitmapText {
    let found: BitmapText | undefined;
    const walk = (c: Container): void => {
      for (const child of c.children) {
        if (child instanceof BitmapText && child.text === label) found = child;
        else walk(child as Container);
      }
    };
    walk(comp);
    expect(found, `label ${label}`).toBeDefined();
    return found!;
  }

  // Labels anchor to the body edge they sit on (edge-facing texture point,
  // fixed inset), so every label on an edge keeps the same depth regardless
  // of its text width — in every direction.
  it.each([
    [Direction.E, { x: 0, y: 0.5 }, { x: 1, y: 0.5 }],
    [Direction.S, { x: 0.5, y: 0 }, { x: 0.5, y: 1 }],
    [Direction.W, { x: 1, y: 0.5 }, { x: 0, y: 0.5 }],
    [Direction.N, { x: 0.5, y: 1 }, { x: 0.5, y: 0 }]
  ])(
    'anchors labels edge-facing (direction %i)',
    (direction, inAnchor, outAnchor) => {
      const comp = makeRom(direction);

      const input = labelText(comp, 'A1');
      expect({ x: input.anchor.x, y: input.anchor.y }).toEqual(inAnchor);
      expect(input.position.x).toBeCloseTo(0.5 + 2 * PX, 5);
      expect(input.position.y).toBeCloseTo(0.5, 5);

      const output = labelText(comp, 'O1');
      expect({ x: output.anchor.x, y: output.anchor.y }).toEqual(outAnchor);
      expect(output.position.x).toBeCloseTo(-2 * PX, 5);
      expect(output.position.y).toBeCloseTo(0.5, 5);

      comp.destroy({ children: true });
    }
  );

  it('re-anchors labels on a runtime rotation', () => {
    const comp = makeRom(Direction.E);

    comp.direction = Direction.S;

    const input = labelText(comp, 'A1');
    expect({ x: input.anchor.x, y: input.anchor.y }).toEqual({ x: 0.5, y: 0 });

    comp.destroy({ children: true });
  });
});

describe('Component symbol rendering', () => {
  beforeEach(() => {
    configureTestBed();
  });

  function findText(comp: Component, value: string): BitmapText | undefined {
    let found: BitmapText | undefined;
    const walk = (c: Container): void => {
      for (const child of c.children) {
        if (child instanceof BitmapText && child.text === value) found = child;
        else walk(child as Container);
      }
    };
    walk(comp);
    return found;
  }

  it('renders the config symbol centred in the body', () => {
    const comp = makeAnd(2);

    const symbol = findText(comp, '&');
    expect(symbol).toBeDefined();
    expect(symbol!.anchor.x).toBe(0.5);
    expect(symbol!.anchor.y).toBe(0.5);
    expect(symbol!.position.x).toBeCloseTo(1, 5);
    expect(symbol!.position.y).toBeCloseTo(1, 5);

    comp.destroy({ children: true });
  });

  it('renders no symbol on components with a dedicated body visual', () => {
    for (const comp of [makeButton(), makeSwitch()]) {
      let texts = 0;
      const walk = (c: Container): void => {
        for (const child of c.children) {
          if (child instanceof BitmapText) texts++;
          else walk(child as Container);
        }
      };
      walk(comp);
      expect(texts).toBe(0);
      comp.destroy({ children: true });
    }
  });

  it('fits plug symbols to the 1-grid body', () => {
    const comp = makeInput();

    const symbol = findText(comp, 'IN');
    expect(symbol).toBeDefined();
    // No labels → the full 1-grid body minus the clearance (12 px).
    expect(symbol!.style.fontSize).toBeCloseTo(12 / (0.6 * 2), 5);

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

  // Stub cross-axis scale for the default E facing (sign +1) at a zoom scale.
  function stubScaleY(powered: boolean, scale = 1) {
    return (PX / scale) * (powered ? POWERED_WIRE_THICKNESS : 1);
  }

  it('thickens only the addressed stub, keeping the shared context', () => {
    const comp = makeAnd(2); // stubs 0,1 = inputs; 2 = output
    const sharedContext = provider.getGraphicsContext(WireGraphics);

    // The per-frame hot path: powered state must land as transform only — a
    // context swap or redraw would force a render-group instruction rebuild.
    comp.setPortPowered(2, true);

    expect(comp.portStubs[2].context).toBe(sharedContext);
    expect(comp.portStubs[2].scale.y).toBeCloseTo(stubScaleY(true), 8);
    expect(comp.portStubs[2].pivot.y).toBeCloseTo(POWERED_WIRE_PIVOT, 8);
    expect(comp.portStubs[0].scale.y).toBeCloseTo(stubScaleY(false), 8);
    expect(comp.portStubs[1].scale.y).toBeCloseTo(stubScaleY(false), 8);

    comp.setPortPowered(2, false);
    expect(comp.portStubs[2].scale.y).toBeCloseTo(stubScaleY(false), 8);
    expect(comp.portStubs[2].pivot.y).toBe(0);

    comp.destroy({ children: true });
  });

  it('preserves the powered stub across applyScale (no rebuild)', () => {
    const comp = makeAnd(2);

    comp.setPortPowered(0, true);
    const stubBefore = comp.portStubs[0];
    comp.applyScale(2);

    // applyScale updates scale-dependent props in place rather than rebuilding,
    // so the powered stub object and its thickness both survive.
    expect(comp.portStubs[0]).toBe(stubBefore);
    expect(comp.portStubs[0].scale.y).toBeCloseTo(stubScaleY(true, 2), 8);
    expect(comp.portStubs[1].scale.y).toBeCloseTo(stubScaleY(false, 2), 8);

    comp.destroy({ children: true });
  });

  it('re-applies powered thickness to the rebuilt stubs on redraw', () => {
    const comp = makeAnd(2);

    comp.setPortPowered(0, true);
    comp.redraw();

    expect(comp.portStubs[0].scale.y).toBeCloseTo(stubScaleY(true), 8);
    expect(comp.portStubs[1].scale.y).toBeCloseTo(stubScaleY(false), 8);

    comp.destroy({ children: true });
  });

  it('clearPortPower resets every stub, including across redraws', () => {
    const comp = makeAnd(2);

    comp.setPortPowered(0, true);
    comp.setPortPowered(2, true);
    comp.clearPortPower();

    for (const stub of comp.portStubs) {
      expect(stub.scale.y).toBeCloseTo(stubScaleY(false), 8);
      expect(stub.pivot.y).toBe(0);
    }
    comp.applyScale(2);
    for (const stub of comp.portStubs) {
      expect(stub.scale.y).toBeCloseTo(stubScaleY(false, 2), 8);
    }

    comp.destroy({ children: true });
  });
});

describe('Component port negation', () => {
  beforeEach(() => {
    configureTestBed();
  });

  it('has no negated ports by default', () => {
    const comp = makeAnd(2);

    expect(comp.negatedInputs.size).toBe(0);
    expect(comp.negatedOutputs.size).toBe(0);
    expect(comp.isPortNegated('in', 0)).toBe(false);
    expect(comp.isPortNegated('out', 0)).toBe(false);

    comp.destroy({ children: true });
  });

  it('toggles a single port on and off', () => {
    const comp = makeAnd(2);

    comp.setPortNegated('in', 1, true);
    expect(comp.isPortNegated('in', 1)).toBe(true);
    expect([...comp.negatedInputs]).toEqual([1]);

    comp.setPortNegated('in', 1, false);
    expect(comp.isPortNegated('in', 1)).toBe(false);
    expect(comp.negatedInputs.size).toBe(0);

    comp.destroy({ children: true });
  });

  it('keeps input and output negation sets independent', () => {
    const comp = makeAnd(2);

    comp.setPortNegated('in', 0, true);
    comp.setPortNegated('out', 0, true);

    expect(comp.isPortNegated('in', 0)).toBe(true);
    expect(comp.isPortNegated('out', 0)).toBe(true);

    comp.setPortNegated('in', 0, false);
    // Dropping input 0 must not disturb output 0.
    expect(comp.isPortNegated('out', 0)).toBe(true);

    comp.destroy({ children: true });
  });

  it('redraws on a real change but not on a redundant set', () => {
    const comp = makeAnd(2);
    let draws = 0;
    const originalRedraw = comp.redraw.bind(comp);
    comp.redraw = () => {
      draws++;
      originalRedraw();
    };

    comp.setPortNegated('in', 0, true);
    expect(draws).toBe(1);

    // Already negated — no state change, so no redraw.
    comp.setPortNegated('in', 0, true);
    expect(draws).toBe(1);

    comp.destroy({ children: true });
  });

  it('does not prune out-of-range indices on a port-count shrink (lazy resize)', () => {
    const comp = makeAnd(5);

    comp.setPortNegated('in', 3, true);
    expect(comp.isPortNegated('in', 3)).toBe(true);

    // Shrinking below the negated index keeps it: the setter never mutates the
    // negation set, so a shrink-then-grow round-trip preserves negation and the
    // count change stays undoable via ChangeOptionAction.
    comp.numInputs = 2;
    expect(comp.isPortNegated('in', 3)).toBe(true);

    comp.numInputs = 5;
    expect(comp.isPortNegated('in', 3)).toBe(true);

    comp.destroy({ children: true });
  });

  it('supports indices beyond a 32-bit word (no bitmask limit)', () => {
    const comp = makeAnd(50);

    comp.setPortNegated('in', 40, true);
    expect(comp.isPortNegated('in', 40)).toBe(true);

    comp.destroy({ children: true });
  });
});

describe('Component negation bubble rendering', () => {
  let provider: GraphicsProviderService;

  beforeEach(() => {
    configureTestBed();
    provider = TestBed.inject(GraphicsProviderService);
  });

  function bubbleContext(scale: number) {
    return provider.getGraphicsContext(NegationBubbleGraphics, scale);
  }

  it('draws no bubbles when nothing is negated', () => {
    const comp = makeAnd(2);

    expect(comp.portBubbles.size).toBe(0);

    comp.destroy({ children: true });
  });

  it('adds a bubble keyed by the connectionPoints index for inputs', () => {
    const comp = makeAnd(2); // inputs 0,1; output 2

    comp.setPortNegated('in', 1, true);

    expect(comp.portBubbles.has(1)).toBe(true);
    expect(comp.portBubbles.size).toBe(1);

    comp.destroy({ children: true });
  });

  it('keys an output bubble by numInputs + index', () => {
    const comp = makeAnd(2); // output port index = 2

    comp.setPortNegated('out', 0, true);

    expect(comp.portBubbles.has(2)).toBe(true);

    comp.destroy({ children: true });
  });

  it('removes the bubble when the port is un-negated', () => {
    const comp = makeAnd(2);

    comp.setPortNegated('in', 0, true);
    expect(comp.portBubbles.has(0)).toBe(true);

    comp.setPortNegated('in', 0, false);
    expect(comp.portBubbles.has(0)).toBe(false);

    comp.destroy({ children: true });
  });

  it('pins the bubble by its tangent pivot to the body edge of the stub', () => {
    const comp = makeAnd(2);

    comp.setPortNegated('in', 0, true);
    comp.setPortNegated('out', 0, true);

    // Stub container origins are x=-0.5 (inputs) / x=bodyGridWidth (outputs), so
    // the body edge is at container-local x=0.5 (inputs) / x=0 (outputs). The
    // bubble is pinned there by the tangent extreme of its unit circle (+0.5 for
    // inputs, -0.5 for outputs), from which it grows outward along the stub.
    const inputBubble = comp.portBubbles.get(0)!;
    expect(inputBubble.position.x).toBeCloseTo(0.5, 5);
    expect(inputBubble.pivot.x).toBeCloseTo(0.5, 5);

    const outputBubble = comp.portBubbles.get(2)!;
    expect(outputBubble.position.x).toBeCloseTo(0, 5);
    expect(outputBubble.pivot.x).toBeCloseTo(-0.5, 5);

    comp.destroy({ children: true });
  });

  it('anchors the bubble at its body-edge tangent point (E facing)', () => {
    const comp = makeAnd(2, Direction.E, 4, 7); // bodyGridWidth = 2

    const input0 = comp.negationBubbleAnchor('in', 0);
    expect(input0.x).toBeCloseTo(4, 5);
    expect(input0.y).toBeCloseTo(7.5, 5);

    const output0 = comp.negationBubbleAnchor('out', 0);
    expect(output0.x).toBeCloseTo(4 + 2, 5);
    expect(output0.y).toBeCloseTo(7.5, 5);

    comp.destroy({ children: true });
  });

  it('keeps the bubble anchor at the body edge (half a unit from the tip) across all rotations', () => {
    // The anchor sits on the body edge, i.e. half a grid unit from the
    // connection-point tip. Rotation is rigid, so that offset is invariant —
    // this pins the negationBubbleAnchor rotation math the hover ghost relies on.
    for (const dir of [Direction.E, Direction.S, Direction.W, Direction.N]) {
      const comp = makeAnd(2, dir, 5, 5);
      const anchor = comp.negationBubbleAnchor('in', 0);
      const tip = comp.connectionPoints[0];
      expect(Math.hypot(anchor.x - tip.x, anchor.y - tip.y)).toBeCloseTo(
        0.5,
        5
      );
      comp.destroy({ children: true });
    }
  });

  it('keeps the same bubble Graphics across applyScale, resizing it and re-fetching its zoom-baked context', () => {
    const comp = makeAnd(2);

    comp.setPortNegated('in', 0, true);
    const bubbleBefore = comp.portBubbles.get(0);
    comp.applyScale(2);

    // Same Graphics instance (no rebuild), sized by transform...
    expect(comp.portBubbles.get(0)).toBe(bubbleBefore);
    expect(comp.portBubbles.get(0)!.scale.x).toBeCloseTo(scaleForScale(2), 5);
    // ...with the context re-fetched for this zoom (keeps the border 1px).
    expect(comp.portBubbles.get(0)!.context).toBe(bubbleContext(2));

    comp.destroy({ children: true });
  });

  it('bakes the border to a screen-constant BORDER·gridSize (1px) across the whole zoom curve', () => {
    // The white dot rides the uniform transform (scaleForScale), which would
    // drag the border with it — so the baked width divides it back out.
    // Rendered border px = baked width × world scale, world scale = transform ×
    // gridSize × zoom. Spans the curve's floored, scale-with-board, and capped
    // regimes; the border reads the same in all three because the transform
    // cancels identically in the dot size and the stroke.
    for (const scale of [0.2, 0.5, 1, 3]) {
      const width = bubbleContext(scale).strokeStyle.width;
      const renderedPx =
        width * scaleForScale(scale) * environment.gridSize * scale;
      expect(renderedPx).toBeCloseTo(BORDER * environment.gridSize, 5);
    }
  });
});

describe('Component negation serialization', () => {
  beforeEach(() => {
    configureTestBed();
  });

  it('serializes negation as sorted within-group arrays, omitting empty groups', () => {
    const comp = makeAnd(3); // inputs 0,1,2; output 0
    comp.setPortNegated('in', 2, true);
    comp.setPortNegated('in', 0, true);

    const s = Component.serialize(comp);

    expect(s.negInputs).toEqual([0, 2]);
    expect('negOutputs' in s).toBe(false);

    comp.destroy({ children: true });
  });

  it('omits both groups when nothing is negated', () => {
    const comp = makeAnd(2);

    const s = Component.serialize(comp);

    expect('negInputs' in s).toBe(false);
    expect('negOutputs' in s).toBe(false);

    comp.destroy({ children: true });
  });

  it('drops out-of-range indices left by a shrink (normalize on serialize)', () => {
    const comp = makeAnd(5);
    comp.setPortNegated('in', 4, true);
    comp.numInputs = 2; // index 4 stays in the set but is now out of range

    const s = Component.serialize(comp);

    expect('negInputs' in s).toBe(false);

    comp.destroy({ children: true });
  });

  it('deserializes negation back onto the ports (with bubbles)', () => {
    const comp = Component.deserialize(
      {
        pos: [0, 0],
        options: { numInputs: 3 },
        negInputs: [1],
        negOutputs: [0]
      },
      andComponentConfig
    );

    expect(comp.isPortNegated('in', 1)).toBe(true);
    expect(comp.isPortNegated('out', 0)).toBe(true);
    expect(comp.portBubbles.has(1)).toBe(true); // input 1
    expect(comp.portBubbles.has(3)).toBe(true); // output 0 = numInputs + 0

    comp.destroy({ children: true });
  });

  it('round-trips serialize → deserialize', () => {
    const comp = makeAnd(3);
    comp.setPortNegated('in', 2, true);
    comp.setPortNegated('out', 0, true);

    const restored = Component.deserialize(
      Component.serialize(comp),
      andComponentConfig
    );

    expect([...restored.negatedInputs]).toEqual([2]);
    expect([...restored.negatedOutputs]).toEqual([0]);

    comp.destroy({ children: true });
    restored.destroy({ children: true });
  });

  it('treats a serialized form without negation fields as no negation', () => {
    const comp = Component.deserialize(
      { pos: [0, 0], options: { numInputs: 2 } },
      andComponentConfig
    );

    expect(comp.negatedInputs.size).toBe(0);
    expect(comp.negatedOutputs.size).toBe(0);

    comp.destroy({ children: true });
  });
});
