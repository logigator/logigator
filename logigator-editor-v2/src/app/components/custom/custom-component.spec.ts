import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Container, BitmapText } from 'pixi.js';
import { PX } from '../../utils/grid';
import { CANVAS_FONT_FAMILY } from '../../utils/text-fit';
import { Direction } from '../../utils/direction';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { Component } from '../component';
import { ComponentProviderService } from '../component-provider.service';
import { Project } from '../../project/project';
import { CustomComponentRegistry } from './custom-component-registry.service';
import { CustomComponent } from './custom-component';

/** All BitmapText nodes rendered anywhere under `container` (symbol + port labels). */
function renderedTextNodes(container: Container): BitmapText[] {
  const out: BitmapText[] = [];
  const walk = (c: Container): void => {
    for (const child of c.children) {
      if (child instanceof BitmapText) out.push(child);
      else walk(child as Container);
    }
  };
  walk(container);
  return out;
}

/** All BitmapText strings rendered anywhere under `container` (symbol + port labels). */
function renderedTexts(container: Container): string[] {
  return renderedTextNodes(container).map((t) => t.text);
}

describe('CustomComponent', () => {
  let registry: CustomComponentRegistry;
  let provider: ComponentProviderService;

  beforeEach(() => {
    configureTestBed();
    registry = TestBed.inject(CustomComponentRegistry);
    provider = TestBed.inject(ComponentProviderService);
  });

  /** Place an instance by snapshotting the master's CURRENT state (the place flow). */
  function placeLatest(masterTypeId: number): CustomComponent {
    const snap = registry.snapshot(masterTypeId);
    const config = provider.getComponent(snap.typeId)!;
    return Component.deserialize(
      { pos: [0, 0], options: {} },
      config
    ) as CustomComponent;
  }

  it('takes its port counts from the snapshot definition, not the element', () => {
    const master = registry.createMaster(
      { symbol: 'CC', numInputs: 2, numOutputs: 1, labels: ['A', 'B', 'Q'] },
      'browser'
    );
    // `i`/`o` on the element are intentionally ignored for customs (Invariant A).
    const instance = placeLatest(master);

    expect(instance.numInputs).toBe(2);
    expect(instance.numOutputs).toBe(1);

    instance.destroy({ children: true });
  });

  it('renders the symbol and the definition labels', () => {
    const master = registry.createMaster(
      { symbol: 'CC', numInputs: 2, numOutputs: 1, labels: ['A', 'B', 'Q'] },
      'browser'
    );
    const instance = placeLatest(master);

    const texts = renderedTexts(instance);
    expect(texts).toContain('CC');
    expect(texts).toContain('A');
    expect(texts).toContain('B');
    expect(texts).toContain('Q');

    instance.destroy({ children: true });
  });

  it('is frozen: editing the master does NOT change an already-placed instance', () => {
    const master = registry.createMaster(
      { symbol: 'CC', numInputs: 1, numOutputs: 1, labels: ['A', 'Q'] },
      'browser'
    );
    const instance = placeLatest(master);

    registry.updateDefinition(master, {
      numInputs: 2,
      numOutputs: 2,
      labels: ['A', 'B', 'Q', 'R']
    });

    expect(instance.numInputs).toBe(1);
    expect(instance.numOutputs).toBe(1);
    const texts = renderedTexts(instance);
    expect(texts).toContain('A');
    expect(texts).toContain('Q');
    expect(texts).not.toContain('B');
    expect(texts).not.toContain('R');

    instance.destroy({ children: true });
  });

  it('snapshot-at-place-time: a new placement after a master edit reflects the new shape', () => {
    const master = registry.createMaster(
      { symbol: 'CC', numInputs: 1, numOutputs: 1, labels: ['A', 'Q'] },
      'browser'
    );
    const before = placeLatest(master);

    registry.updateDefinition(master, {
      numInputs: 3,
      numOutputs: 0,
      labels: ['A', 'B', 'C']
    });
    const after = placeLatest(master);

    // The freshly-placed instance has the new shape...
    expect(after.numInputs).toBe(3);
    expect(after.numOutputs).toBe(0);
    expect(renderedTexts(after)).toContain('C');
    // ...while the earlier instance stays frozen.
    expect(before.numInputs).toBe(1);
    expect(renderedTexts(before)).not.toContain('C');

    before.destroy({ children: true });
    after.destroy({ children: true });
  });

  it('fits port labels to their slot: full size in E, shrunk to the grid pitch in S', () => {
    const master = registry.createMaster(
      { symbol: 'CC', numInputs: 2, numOutputs: 1, labels: ['LONG', 'A', 'Q'] },
      'browser'
    );
    const instance = placeLatest(master);
    const label = (text: string): BitmapText => {
      const found = renderedTextNodes(instance).find((t) => t.text === text);
      expect(found, `label ${text}`).toBeDefined();
      return found!;
    };

    // E: half the 3-grid body minus insets (20 px) holds "LONG" at the base
    // 0.45-grid size.
    expect(label('LONG').style.fontFamily).toBe(CANVAS_FONT_FAMILY);
    expect(label('LONG').style.fontSize).toBeCloseTo(0.45 / PX, 5);

    // S: the slot is the grid pitch minus clearance (14 px) — "LONG" at the
    // 0.6-em advance shrinks to exactly fill it, "A" keeps the base size.
    instance.direction = Direction.S;
    expect(label('LONG').style.fontSize).toBeCloseTo(14 / (0.6 * 4), 5);
    expect(label('A').style.fontSize).toBeCloseTo(0.45 / PX, 5);

    instance.destroy({ children: true });
  });

  it('fits the symbol to the rotated screen width of the body', () => {
    const master = registry.createMaster(
      {
        symbol: 'COUNTER99XX',
        numInputs: 2,
        numOutputs: 1,
        labels: ['A', 'B', 'Q']
      },
      'browser'
    );
    const instance = placeLatest(master);
    const symbol = (): BitmapText =>
      renderedTextNodes(instance).find((t) => t.text === 'COUNTER99XX')!;

    // E: labels flank the symbol, so it gets half the 3-grid body minus the
    // clearance (20 px) — far too little for 11 glyphs, so it floors.
    expect(symbol().style.fontSize).toBeCloseTo(0.25 / PX, 5);

    // S: the upright symbol spans the body's screen width, which is now the
    // 2-grid body *height* minus the clearance (28 px).
    instance.direction = Direction.S;
    expect(symbol().style.fontSize).toBeCloseTo(28 / (0.6 * 11), 5);

    instance.destroy({ children: true });
  });

  it('integrates into a Project and is found by spatial queries', () => {
    const project = new Project();
    const master = registry.createMaster(
      { symbol: 'CC', numInputs: 2, numOutputs: 1, labels: ['A', 'B', 'Q'] },
      'browser'
    );
    const instance = placeLatest(master);
    instance.position.set(5, 5);
    project.addComponent(instance);

    expect([...project.queryComponentsInRange(instance.gridBounds)]).toContain(
      instance
    );

    project.destroy({ children: true });
  });
});
