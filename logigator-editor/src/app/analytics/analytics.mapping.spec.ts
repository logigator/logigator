import { describe, it, expect } from 'vitest';
import { operationProperties, sanitizeProperties } from './analytics.mapping';
import { SerializedAction } from '../actions/serialized-action.model';

describe('sanitizeProperties', () => {
  it('keeps primitives and truncates over-long strings', () => {
    const long = 'x'.repeat(200);
    const result = sanitizeProperties({
      count: 3,
      negated: true,
      mode: 'wireTool',
      blob: long
    });

    expect(result).toEqual({
      count: 3,
      negated: true,
      mode: 'wireTool',
      blob: 'x'.repeat(64)
    });
  });

  it('drops nested objects and functions so free-form content cannot leak', () => {
    const result = sanitizeProperties({
      operation: 'changeOption',
      // A ROM blob / component config would arrive as a nested object.
      value: { rom: [1, 2, 3], label: 'secret name' },
      callback: () => undefined
    });

    expect(result).toEqual({ operation: 'changeOption' });
  });

  it('keeps flat categorical arrays but strips non-primitive items', () => {
    const result = sanitizeProperties({
      componentTypes: [1, 2, 3, { nested: true }]
    });

    expect(result).toEqual({ componentTypes: [1, 2, 3] });
  });
});

describe('operationProperties', () => {
  it('captures the changed option key but never its value', () => {
    const action: SerializedAction = {
      type: 'changeOption',
      componentId: 42,
      optionKey: 'label',
      oldValue: 'old secret label',
      newValue: 'new secret label'
    };

    const props = operationProperties(action);

    expect(props).toEqual({ operation: 'changeOption', optionKey: 'label' });
    expect(props).not.toHaveProperty('oldValue');
    expect(props).not.toHaveProperty('newValue');
    expect(props).not.toHaveProperty('componentId');
  });

  it('reports placed component types and count, not element ids', () => {
    const action: SerializedAction = {
      type: 'addComponents',
      components: [
        { id: 7, type: 3 } as never,
        { id: 8, type: 5 } as never
      ]
    };

    expect(operationProperties(action)).toEqual({
      operation: 'addComponents',
      count: 2,
      componentTypes: [3, 5]
    });
  });

  it('captures negation side and flag without the component id', () => {
    const props = operationProperties({
      type: 'togglePortNegation',
      componentId: 12,
      side: 0 as never,
      index: 1,
      negated: true
    });

    expect(props).toEqual({
      operation: 'togglePortNegation',
      side: 0,
      negated: true
    });
  });

  it('reports element counts for wire and move operations', () => {
    expect(
      operationProperties({
        type: 'addWires',
        wires: [{} as never, {} as never, {} as never]
      })
    ).toEqual({ operation: 'addWires', count: 3 });

    expect(
      operationProperties({
        type: 'moveComponents',
        entries: [{ id: 1, oldPos: [0, 0], newPos: [1, 1] }]
      })
    ).toEqual({ operation: 'moveComponents', count: 1 });
  });
});
