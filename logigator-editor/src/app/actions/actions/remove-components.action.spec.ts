import type { MockedObject } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { setStaticDIInjector } from '../../utils/get-di';
import { RemoveComponentsAction } from './remove-components.action';
import { Component } from '../../components/component';
import { AndComponent } from '../../components/component-types/and/and.component';
import { Project } from '../../project/project';
import { makeAnd } from '../../../testing/factories';
import { configureTestBed } from '../../../testing/configure-test-bed';

describe('RemoveComponentsAction', () => {
  let project: MockedObject<Project>;
  let compsToDestroy: Component[];

  beforeEach(() => {
    setStaticDIInjector(TestBed.inject(Injector));
    project = {
      addComponent: vi.fn().mockName('Project.addComponent'),
      removeComponent: vi.fn().mockName('Project.removeComponent')
    } as unknown as MockedObject<Project>;
    compsToDestroy = [];
  });

  afterEach(() => {
    for (const comp of compsToDestroy) {
      comp.destroy({ children: true });
    }
  });

  describe('do()', () => {
    it('calls removeComponent with the component id for a single component', () => {
      const comp = makeAnd();
      compsToDestroy.push(comp);
      const compId = comp.id;
      const action = new RemoveComponentsAction(comp);

      action.do(project);

      expect(project.removeComponent).toHaveBeenCalledTimes(1);

      expect(project.removeComponent).toHaveBeenCalledWith(compId);
    });

    it('calls removeComponent once per component for multiple components', () => {
      const comp1 = makeAnd();
      const comp2 = makeAnd();
      const id1 = comp1.id;
      const id2 = comp2.id;
      compsToDestroy.push(comp1, comp2);
      const action = new RemoveComponentsAction(comp1, comp2);

      action.do(project);

      expect(project.removeComponent).toHaveBeenCalledTimes(2);
      expect(project.removeComponent).toHaveBeenCalledWith(id1);
      expect(project.removeComponent).toHaveBeenCalledWith(id2);
    });

    it('does not call addComponent during do()', () => {
      const comp = makeAnd();
      compsToDestroy.push(comp);
      const action = new RemoveComponentsAction(comp);

      action.do(project);

      expect(project.addComponent).not.toHaveBeenCalled();
    });

    it('does not call removeComponent when constructed with no components', () => {
      const action = new RemoveComponentsAction();

      expect(() => action.do(project)).not.toThrow();
      expect(project.removeComponent).not.toHaveBeenCalled();
    });
  });

  describe('undo()', () => {
    it('calls addComponent once for a single component', () => {
      const comp = makeAnd();
      compsToDestroy.push(comp);
      const action = new RemoveComponentsAction(comp);

      action.undo(project);

      expect(project.addComponent).toHaveBeenCalledTimes(1);
    });

    it('calls addComponent with an AndComponent instance', () => {
      const comp = makeAnd();
      compsToDestroy.push(comp);
      const action = new RemoveComponentsAction(comp);

      action.undo(project);

      expect(project.addComponent).toHaveBeenCalledWith(
        expect.any(AndComponent)
      );
    });

    it('calls addComponent once per component for multiple components', () => {
      const comp1 = makeAnd();
      const comp2 = makeAnd();
      const comp3 = makeAnd();
      compsToDestroy.push(comp1, comp2, comp3);
      const action = new RemoveComponentsAction(comp1, comp2, comp3);

      action.undo(project);

      expect(project.addComponent).toHaveBeenCalledTimes(3);
    });

    it('does not call removeComponent during undo()', () => {
      const comp = makeAnd();
      compsToDestroy.push(comp);
      const action = new RemoveComponentsAction(comp);

      action.undo(project);

      expect(project.removeComponent).not.toHaveBeenCalled();
    });

    it('does not call addComponent when constructed with no components', () => {
      const action = new RemoveComponentsAction();

      expect(() => action.undo(project)).not.toThrow();
      expect(project.addComponent).not.toHaveBeenCalled();
    });
  });
});

describe('RemoveComponentsAction negation round-trip', () => {
  let project: Project;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
  });

  afterEach(() => {
    project.destroy({ children: true });
  });

  it('restores a negated port (and its bubble) on undo', () => {
    const and = makeAnd(2, undefined, 2, 2);
    project.addComponent(and);
    and.setPortNegated('in', 1, true);
    and.setPortNegated('out', 0, true);
    const id = and.id;

    // The action snapshots the component, negation included, at construction.
    project.actionManager.push(new RemoveComponentsAction(and));
    expect(project.getComponentById(id)).toBeUndefined();

    project.actionManager.undo();

    const restored = project.getComponentById(id)!;
    expect(restored.isPortNegated('in', 1)).toBe(true);
    expect(restored.isPortNegated('out', 0)).toBe(true);
    expect(restored.portBubbles.has(1)).toBe(true); // input 1
    expect(restored.portBubbles.has(2)).toBe(true); // output 0 = numInputs + 0
  });
});
