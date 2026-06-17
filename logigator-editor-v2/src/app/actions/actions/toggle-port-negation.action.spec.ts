import type { MockedObject } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TogglePortNegationAction } from './toggle-port-negation.action';
import type { Component } from '../../components/component';
import type { Project } from '../../project/project';

describe('TogglePortNegationAction', () => {
  let component: MockedObject<Component>;
  let project: MockedObject<Project>;

  beforeEach(() => {
    component = {
      setPortNegated: vi.fn().mockName('Component.setPortNegated')
    } as unknown as MockedObject<Component>;
    project = {
      getComponentById: vi.fn().mockName('Project.getComponentById')
    } as unknown as MockedObject<Project>;
    project.getComponentById.mockReturnValue(component);
  });

  it('do() applies the post-state to the addressed port', () => {
    const action = new TogglePortNegationAction(7, 'in', 1, true);

    action.do(project);

    expect(project.getComponentById).toHaveBeenCalledWith(7);
    expect(component.setPortNegated).toHaveBeenCalledWith('in', 1, true);
  });

  it('undo() applies the inverse of the post-state', () => {
    const action = new TogglePortNegationAction(7, 'out', 0, true);

    action.undo(project);

    expect(component.setPortNegated).toHaveBeenCalledWith('out', 0, false);
  });

  it('round-trips a turn-off toggle (post-state false)', () => {
    const action = new TogglePortNegationAction(7, 'in', 2, false);

    action.do(project);
    expect(component.setPortNegated).toHaveBeenLastCalledWith('in', 2, false);

    action.undo(project);
    expect(component.setPortNegated).toHaveBeenLastCalledWith('in', 2, true);
  });

  it('no-ops when the component is gone', () => {
    project.getComponentById.mockReturnValue(undefined);
    const action = new TogglePortNegationAction(7, 'in', 0, true);

    expect(() => action.do(project)).not.toThrow();
  });
});
