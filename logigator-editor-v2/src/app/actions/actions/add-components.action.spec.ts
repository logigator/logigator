import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { setStaticDIInjector } from '../../utils/get-di';
import { AddComponentsAction } from './add-components.action';
import { Component } from '../../components/component';
import { AndComponent } from '../../components/component-types/and/and.component';
import { andComponentConfig } from '../../components/component-types/and/and.config';
import type { Project } from '../../project/project';

function makeAnd(): AndComponent {
  return new AndComponent({
    direction: andComponentConfig.options.direction.clone(),
    numInputs: andComponentConfig.options.numInputs.clone(2)
  });
}

describe('AddComponentsAction', () => {
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
    it('calls addComponent once for a single component', () => {
      const comp = makeAnd();
      compsToDestroy.push(comp);
      const action = new AddComponentsAction(comp);

      action.do(project);

      expect(project.addComponent).toHaveBeenCalledTimes(1);
    });

    it('calls addComponent with an AndComponent instance', () => {
      const comp = makeAnd();
      compsToDestroy.push(comp);
      const action = new AddComponentsAction(comp);

      action.do(project);

      expect(project.addComponent).toHaveBeenCalledWith(
        expect.any(AndComponent)
      );
    });

    it('calls addComponent once per component for multiple components', () => {
      const comp1 = makeAnd();
      const comp2 = makeAnd();
      const comp3 = makeAnd();
      compsToDestroy.push(comp1, comp2, comp3);
      const action = new AddComponentsAction(comp1, comp2, comp3);

      action.do(project);

      expect(project.addComponent).toHaveBeenCalledTimes(3);
    });

    it('does not call removeComponent during do()', () => {
      const comp = makeAnd();
      compsToDestroy.push(comp);
      const action = new AddComponentsAction(comp);

      action.do(project);

      expect(project.removeComponent).not.toHaveBeenCalled();
    });

    it('does not call addComponent when constructed with no components', () => {
      const action = new AddComponentsAction();

      expect(() => action.do(project)).not.toThrow();
      expect(project.addComponent).not.toHaveBeenCalled();
    });
  });

  describe('undo()', () => {
    it('calls removeComponent with the component id for a single component', () => {
      const comp = makeAnd();
      compsToDestroy.push(comp);
      const compId = comp.id;
      const action = new AddComponentsAction(comp);

      action.undo(project);

      expect(project.removeComponent).toHaveBeenCalledTimes(1);

      expect(project.removeComponent).toHaveBeenCalledWith(compId);
    });

    it('calls removeComponent once per component for multiple components', () => {
      const comp1 = makeAnd();
      const comp2 = makeAnd();
      const id1 = comp1.id;
      const id2 = comp2.id;
      compsToDestroy.push(comp1, comp2);
      const action = new AddComponentsAction(comp1, comp2);

      action.undo(project);

      expect(project.removeComponent).toHaveBeenCalledTimes(2);
      expect(project.removeComponent).toHaveBeenCalledWith(id1);
      expect(project.removeComponent).toHaveBeenCalledWith(id2);
    });

    it('does not call addComponent during undo()', () => {
      const comp = makeAnd();
      compsToDestroy.push(comp);
      const action = new AddComponentsAction(comp);

      action.undo(project);

      expect(project.addComponent).not.toHaveBeenCalled();
    });

    it('does not call removeComponent when constructed with no components', () => {
      const action = new AddComponentsAction();

      expect(() => action.undo(project)).not.toThrow();
      expect(project.removeComponent).not.toHaveBeenCalled();
    });
  });

  describe('id preservation', () => {
    it('undo uses the same id that was assigned at construction time', () => {
      const comp = makeAnd();
      comp.position.set(3, 4);
      const expectedId = comp.id;
      compsToDestroy.push(comp);
      const action = new AddComponentsAction(comp);

      action.undo(project);

      expect(project.removeComponent).toHaveBeenCalledTimes(1);

      expect(project.removeComponent).toHaveBeenCalledWith(expectedId);
    });
  });
});
