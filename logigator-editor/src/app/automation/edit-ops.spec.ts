import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { makeAnd, makeWire } from '../../testing/factories';
import { setStaticDIInjector } from '../utils/get-di';
import { Project } from '../project/project';
import { ComponentProviderService } from '../components/component-provider.service';
import { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { BuiltInComponentType } from '../components/component-type.enum';
import { WireDirection } from '../wires/wire-direction.enum';
import { Direction } from '../utils/direction';
import { serializeProjectBody } from '../persistence/snapshots';
import { EditOp } from './automation-api.model';
import { applyEditOps, EditOpsContext } from './edit-ops';

describe('applyEditOps', () => {
  let project: Project;
  let context: EditOpsContext;

  const apply = (...ops: EditOp[]) => applyEditOps(ops, context);

  beforeEach(() => {
    configureTestBed();
    setStaticDIInjector(TestBed.inject(Injector));
    project = new Project();
    context = {
      project,
      provider: TestBed.inject(ComponentProviderService),
      debug: vi.fn()
    };
  });

  describe('history granularity', () => {
    it('records one entry for the whole batch and undoes it in one step', () => {
      const before = serializeProjectBody(project);
      const result = apply(
        {
          op: 'addComponent',
          type: BuiltInComponentType.AND,
          pos: [0, 0],
          options: {}
        },
        {
          op: 'addWire',
          pos: [10, 10],
          direction: WireDirection.HORIZONTAL,
          length: 4
        }
      );

      expect(result.ok).toBe(true);
      expect(project.actionManager.history.length).toBe(1);
      expect(project.componentCount).toBe(1);

      project.actionManager.undo();
      expect(project.actionManager.undoAvailable).toBe(false);
      expect(serializeProjectBody(project)).toEqual(before);
    });

    it('returns the ids it assigned so later batches can address the elements', () => {
      const result = apply({
        op: 'addComponent',
        type: BuiltInComponentType.AND,
        pos: [2, 2],
        options: {}
      });
      const id = result.ok ? result.createdIds[0].componentId : undefined;
      expect(id).toBe([...project.components][0].id);
    });

    it('requests a frame for a batch that only rebuilds visuals', () => {
      const and = makeAnd(2, Direction.E, 0, 0);
      project.addComponent(and);
      const frames: string[] = [];
      project.ticker$.subscribe((signal) => frames.push(signal));

      // A negation toggle rebuilds the component's children without touching the
      // quad trees, so nothing else along the way asks for a repaint.
      apply({
        op: 'setPortNegation',
        id: and.id,
        side: 'in',
        index: 0,
        negated: true
      });

      expect(frames).toContain('single');
    });

    it('records nothing when every op is a no-op', () => {
      const and = makeAnd(2, Direction.E, 0, 0);
      project.addComponent(and);
      const result = apply({
        op: 'rotateComponent',
        id: and.id,
        direction: Direction.E
      });
      expect(result.ok).toBe(true);
      expect(project.actionManager.history.length).toBe(0);
    });
  });

  describe('wire integration', () => {
    it('splits a crossed wire the way the wire tool does', () => {
      // A vertical wire along x = 4.5; an AND at (5, 4) puts its two input port
      // tips on that line, in the wire's interior — so it must split there.
      project.addWire(makeWire(4, 0, WireDirection.VERTICAL, 10));
      const result = apply({
        op: 'addComponent',
        type: BuiltInComponentType.AND,
        pos: [5, 4],
        options: { numInputs: 2 }
      });

      expect(result.ok).toBe(true);
      expect(result.ok && result.integratedWires.removed.length).toBe(1);
      expect([...project.wires].length).toBe(3);
    });

    it('undo restores the pre-split topology exactly', () => {
      project.addWire(makeWire(4, 0, WireDirection.VERTICAL, 10));
      const before = serializeProjectBody(project);

      apply({
        op: 'addComponent',
        type: BuiltInComponentType.AND,
        pos: [5, 4],
        options: { numInputs: 2 }
      });
      project.actionManager.undo();

      expect(serializeProjectBody(project)).toEqual(before);
    });

    it('merges two collinear wires drawn as one span', () => {
      apply(
        {
          op: 'addWire',
          pos: [0, 0],
          direction: WireDirection.HORIZONTAL,
          length: 3
        },
        {
          op: 'addWire',
          pos: [3, 0],
          direction: WireDirection.HORIZONTAL,
          length: 3
        }
      );
      const wires = [...project.wires];
      expect(wires.length).toBe(1);
      expect(wires[0].length).toBe(6);
    });
  });

  describe('all-or-nothing', () => {
    it('lists every malformed op and touches nothing', () => {
      const result = apply(
        {
          op: 'addWire',
          pos: [0, 0],
          direction: WireDirection.HORIZONTAL,
          length: 0
        },
        { op: 'moveComponent', id: 1, to: [0.5, 0] } as unknown as EditOp
      );
      expect(result.ok).toBe(false);
      expect(!result.ok && result.errors.map((e) => e.index)).toEqual([0, 1]);
      expect(project.actionManager.history.length).toBe(0);
    });

    it('rolls back the ops that already applied when a later one fails', () => {
      const before = serializeProjectBody(project);
      const result = apply(
        {
          op: 'addComponent',
          type: BuiltInComponentType.AND,
          pos: [0, 0],
          options: {}
        },
        // Placing a second AND on the same spot collides.
        {
          op: 'addComponent',
          type: BuiltInComponentType.AND,
          pos: [0, 0],
          options: {}
        }
      );

      expect(result.ok).toBe(false);
      expect(!result.ok && result.errors[0].index).toBe(1);
      expect(project.componentCount).toBe(0);
      expect(serializeProjectBody(project)).toEqual(before);
      expect(project.actionManager.history.length).toBe(0);
    });

    it('rejects an unresolvable component type', () => {
      const result = apply({
        op: 'addComponent',
        type: 987654,
        pos: [0, 0],
        options: {}
      });
      expect(!result.ok && result.errors[0].message).toContain(
        'unknown component type'
      );
    });

    it('rejects an option value the option model would silently clamp', () => {
      const result = apply({
        op: 'addComponent',
        type: BuiltInComponentType.AND,
        pos: [0, 0],
        options: { numInputs: 999 }
      });
      expect(result.ok).toBe(false);
      expect(!result.ok && result.errors[0].message).toContain('out of range');
      expect(project.componentCount).toBe(0);
    });

    it('refuses a placement that would close a dependency cycle', () => {
      // Editing master A while placing A into itself — what the palette hides
      // in the UI, and an agent can otherwise name by type id.
      const registry = TestBed.inject(CustomComponentRegistry);
      const master = registry.createMaster({ symbol: 'A', id: 'a' }, 'browser');
      TestBed.inject(ProjectMetadataStore).register(project, {
        id: 'a',
        name: 'A',
        type: 'comp',
        source: 'browser',
        hash: '',
        isPublic: false
      });

      const result = apply({
        op: 'addComponent',
        type: master,
        pos: [0, 0],
        options: {}
      });
      expect(!result.ok && result.errors[0].message).toContain(
        'dependency cycle'
      );
      expect(project.componentCount).toBe(0);
    });

    it('rejects an unknown option key', () => {
      const result = apply({
        op: 'addComponent',
        type: BuiltInComponentType.AND,
        pos: [0, 0],
        options: { nope: 1 }
      });
      expect(!result.ok && result.errors[0].message).toContain(
        'unknown option'
      );
    });
  });

  describe('mutations', () => {
    it('moves a component and reports the new position through serialization', () => {
      const and = makeAnd(2, Direction.E, 0, 0);
      project.addComponent(and);

      expect(apply({ op: 'moveComponent', id: and.id, to: [7, 8] }).ok).toBe(
        true
      );
      expect(and.position.x).toBe(7);
      expect(and.position.y).toBe(8);

      project.actionManager.undo();
      expect(and.position.x).toBe(0);
    });

    it('refuses a move onto another component', () => {
      const a = makeAnd(2, Direction.E, 0, 0);
      const b = makeAnd(2, Direction.E, 10, 0);
      project.addComponent(a);
      project.addComponent(b);

      const result = apply({ op: 'moveComponent', id: b.id, to: [0, 0] });
      expect(result.ok).toBe(false);
      expect(b.position.x).toBe(10);
    });

    it('rotates to an absolute facing, keeping the footprint in place', () => {
      const and = makeAnd(2, Direction.E, 4, 4);
      project.addComponent(and);
      const before = and.gridBounds;

      expect(
        apply({ op: 'rotateComponent', id: and.id, direction: Direction.S }).ok
      ).toBe(true);
      expect(and.direction).toBe(Direction.S);
      const after = and.gridBounds;
      // A quarter-turn swaps the extents but keeps the group centred.
      expect(after.x + after.width / 2).toBeCloseTo(
        before.x + before.width / 2,
        10
      );
      expect(after.y + after.height / 2).toBeCloseTo(
        before.y + before.height / 2,
        10
      );

      project.actionManager.undo();
      expect(and.direction).toBe(Direction.E);
      expect(and.gridBounds).toEqual(before);
    });

    it('sets an option and restores the previous value on undo', () => {
      const and = makeAnd(2, Direction.E, 0, 0);
      project.addComponent(and);

      expect(
        apply({ op: 'setOption', id: and.id, key: 'numInputs', value: 4 }).ok
      ).toBe(true);
      expect(and.numInputs).toBe(4);

      project.actionManager.undo();
      expect(and.numInputs).toBe(2);
    });

    it('negates a port and rejects an out-of-range index', () => {
      const and = makeAnd(2, Direction.E, 0, 0);
      project.addComponent(and);

      expect(
        apply({
          op: 'setPortNegation',
          id: and.id,
          side: 'in',
          index: 1,
          negated: true
        }).ok
      ).toBe(true);
      expect(and.isPortNegated('in', 1)).toBe(true);

      const result = apply({
        op: 'setPortNegation',
        id: and.id,
        side: 'in',
        index: 9,
        negated: true
      });
      expect(!result.ok && result.errors[0].message).toContain('out of range');
    });

    it('removes components and wires in one entry', () => {
      const and = makeAnd(2, Direction.E, 0, 0);
      const wire = makeWire(20, 20, WireDirection.VERTICAL, 3);
      project.addComponent(and);
      project.addWire(wire);

      expect(
        apply({ op: 'remove', componentIds: [and.id], wireIds: [wire.id] }).ok
      ).toBe(true);
      expect(project.componentCount).toBe(0);
      expect([...project.wires].length).toBe(0);

      project.actionManager.undo();
      expect(project.componentCount).toBe(1);
      expect([...project.wires].length).toBe(1);
    });

    it('rejects a removal naming an unknown id, keeping the rest', () => {
      const and = makeAnd(2, Direction.E, 0, 0);
      project.addComponent(and);

      const result = apply({ op: 'remove', componentIds: [and.id, 999999] });
      expect(result.ok).toBe(false);
      expect(project.componentCount).toBe(1);
    });
  });
});
