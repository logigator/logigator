import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Point, Rectangle } from 'pixi.js';
import { configureTestBed } from '../../testing/configure-test-bed';
import { Project } from './project';
import { WireDirection } from '@logigator/core';
import { makeWire } from '../../testing/factories';

function cpAt(project: Project, p: Point): boolean {
  return project.connectionPoints.hasCpAt(p);
}

describe('WireTopology.toggleConnectionAt', () => {
  let project: Project;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
  });

  afterEach(() => {
    project.destroy({ children: true });
  });

  function wireCount(): number {
    return project.queryWiresInRange(new Rectangle(-100, -100, 200, 200))
      .length;
  }

  describe('SPLIT — no CP at click point', () => {
    it('splits both crossing wires and creates a CP', () => {
      const h = makeWire(0, 2, WireDirection.HORIZONTAL, 5);
      const v = makeWire(2, 0, WireDirection.VERTICAL, 5);
      project.addWire(h);
      project.addWire(v);

      const p = new Point(2.5, 2.5);
      expect(cpAt(project, p)).toBe(false);

      project.topology.toggleConnectionAt(p);

      expect(cpAt(project, p)).toBe(true);
      expect(wireCount()).toBe(4);
    });

    it('is a no-op when only one wire passes through the point (no crossing)', () => {
      const h = makeWire(0, 2, WireDirection.HORIZONTAL, 5);
      project.addWire(h);

      const p = new Point(2.5, 2.5);
      project.topology.toggleConnectionAt(p);

      expect(wireCount()).toBe(1);
      expect(cpAt(project, p)).toBe(false);
    });

    it('supports undo', () => {
      const h = makeWire(0, 2, WireDirection.HORIZONTAL, 5);
      const v = makeWire(2, 0, WireDirection.VERTICAL, 5);
      project.addWire(h);
      project.addWire(v);

      const p = new Point(2.5, 2.5);
      project.topology.toggleConnectionAt(p);
      expect(cpAt(project, p)).toBe(true);

      project.actionManager.undo();
      expect(cpAt(project, p)).toBe(false);
      expect(wireCount()).toBe(2);
    });
  });

  describe('JOIN — CP at click point', () => {
    function buildXJunction(): void {
      project.addWire(makeWire(0, 2, WireDirection.HORIZONTAL, 2));
      project.addWire(makeWire(2, 2, WireDirection.HORIZONTAL, 3));
      project.addWire(makeWire(2, 0, WireDirection.VERTICAL, 2));
      project.addWire(makeWire(2, 2, WireDirection.VERTICAL, 3));
    }

    it('joins both wire pairs and removes the CP', () => {
      buildXJunction();
      const p = new Point(2.5, 2.5);
      expect(cpAt(project, p)).toBe(true);

      project.topology.toggleConnectionAt(p);

      expect(cpAt(project, p)).toBe(false);
      expect(wireCount()).toBe(2);
    });

    it('is a no-op on a T-junction (3-endpoint, non-toggleable)', () => {
      const hLeft = makeWire(0, 2, WireDirection.HORIZONTAL, 2);
      const hRight = makeWire(2, 2, WireDirection.HORIZONTAL, 3);
      const v = makeWire(2, 0, WireDirection.VERTICAL, 2);
      project.addWire(hLeft);
      project.addWire(hRight);
      project.addWire(v);

      const p = new Point(2.5, 2.5);
      expect(cpAt(project, p)).toBe(true);
      const vId = v.id;

      project.topology.toggleConnectionAt(p);

      expect(cpAt(project, p)).toBe(true);
      expect(wireCount()).toBe(3);
      expect(
        project
          .queryWiresInRange(new Rectangle(-100, -100, 200, 200))
          .some((w) => w.id === vId)
      ).toBe(true);
    });

    it('supports undo', () => {
      buildXJunction();
      const p = new Point(2.5, 2.5);
      project.topology.toggleConnectionAt(p);
      expect(cpAt(project, p)).toBe(false);

      project.actionManager.undo();
      expect(cpAt(project, p)).toBe(true);
      expect(wireCount()).toBe(4);
    });
  });
});

describe('WireTopology.connectionToggleKindAt', () => {
  let project: Project;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
  });

  afterEach(() => {
    project.destroy({ children: true });
  });

  function wireCount(): number {
    return project.queryWiresInRange(new Rectangle(-100, -100, 200, 200))
      .length;
  }

  it("reports 'split' on a pure crossing without mutating the project", () => {
    project.addWire(makeWire(0, 2, WireDirection.HORIZONTAL, 5));
    project.addWire(makeWire(2, 0, WireDirection.VERTICAL, 5));

    expect(project.topology.connectionToggleKindAt(new Point(2.5, 2.5))).toBe(
      'split'
    );
    expect(wireCount()).toBe(2);
    expect(project.actionManager.undoAvailable).toBe(false);
  });

  it("reports 'join' on a 4-endpoint X junction without mutating the project", () => {
    project.addWire(makeWire(0, 2, WireDirection.HORIZONTAL, 2));
    project.addWire(makeWire(2, 2, WireDirection.HORIZONTAL, 3));
    project.addWire(makeWire(2, 0, WireDirection.VERTICAL, 2));
    project.addWire(makeWire(2, 2, WireDirection.VERTICAL, 3));

    expect(project.topology.connectionToggleKindAt(new Point(2.5, 2.5))).toBe(
      'join'
    );
    expect(wireCount()).toBe(4);
    expect(project.actionManager.undoAvailable).toBe(false);
  });

  it('reports null on a T-junction — a tap there would be a no-op', () => {
    project.addWire(makeWire(0, 2, WireDirection.HORIZONTAL, 2));
    project.addWire(makeWire(2, 2, WireDirection.HORIZONTAL, 3));
    project.addWire(makeWire(2, 0, WireDirection.VERTICAL, 2));

    expect(project.topology.connectionToggleKindAt(new Point(2.5, 2.5))).toBe(
      null
    );
  });

  it('reports null on a single wire and on empty canvas', () => {
    project.addWire(makeWire(0, 2, WireDirection.HORIZONTAL, 5));

    expect(project.topology.connectionToggleKindAt(new Point(2.5, 2.5))).toBe(
      null
    );
    expect(project.topology.connectionToggleKindAt(new Point(20.5, 20.5))).toBe(
      null
    );
  });
});
