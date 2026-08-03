import type { MockedObject } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Point } from 'pixi.js';
import { setStaticDIInjector } from '../../utils/get-di';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { EraseSession } from './erase.session';
import { Wire } from '../../wires/wire';
import { WireDirection } from '../../wires/wire-direction.enum';
import { ActionContainer } from '../../actions/action-container';
import { Project } from '../../project/project';
import type { ActionManager } from '../../actions/action-manager';
import { makeAnd, makeMoveInput, makeWire } from '../../../testing/factories';
import { gen } from '../../../testing/vitest-helpers';
import { AndComponent } from '../../components/component-types/and/and.component';

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
      queryWiresInRange: vi.fn().mockName('Project.queryWiresInRange'),
      topology: {
        integrate: vi
          .fn()
          .mockName('WireTopology.integrate')
          .mockReturnValue({ toAdd: [], toRemove: [] })
      }
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
      session.onMove(makeMoveInput(5, 3));

      expect(project.removeWire).toHaveBeenCalledWith(wire.id);
      wire.destroy();
    });

    it('sweeps the AABB between previous and current positions', () => {
      const session = new EraseSession(project, new Point(2, 1));
      session.onMove(makeMoveInput(7, 4));

      expect(project.queryWiresInRange).toHaveBeenCalledWith(
        expect.objectContaining({ x: 2, y: 1, width: 6, height: 4 })
      );
    });

    it('does not erase the same element twice across multiple moves', () => {
      const wire = new Wire(WireDirection.HORIZONTAL, 3);
      project.queryWiresInRange.mockImplementation(() => gen(wire));

      const session = new EraseSession(project, new Point(0, 0));
      // Wire already erased in constructor; subsequent moves should skip it
      session.onMove(makeMoveInput(3, 2));
      session.onMove(makeMoveInput(4, 2));

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
      session.onMove(makeMoveInput(3, 3));

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

// ── EraseSession — wire integration (real project) ───────────────────────────

describe('EraseSession — wire integration', () => {
  let project: Project;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
  });

  afterEach(() => {
    project.destroy({ children: true });
  });

  // A T-junction: two collinear bar halves whose shared endpoint (3.5, 3.5)
  // is held apart by the stem terminating there.
  function buildTee(): { left: Wire; right: Wire; stem: Wire } {
    const left = makeWire(0, 3, WireDirection.HORIZONTAL, 3);
    const right = makeWire(3, 3, WireDirection.HORIZONTAL, 3);
    const stem = makeWire(3, 0, WireDirection.VERTICAL, 3);
    project.addWire(left);
    project.addWire(right);
    project.addWire(stem);
    return { left, right, stem };
  }

  it('merges the collinear pair whose junction stem was erased', () => {
    buildTee();

    // Sweep rect (3,1,1,1) touches only the stem.
    const session = new EraseSession(project, new Point(3.5, 1));
    session.onEnd();

    const wires = [...project.wires];
    expect(wires).toHaveLength(1);
    expect(wires[0].direction).toBe(WireDirection.HORIZONTAL);
    expect(wires[0].length).toBe(6);
    expect(wires[0].position.x).toBe(0.5);
  });

  it('undo restores the stem and the split halves', () => {
    const { left, right, stem } = buildTee();
    const ids = [left.id, right.id, stem.id];

    const session = new EraseSession(project, new Point(3.5, 1));
    session.onEnd();
    project.actionManager.undo();

    const wires = [...project.wires];
    expect(wires).toHaveLength(3);
    expect(wires.map((w) => w.id).sort()).toEqual([...ids].sort());
  });

  it('does not merge when a third terminator remains at the junction', () => {
    buildTee();
    // A second stem from below also ends at (3.5, 3.5) — erasing one stem
    // leaves the other as the junction's terminator.
    project.addWire(makeWire(3, 3, WireDirection.VERTICAL, 3));

    const session = new EraseSession(project, new Point(3.5, 1));
    session.onEnd();

    const horizontals = [...project.wires].filter(
      (w) => w.direction === WireDirection.HORIZONTAL
    );
    expect(horizontals).toHaveLength(2);
  });
});
