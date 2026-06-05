import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { setStaticDIInjector } from '../utils/get-di';
import { Component } from '../components/component';
import { Project } from '../project/project';
import { inputComponentConfig } from '../components/component-types/input/input.config';
import { outputComponentConfig } from '../components/component-types/output/output.config';
import { andComponentConfig } from '../components/component-types/and/and.config';
import { deriveSummary } from './definition-derivation';

describe('deriveSummary', () => {
  let project: Project;

  beforeEach(() => {
    setStaticDIInjector(TestBed.inject(Injector));
    project = new Project();
  });

  afterEach(() => {
    project.destroy({ children: true });
  });

  function addPlug(
    kind: 'input' | 'output',
    label: string,
    index: number,
    pos: [number, number]
  ): void {
    const config =
      kind === 'input' ? inputComponentConfig : outputComponentConfig;
    const plug = Component.deserialize(
      { pos, options: { label, index } },
      config
    );
    project.addComponent(plug);
  }

  it('returns an empty summary for a circuit with no plugs', () => {
    expect(deriveSummary(project)).toEqual({
      numInputs: 0,
      numOutputs: 0,
      labels: []
    });
  });

  it('counts inputs and outputs and lists inputs before outputs', () => {
    addPlug('input', 'A', 0, [0, 0]);
    addPlug('input', 'B', 1, [0, 5]);
    addPlug('output', 'Q', 0, [10, 0]);

    expect(deriveSummary(project)).toEqual({
      numInputs: 2,
      numOutputs: 1,
      labels: ['A', 'B', 'Q']
    });
  });

  it('orders each group by the plug index option', () => {
    // Placed out of index order — derivation must sort by `index`. Labels stay
    // within the plug's 5-char limit (the `s` wire slot / backend column cap).
    addPlug('input', 'in1', 1, [0, 0]);
    addPlug('input', 'in0', 0, [0, 5]);
    addPlug('output', 'out1', 1, [10, 0]);
    addPlug('output', 'out0', 0, [10, 5]);

    expect(deriveSummary(project).labels).toEqual([
      'in0',
      'in1',
      'out0',
      'out1'
    ]);
  });

  it('ignores non-plug components', () => {
    addPlug('input', 'A', 0, [0, 0]);
    const and = Component.deserialize(
      { pos: [10, 10], options: { numInputs: 2 } },
      andComponentConfig
    );
    project.addComponent(and);

    const summary = deriveSummary(project);
    expect(summary.numInputs).toBe(1);
    expect(summary.numOutputs).toBe(0);
    expect(summary.labels).toEqual(['A']);
  });

  it('falls back to instance-id order for duplicate indices (never throws)', () => {
    // Two inputs both at index 0 — defensive tiebreak by insertion/id order.
    addPlug('input', 'A', 0, [0, 0]);
    addPlug('input', 'B', 0, [0, 5]);

    const summary = deriveSummary(project);
    expect(summary.numInputs).toBe(2);
    expect(summary.labels).toEqual(['A', 'B']);
  });
});
