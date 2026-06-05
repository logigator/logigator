import { describe, beforeEach, it, expect, vi } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Container, Text } from 'pixi.js';
import { setStaticDIInjector } from '../../utils/get-di';
import { Component } from '../component';
import { ComponentProviderService } from '../component-provider.service';
import { Project } from '../../project/project';
import { CustomComponentRegistry } from './custom-component-registry.service';
import { CustomComponent } from './custom-component';

/** All Text strings rendered anywhere under `container` (symbol + port labels). */
function renderedTexts(container: Container): string[] {
  const out: string[] = [];
  const walk = (c: Container): void => {
    for (const child of c.children) {
      if (child instanceof Text) out.push(child.text);
      else walk(child as Container);
    }
  };
  walk(container);
  return out;
}

describe('CustomComponent', () => {
  let registry: CustomComponentRegistry;
  let provider: ComponentProviderService;

  beforeEach(() => {
    setStaticDIInjector(TestBed.inject(Injector));
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
