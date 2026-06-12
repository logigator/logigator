import type { MockedObject } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { setStaticDIInjector } from '../utils/get-di';
import { ClipboardService } from './clipboard.service';
import { Project } from '../project/project';
import { Component } from '../components/component';
import { Wire } from '../wires/wire';
import { WireDirection } from '../wires/wire-direction.enum';
import { ActionContainer } from '../actions/action-container';
import { makeAnd } from '../../testing/factories';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeWire(): Wire {
  const w = new Wire(WireDirection.HORIZONTAL, 4);
  w.position.set(5.5, 3.5);
  return w;
}

// Mock project where selectionManager.selectedComponents/selectedWires can be
// set directly per test. removeComponent/removeWire are no-ops by default so
// evict() is never triggered here (that's tested on the real SelectionManager).
function makeProject(
  comps: Component[] = [],
  wires: Wire[] = []
): MockedObject<Project> {
  return {
    selectionManager: {
      get isEmpty() {
        return comps.length === 0 && wires.length === 0;
      },
      selectedComponents: new Set(comps),
      selectedWires: new Set(wires),
      claimPendingCut: vi.fn().mockReturnValue(null)
    },
    actionManager: {
      register: vi.fn()
    },
    removeComponent: vi.fn(),
    removeWire: vi.fn(),
    startPasteSession: vi.fn()
  } as unknown as MockedObject<Project>;
}

// ── ClipboardService ──────────────────────────────────────────────────────────

describe('ClipboardService', () => {
  let service: ClipboardService;
  let compsToDestroy: Component[];

  beforeEach(() => {
    setStaticDIInjector(TestBed.inject(Injector));
    service = new ClipboardService();
    compsToDestroy = [];
  });

  afterEach(() => {
    for (const c of compsToDestroy) {
      if (!c.destroyed) c.destroy({ children: true });
    }
  });

  // ── copy ────────────────────────────────────────────────────────────────────

  describe('copy()', () => {
    it('hasClipboard is false before any copy', () => {
      expect(service.hasClipboard).toBe(false);
    });

    it('does nothing when selection is empty', () => {
      const project = makeProject();
      service.copy(project);
      expect(service.hasClipboard).toBe(false);
    });

    it('populates clipboard when components are selected', () => {
      const comp = makeAnd();
      compsToDestroy.push(comp);
      const project = makeProject([comp]);
      service.copy(project);
      expect(service.hasClipboard).toBe(true);
    });

    it('populates clipboard when wires are selected', () => {
      const wire = makeWire();
      const project = makeProject([], [wire]);
      service.copy(project);
      expect(service.hasClipboard).toBe(true);
    });

    it('does not claim the pending cut', () => {
      const comp = makeAnd();
      compsToDestroy.push(comp);
      const project = makeProject([comp]);
      service.copy(project);
      expect(
        project.selectionManager.claimPendingCut as ReturnType<typeof vi.fn>
      ).not.toHaveBeenCalled();
    });

    it('does not remove any elements from the project', () => {
      const comp = makeAnd();
      compsToDestroy.push(comp);
      const project = makeProject([comp]);
      service.copy(project);
      expect(project.removeComponent).not.toHaveBeenCalled();
      expect(project.removeWire).not.toHaveBeenCalled();
    });
  });

  // ── delete ──────────────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('does nothing when selection is empty', () => {
      const project = makeProject();
      service.delete(project);
      expect(project.removeComponent).not.toHaveBeenCalled();
      expect(project.removeWire).not.toHaveBeenCalled();
      expect(project.actionManager.register).not.toHaveBeenCalled();
    });

    it('calls removeComponent for each selected component', () => {
      const c1 = makeAnd();
      const c2 = makeAnd();
      compsToDestroy.push(c1, c2);
      const project = makeProject([c1, c2]);
      service.delete(project);
      expect(project.removeComponent).toHaveBeenCalledWith(c1.id);
      expect(project.removeComponent).toHaveBeenCalledWith(c2.id);
    });

    it('calls removeWire for each selected wire', () => {
      const w1 = makeWire();
      const w2 = makeWire();
      const project = makeProject([], [w1, w2]);
      service.delete(project);
      expect(project.removeWire).toHaveBeenCalledWith(w1.id);
      expect(project.removeWire).toHaveBeenCalledWith(w2.id);
    });

    it('calls register() to record the action', () => {
      const comp = makeAnd();
      compsToDestroy.push(comp);
      const project = makeProject([comp]);
      service.delete(project);
      expect(project.actionManager.register).toHaveBeenCalledTimes(1);
    });

    it('folds a pending cut into the container when one is present', () => {
      const comp = makeAnd();
      compsToDestroy.push(comp);
      const pendingCut = new ActionContainer();
      const project = makeProject([comp]);
      (
        project.selectionManager.claimPendingCut as ReturnType<typeof vi.fn>
      ).mockReturnValue(pendingCut);

      service.delete(project);

      // The container passed to register should be the same object claimPendingCut returned
      expect(project.actionManager.register).toHaveBeenCalledWith(pendingCut);
    });

    it('creates a fresh container when there is no pending cut', () => {
      const comp = makeAnd();
      compsToDestroy.push(comp);
      const project = makeProject([comp]);
      service.delete(project);

      const mockFn = project.actionManager.register as ReturnType<typeof vi.fn>;
      const [container] = mockFn.mock.calls[0] as [ActionContainer];
      expect(container).toBeInstanceOf(ActionContainer);
    });
  });

  // ── cut ─────────────────────────────────────────────────────────────────────

  describe('cut()', () => {
    it('does nothing when selection is empty', () => {
      const project = makeProject();
      service.cut(project);
      expect(service.hasClipboard).toBe(false);
      expect(project.removeComponent).not.toHaveBeenCalled();
    });

    it('populates clipboard (copy part)', () => {
      const comp = makeAnd();
      compsToDestroy.push(comp);
      const project = makeProject([comp]);
      service.cut(project);
      expect(service.hasClipboard).toBe(true);
    });

    it('removes elements from project (delete part)', () => {
      const comp = makeAnd();
      compsToDestroy.push(comp);
      const project = makeProject([comp]);
      service.cut(project);
      expect(project.removeComponent).toHaveBeenCalledWith(comp.id);
    });
  });

  // ── paste ───────────────────────────────────────────────────────────────────

  describe('paste()', () => {
    it('does nothing when clipboard is empty', () => {
      const project = makeProject();
      service.paste(project);
      expect(project.startPasteSession).not.toHaveBeenCalled();
    });

    it('calls startPasteSession after copy', () => {
      const comp = makeAnd();
      compsToDestroy.push(comp);
      const src = makeProject([comp]);
      service.copy(src);

      const dest = makeProject();
      service.paste(dest);

      expect(dest.startPasteSession).toHaveBeenCalledTimes(1);
    });

    it('passes fresh component IDs — no ID duplication with the source', () => {
      const comp = makeAnd();
      compsToDestroy.push(comp);
      const originalId = comp.id;
      const src = makeProject([comp]);
      service.copy(src);

      const dest = makeProject();
      service.paste(dest);

      const mockFn = dest.startPasteSession as ReturnType<typeof vi.fn>;
      const [freshComps] = mockFn.mock.calls[0] as [Component[], Wire[]];
      for (const c of freshComps) {
        expect(c.id).not.toBe(originalId);
        if (!c.destroyed) c.destroy({ children: true });
      }
    });

    it('shifts component positions by the paste offset', () => {
      const comp = makeAnd();
      comp.position.set(3, 4);
      compsToDestroy.push(comp);
      const src = makeProject([comp]);
      service.copy(src);

      const dest = makeProject();
      service.paste(dest);

      const mockFn = dest.startPasteSession as ReturnType<typeof vi.fn>;
      const [freshComps] = mockFn.mock.calls[0] as [Component[], Wire[]];
      expect(freshComps[0].position.x).toBe(5); // 3 + PASTE_OFFSET(2)
      expect(freshComps[0].position.y).toBe(6); // 4 + PASTE_OFFSET(2)
      for (const c of freshComps) {
        if (!c.destroyed) c.destroy({ children: true });
      }
    });

    it('shifts wire positions by the paste offset in the integer domain', () => {
      // Wire at position (5.5, 3.5) serializes as pos=[5,3] (Math.floor).
      // After paste offset: serialized pos=[7,5]. Deserialized: (7.5, 5.5).
      const wire = makeWire(); // position (5.5, 3.5)
      const src = makeProject([], [wire]);
      service.copy(src);

      const dest = makeProject();
      service.paste(dest);

      const mockFn = dest.startPasteSession as ReturnType<typeof vi.fn>;
      const [, freshWires] = mockFn.mock.calls[0] as [Component[], Wire[]];
      expect(freshWires[0].position.x).toBe(7.5);
      expect(freshWires[0].position.y).toBe(5.5);
      for (const w of freshWires) {
        if (!w.destroyed) w.destroy();
      }
    });

    it('skips unknown component types gracefully', () => {
      // Manually set clipboard with an unknown type; paste should not throw
      // and startPasteSession receives an empty component array.
      const comp = makeAnd();
      compsToDestroy.push(comp);
      const src = makeProject([comp]);
      service.copy(src);

      // Corrupt the type to an unknown value
      (
        service as unknown as { _clipboard: { components: { type: string }[] } }
      )._clipboard!.components[0].type = 'nonexistent_type' as never;

      const dest = makeProject();
      expect(() => service.paste(dest)).not.toThrow();

      const mockFn = dest.startPasteSession as ReturnType<typeof vi.fn>;
      const [freshComps] = mockFn.mock.calls[0] as [Component[], Wire[]];
      expect(freshComps).toHaveLength(0);
    });
  });
});
