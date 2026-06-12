import type { MockedObject } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReorderPlugsAction } from './reorder-plugs.action';
import { ComponentOption } from '../../components/component-option';
import type { Component } from '../../components/component';
import type { Project } from '../../project/project';

class IndexOption extends ComponentOption<number> {
  public readonly label = 'components.options.index' as never;
  public readonly renderer = class {} as never;
  constructor(value: number) {
    super(value);
  }
  protected cloneWithValue(initialValue?: number): ComponentOption<number> {
    return new IndexOption(initialValue ?? this.value);
  }
}

describe('ReorderPlugsAction', () => {
  let options: Map<number, IndexOption>;
  let project: MockedObject<Project>;

  beforeEach(() => {
    options = new Map([
      [1, new IndexOption(0)],
      [2, new IndexOption(1)],
      [3, new IndexOption(2)]
    ]);
    project = {
      getComponentById: vi.fn().mockName('Project.getComponentById')
    } as unknown as MockedObject<Project>;
    project.getComponentById.mockImplementation(
      (id: number) =>
        ({ options: { index: options.get(id) } }) as unknown as Component
    );
  });

  it('do() rewrites each changed plug index to its list position', () => {
    // Move plug 3 (index 2) to the front: new order [3, 1, 2] -> indices 0,1,2.
    const action = new ReorderPlugsAction([
      { componentId: 3, oldIndex: 2, newIndex: 0 },
      { componentId: 1, oldIndex: 0, newIndex: 1 },
      { componentId: 2, oldIndex: 1, newIndex: 2 }
    ]);

    action.do(project);

    expect(options.get(3)!.value).toBe(0);
    expect(options.get(1)!.value).toBe(1);
    expect(options.get(2)!.value).toBe(2);
  });

  it('skips plugs whose index did not change', () => {
    const action = new ReorderPlugsAction([
      { componentId: 1, oldIndex: 0, newIndex: 0 },
      { componentId: 2, oldIndex: 1, newIndex: 1 }
    ]);

    expect(action.length).toBe(0);
  });

  it('undo() restores the previous indices', () => {
    const action = new ReorderPlugsAction([
      { componentId: 3, oldIndex: 2, newIndex: 0 },
      { componentId: 1, oldIndex: 0, newIndex: 1 },
      { componentId: 2, oldIndex: 1, newIndex: 2 }
    ]);

    action.do(project);
    action.undo(project);

    expect(options.get(1)!.value).toBe(0);
    expect(options.get(2)!.value).toBe(1);
    expect(options.get(3)!.value).toBe(2);
  });
});
