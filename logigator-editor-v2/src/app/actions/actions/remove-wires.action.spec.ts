import type { MockedObject } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { setStaticDIInjector } from '../../utils/get-di';
import { RemoveWiresAction } from './remove-wires.action';
import { Wire } from '../../wires/wire';
import { WireDirection } from '../../wires/wire-direction.enum';
import type { Project } from '../../project/project';

describe('RemoveWiresAction', () => {
  let project: MockedObject<Project>;
  let wiresToDestroy: Wire[];

  beforeEach(() => {
    setStaticDIInjector(TestBed.inject(Injector));
    project = {
      addWire: vi.fn().mockName('Project.addWire'),
      removeWire: vi.fn().mockName('Project.removeWire')
    } as unknown as MockedObject<Project>;
    wiresToDestroy = [];
  });

  afterEach(() => {
    for (const wire of wiresToDestroy) {
      wire.destroy();
    }
  });

  describe('do()', () => {
    it('calls removeWire with the wire id for a single wire', () => {
      const wire = new Wire(WireDirection.HORIZONTAL, 3);
      wiresToDestroy.push(wire);
      const wireId = wire.id;
      const action = new RemoveWiresAction(wire);

      action.do(project);

      expect(project.removeWire).toHaveBeenCalledTimes(1);

      expect(project.removeWire).toHaveBeenCalledWith(wireId);
    });

    it('calls removeWire once per wire for multiple wires', () => {
      const wire1 = new Wire(WireDirection.HORIZONTAL, 3);
      const wire2 = new Wire(WireDirection.VERTICAL, 5);
      wiresToDestroy.push(wire1, wire2);
      const id1 = wire1.id;
      const id2 = wire2.id;
      const action = new RemoveWiresAction(wire1, wire2);

      action.do(project);

      expect(project.removeWire).toHaveBeenCalledTimes(2);
      expect(project.removeWire).toHaveBeenCalledWith(id1);
      expect(project.removeWire).toHaveBeenCalledWith(id2);
    });

    it('does not call addWire during do()', () => {
      const wire = new Wire(WireDirection.HORIZONTAL, 3);
      wiresToDestroy.push(wire);
      const action = new RemoveWiresAction(wire);

      action.do(project);

      expect(project.addWire).not.toHaveBeenCalled();
    });

    it('does not call removeWire when constructed with no wires', () => {
      const action = new RemoveWiresAction();

      expect(() => action.do(project)).not.toThrow();
      expect(project.removeWire).not.toHaveBeenCalled();
    });
  });

  describe('undo()', () => {
    it('calls addWire once for a single wire', () => {
      const wire = new Wire(WireDirection.HORIZONTAL, 3);
      wiresToDestroy.push(wire);
      const action = new RemoveWiresAction(wire);

      action.undo(project);

      expect(project.addWire).toHaveBeenCalledTimes(1);
    });

    it('calls addWire with a Wire instance', () => {
      const wire = new Wire(WireDirection.HORIZONTAL, 3);
      wiresToDestroy.push(wire);
      const action = new RemoveWiresAction(wire);

      action.undo(project);

      expect(project.addWire).toHaveBeenCalledWith(expect.any(Wire));
    });

    it('calls addWire once per wire for multiple wires', () => {
      const wire1 = new Wire(WireDirection.HORIZONTAL, 3);
      const wire2 = new Wire(WireDirection.VERTICAL, 5);
      const wire3 = new Wire(WireDirection.HORIZONTAL, 2);
      wiresToDestroy.push(wire1, wire2, wire3);
      const action = new RemoveWiresAction(wire1, wire2, wire3);

      action.undo(project);

      expect(project.addWire).toHaveBeenCalledTimes(3);
    });

    it('does not call removeWire during undo()', () => {
      const wire = new Wire(WireDirection.HORIZONTAL, 3);
      wiresToDestroy.push(wire);
      const action = new RemoveWiresAction(wire);

      action.undo(project);

      expect(project.removeWire).not.toHaveBeenCalled();
    });

    it('does not call addWire when constructed with no wires', () => {
      const action = new RemoveWiresAction();

      expect(() => action.undo(project)).not.toThrow();
      expect(project.addWire).not.toHaveBeenCalled();
    });
  });

  describe('id preservation', () => {
    it('do() uses the id that was captured at construction time', () => {
      const wire = new Wire(WireDirection.VERTICAL, 4);
      wiresToDestroy.push(wire);
      wire.position.set(2, 5);
      const expectedId = wire.id;
      const action = new RemoveWiresAction(wire);

      action.do(project);

      expect(project.removeWire).toHaveBeenCalledTimes(1);

      expect(project.removeWire).toHaveBeenCalledWith(expectedId);
    });
  });
});
