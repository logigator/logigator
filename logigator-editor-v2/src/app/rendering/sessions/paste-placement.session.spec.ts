import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Container, Point } from 'pixi.js';
import { setStaticDIInjector } from '../../utils/get-di';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
import { WireDirection } from '../../wires/wire-direction.enum';
import { Direction } from '../../utils/direction';
import { ConnectionPoint } from '../../connection-points/connection-point';
import { PastePlacementSession } from './paste-placement.session';
import { makeAnd, makeMoveEvent, makeWire } from '../../../testing/factories';

function hasComponent(project: Project, comp: Component): boolean {
  return [...project.components].includes(comp);
}

function hasWire(project: Project, wire: Wire): boolean {
  return [...project.wires].includes(wire);
}

// ── PastePlacementSession ─────────────────────────────────────────────────────

describe('PastePlacementSession', () => {
  let project: Project;
  let dragLayer: Container<Component | Wire | ConnectionPoint>;
  let session: PastePlacementSession | undefined;

  beforeEach(() => {
    setStaticDIInjector(TestBed.inject(Injector));
    project = new Project();
    dragLayer = new Container();
  });

  afterEach(() => {
    // onCancel is safe to call; PixiJS destroy() is idempotent.
    // Tests that call onEnd() null out `session` to avoid double-destroy.
    session?.onCancel();
    session = undefined;
    dragLayer.destroy();
    project.destroy({ children: true });
  });

  // ── constructor ─────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('adds components to dragLayer', () => {
      const comp = makeAnd(2, Direction.E, 3, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);
      expect(dragLayer.children).toContain(comp);
    });

    it('adds wires to dragLayer', () => {
      const wire = makeWire(2, 1, WireDirection.HORIZONTAL);
      session = new PastePlacementSession(project, dragLayer, [], [wire]);
      expect(dragLayer.children).toContain(wire);
    });

    it('adds both components and wires to dragLayer', () => {
      const comp = makeAnd(2, Direction.E, 0, 0);
      const wire = makeWire(5, 0, WireDirection.HORIZONTAL);
      session = new PastePlacementSession(project, dragLayer, [comp], [wire]);
      expect(dragLayer.children).toContain(comp);
      expect(dragLayer.children).toContain(wire);
    });

    it('does not add elements to the project', () => {
      const comp = makeAnd(2, Direction.E, 3, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);
      expect([...project.components]).toHaveLength(0);
    });
  });

  // ── canEnd / collision ───────────────────────────────────────────────────────

  describe('canEnd()', () => {
    it('returns true when no existing elements block the paste position', () => {
      const comp = makeAnd(2, Direction.E, 10, 10);
      session = new PastePlacementSession(project, dragLayer, [comp], []);
      expect(session.canEnd()).toBe(true);
    });

    it('returns false when a pasted component overlaps an existing component', () => {
      // Existing AND at (0,0); pasted AND also at (0,0).
      const existing = makeAnd(2, Direction.E, 0, 0);
      project.addComponent(existing);

      const comp = makeAnd(2, Direction.E, 0, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);

      expect(session.canEnd()).toBe(false);
    });

    it('returns true again after moving pasted component away from collision', () => {
      const existing = makeAnd(2, Direction.E, 0, 0);
      project.addComponent(existing);

      const comp = makeAnd(2, Direction.E, 0, 0); // starts overlapping
      session = new PastePlacementSession(project, dragLayer, [comp], []);
      expect(session.canEnd()).toBe(false);

      session.beginDrag(new Point(0, 0)); // anchor = (0,0)
      session.onMove(makeMoveEvent(10, 0)); // delta = (10,0) — clear of existing
      expect(session.canEnd()).toBe(true);
    });
  });

  // ── onMove / drag behaviour ──────────────────────────────────────────────────

  describe('onMove()', () => {
    it('does nothing before beginDrag() is called (hover phase)', () => {
      const comp = makeAnd(2, Direction.E, 0, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);

      session.onMove(makeMoveEvent(4, 0));

      expect(dragLayer.position.x).toBe(0);
      expect(dragLayer.position.y).toBe(0);
    });

    it('moves the dragLayer relative to the beginDrag anchor', () => {
      const comp = makeAnd(2, Direction.E, 0, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);

      session.beginDrag(new Point(2, 0)); // anchor at (2,0)
      session.onMove(makeMoveEvent(5, 3)); // delta = (3,3)

      expect(dragLayer.position.x).toBe(3);
      expect(dragLayer.position.y).toBe(3);
    });

    it('snaps cursor to grid during drag', () => {
      const comp = makeAnd(2, Direction.E, 0, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);

      session.beginDrag(new Point(0, 0)); // anchor = (0,0)
      session.onMove(makeMoveEvent(2.7, 1.3));

      expect(dragLayer.position.x).toBe(3);
      expect(dragLayer.position.y).toBe(1);
    });

    it('isDragging is false before beginDrag, true after', () => {
      const comp = makeAnd(2, Direction.E, 0, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);

      expect(session.isDragging).toBe(false);
      session.beginDrag(new Point(0, 0));
      expect(session.isDragging).toBe(true);
    });
  });

  // ── onEnd ───────────────────────────────────────────────────────────────────

  describe('onEnd()', () => {
    it('adds components to the project at their final position', () => {
      const comp = makeAnd(2, Direction.E, 2, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);

      session.beginDrag(new Point(0, 0)); // anchor = (0,0)
      session.onMove(makeMoveEvent(3, 0)); // delta = (3,0)
      session.onEnd();
      session = undefined;

      expect(hasComponent(project, comp)).toBe(true);
      expect(comp.position.x).toBe(5); // 2 + 3 delta
      expect(comp.position.y).toBe(0);
    });

    it('adds wires to the project at their final position', () => {
      const wire = makeWire(0, 0, WireDirection.HORIZONTAL); // position (0.5, 0.5)
      session = new PastePlacementSession(project, dragLayer, [], [wire]);

      session.beginDrag(new Point(0, 0)); // anchor = (0,0)
      session.onMove(makeMoveEvent(2, 0)); // delta = (2,0)
      session.onEnd();
      session = undefined;

      expect(hasWire(project, wire)).toBe(true);
      expect(wire.position.x).toBe(2.5); // 0.5 + 2
    });

    it('places elements at initial positions when no drag occurred', () => {
      const comp = makeAnd(2, Direction.E, 4, 2);
      session = new PastePlacementSession(project, dragLayer, [comp], []);

      session.onEnd();
      session = undefined;

      expect(hasComponent(project, comp)).toBe(true);
      expect(comp.position.x).toBe(4);
      expect(comp.position.y).toBe(2);
    });

    it('resets dragLayer position to (0,0) after commit', () => {
      const comp = makeAnd(2, Direction.E, 0, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);

      session.beginDrag(new Point(0, 0));
      session.onMove(makeMoveEvent(3, 3));
      session.onEnd();
      session = undefined;

      expect(dragLayer.position.x).toBe(0);
      expect(dragLayer.position.y).toBe(0);
    });

    it('selects pasted components after commit', () => {
      const comp = makeAnd(2, Direction.E, 0, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);
      session.onEnd();
      session = undefined;

      expect(project.selectionManager.selectedComponents.has(comp)).toBe(true);
    });

    it('selects pasted wires after commit', () => {
      const wire = makeWire(0, 0, WireDirection.HORIZONTAL);
      session = new PastePlacementSession(project, dragLayer, [], [wire]);
      session.onEnd();
      session = undefined;

      expect(project.selectionManager.selectedWires.has(wire)).toBe(true);
    });

    it('records the paste in the action history (undoAvailable becomes true)', () => {
      const comp = makeAnd(2, Direction.E, 0, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);
      session.onEnd();
      session = undefined;

      expect(project.actionManager.undoAvailable).toBe(true);
    });

    it('undo removes pasted elements from the project', () => {
      const comp = makeAnd(2, Direction.E, 5, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);
      session.onEnd();
      session = undefined;

      const compId = comp.id;
      project.actionManager.undo();

      expect(project.getComponentById(compId)).toBeUndefined();
    });

    it('redo re-adds pasted elements to the project', () => {
      const comp = makeAnd(2, Direction.E, 5, 0);
      const wire = makeWire(0, 0, WireDirection.HORIZONTAL);
      session = new PastePlacementSession(project, dragLayer, [comp], [wire]);
      session.onEnd();
      session = undefined;

      const compId = comp.id;
      const wireId = wire.id;
      project.actionManager.undo();
      project.actionManager.redo();

      expect(project.getComponentById(compId)).toBeDefined();
      expect([...project.wires].some((w) => w.id === wireId)).toBe(true);
    });
  });

  // ── onCancel ─────────────────────────────────────────────────────────────────

  describe('onCancel()', () => {
    it('destroys all components', () => {
      const comp = makeAnd(2, Direction.E, 3, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);
      session.onCancel();
      session = undefined;

      expect(comp.destroyed).toBe(true);
    });

    it('destroys all wires', () => {
      const wire = makeWire(0, 0, WireDirection.HORIZONTAL);
      session = new PastePlacementSession(project, dragLayer, [], [wire]);
      session.onCancel();
      session = undefined;

      expect(wire.destroyed).toBe(true);
    });

    it('does not add elements to the project', () => {
      const comp = makeAnd(2, Direction.E, 3, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);
      session.onCancel();
      session = undefined;

      expect([...project.components]).toHaveLength(0);
    });

    it('resets dragLayer position to (0,0)', () => {
      const comp = makeAnd(2, Direction.E, 0, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);
      session.beginDrag(new Point(0, 0));
      session.onMove(makeMoveEvent(4, 3));
      session.onCancel();
      session = undefined;

      expect(dragLayer.position.x).toBe(0);
      expect(dragLayer.position.y).toBe(0);
    });

    it('does not record anything in the action history', () => {
      const comp = makeAnd(2, Direction.E, 0, 0);
      session = new PastePlacementSession(project, dragLayer, [comp], []);
      session.onCancel();
      session = undefined;

      expect(project.actionManager.undoAvailable).toBe(false);
    });
  });
});
