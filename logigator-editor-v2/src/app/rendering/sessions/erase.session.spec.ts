import { describe, beforeEach, it, expect, vi } from 'vitest';
import type { MockedObject } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FederatedPointerEvent, Point } from 'pixi.js';
import { setStaticDIInjector } from '../../utils/get-di';
import { EraseSession } from './erase.session';
import { Wire } from '../../wires/wire';
import { WireDirection } from '../../wires/wire-direction.enum';
import { ActionContainer } from '../../actions/action-container';
import { AndComponent } from '../../components/component-types/and/and.component';
import { andComponentConfig } from '../../components/component-types/and/and.config';
import type { Project } from '../../project/project';
import type { ActionManager } from '../../actions/action-manager';

function* gen<T>(...items: T[]): Generator<T> {
  yield* items;
}

function makeAnd(): AndComponent {
  return new AndComponent({
    direction: andComponentConfig.options.direction.clone(),
    numInputs: andComponentConfig.options.numInputs.clone(2)
  });
}

function makeEvent(x: number, y: number): MockedObject<FederatedPointerEvent> {
  const e = {
    getLocalPosition: vi.fn().mockName('FederatedPointerEvent.getLocalPosition')
  };
  e.getLocalPosition.mockReturnValue(new Point(x, y));
   
  return e as unknown as MockedObject<FederatedPointerEvent>;
}

describe('EraseSession', () => {
  let project: MockedObject<Project>;

  function getActionManager(): MockedObject<ActionManager> {
    return (
      project as unknown as {
        actionManager: MockedObject<ActionManager>;
      }
    ).actionManager;
  }

  beforeEach(() => {
    setStaticDIInjector(TestBed.inject(Injector));

    project = {
      removeComponent: vi.fn().mockName('Project.removeComponent'),
      removeWire: vi.fn().mockName('Project.removeWire'),
      addComponent: vi.fn().mockName('Project.addComponent'),
      addWire: vi.fn().mockName('Project.addWire'),
      queryComponentsInRange: vi
        .fn()
        .mockName('Project.queryComponentsInRange'),
      queryWiresInRange: vi.fn().mockName('Project.queryWiresInRange')
     
    } as unknown as MockedObject<Project>;
    // Use callFake so each call gets a fresh (non-exhausted) iterable
    project.queryComponentsInRange.mockImplementation(() => gen());
    project.queryWiresInRange.mockImplementation(() => gen());

    (
      project as unknown as {
        actionManager: MockedObject<ActionManager>;
      }
     
    ).actionManager = {
      register: vi.fn().mockName('ActionManager.register')
    } as unknown as MockedObject<ActionManager>;
    (
      project as unknown as {
        gridSpace: object;
      }
    ).gridSpace = {};
  });

  describe('construction — initial click position', () => {
    it('erases a component at the start position immediately', () => {
      const comp = makeAnd();
      project.queryComponentsInRange.mockImplementation(() => gen(comp));

      new EraseSession(project, new Point(3, 2));

      expect(project.removeComponent).toHaveBeenCalledTimes(1);

      expect(project.removeComponent).toHaveBeenCalledWith(comp.id);
      comp.destroy({ children: true });
    });

    it('erases a wire at the start position immediately', () => {
      const wire = new Wire(WireDirection.HORIZONTAL, 3);
      project.queryWiresInRange.mockImplementation(() => gen(wire));

      new EraseSession(project, new Point(3, 2));

      expect(project.removeWire).toHaveBeenCalledTimes(1);

      expect(project.removeWire).toHaveBeenCalledWith(wire.id);
      wire.destroy();
    });

    it('queries a 1×1 cell at the floored start position', () => {
      new EraseSession(project, new Point(3.7, 2.9));

      expect(project.queryComponentsInRange).toHaveBeenCalledWith(
        expect.objectContaining({ x: 3, y: 2, width: 1, height: 1 })
      );
    });
  });

  describe('onMove()', () => {
    it('erases elements under the cursor', () => {
      const wire = new Wire(WireDirection.HORIZONTAL, 3);
      const session = new EraseSession(project, new Point(0, 0));

      project.queryWiresInRange.mockImplementation(() => gen(wire));
      session.onMove(makeEvent(5, 3));

      expect(project.removeWire).toHaveBeenCalledWith(wire.id);
      wire.destroy();
    });

    it('sweeps the AABB between previous and current positions', () => {
      const session = new EraseSession(project, new Point(2, 1));
      session.onMove(makeEvent(7, 4));

      expect(project.queryWiresInRange).toHaveBeenCalledWith(
        expect.objectContaining({ x: 2, y: 1, width: 6, height: 4 })
      );
    });

    it('does not erase the same element twice across multiple moves', () => {
      const wire = new Wire(WireDirection.HORIZONTAL, 3);
      project.queryWiresInRange.mockImplementation(() => gen(wire));

      const session = new EraseSession(project, new Point(0, 0));
      // Wire already erased in constructor; subsequent moves should skip it
      session.onMove(makeEvent(3, 2));
      session.onMove(makeEvent(4, 2));

      expect(project.removeWire).toHaveBeenCalledTimes(1);

      expect(project.removeWire).toHaveBeenCalledWith(wire.id);
      wire.destroy();
    });

    it('erases both components and wires encountered along the path', () => {
      const comp = makeAnd();
      const wire = new Wire(WireDirection.VERTICAL, 2);
      const session = new EraseSession(project, new Point(0, 0));

      project.queryComponentsInRange.mockImplementation(() => gen(comp));
      project.queryWiresInRange.mockImplementation(() => gen(wire));
      session.onMove(makeEvent(3, 3));

      expect(project.removeComponent).toHaveBeenCalledWith(comp.id);
      expect(project.removeWire).toHaveBeenCalledWith(wire.id);
      comp.destroy({ children: true });
      wire.destroy();
    });
  });

  describe('canEnd()', () => {
    it('always returns true', () => {
      const session = new EraseSession(project, new Point(0, 0));
      expect(session.canEnd()).toBe(true);
    });
  });

  describe('onEnd()', () => {
    it('registers an ActionContainer when elements were erased', () => {
      const wire = new Wire(WireDirection.HORIZONTAL, 3);
      project.queryWiresInRange.mockImplementation(() => gen(wire));

      const session = new EraseSession(project, new Point(0, 0));
      session.onEnd();

      expect(getActionManager().register).toHaveBeenCalledTimes(1);

      expect(getActionManager().register).toHaveBeenCalledWith(
        expect.any(ActionContainer)
      );
      wire.destroy();
    });

    it('does not register an action when nothing was erased', () => {
      const session = new EraseSession(project, new Point(0, 0));
      session.onEnd();

      expect(getActionManager().register).not.toHaveBeenCalled();
    });
  });

  describe('onCancel()', () => {
    it('re-adds deleted wires', () => {
      const wire = new Wire(WireDirection.HORIZONTAL, 3);
      project.queryWiresInRange.mockImplementation(() => gen(wire));

      const session = new EraseSession(project, new Point(0, 0));
      session.onCancel();

      expect(project.addWire).toHaveBeenCalledTimes(1);

      expect(project.addWire).toHaveBeenCalledWith(expect.any(Wire));
      wire.destroy();
    });

    it('re-adds deleted components', () => {
      const comp = makeAnd();
      project.queryComponentsInRange.mockImplementation(() => gen(comp));

      const session = new EraseSession(project, new Point(0, 0));
      session.onCancel();

      expect(project.addComponent).toHaveBeenCalledTimes(1);

      expect(project.addComponent).toHaveBeenCalledWith(
        expect.any(AndComponent)
      );
      comp.destroy({ children: true });
    });
  });
});
