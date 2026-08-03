import type { MockedObject } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { ClipboardService } from './clipboard.service';
import { Project } from '../project/project';
import { Component } from '../components/component';
import { Wire } from '../wires/wire';
import { WireDirection } from '../wires/wire-direction.enum';
import { ActionContainer } from '../actions/action-container';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { Direction } from '../utils/direction';
import { makeAnd, makeInput } from '../../testing/factories';

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
      consumeLiveCut: vi.fn().mockReturnValue(null)
    },
    actionManager: {
      register: vi.fn(),
      coalesceTop: vi.fn()
    },
    // Pass-through stub: deleting integrates nothing extra, so toRemove is
    // exactly the removed selection. Real merge behavior is covered by the
    // real-project describe below.
    topology: {
      integrate: vi.fn((input: { removedWires?: Wire[] }) => ({
        toAdd: [],
        toRemove: [...(input.removedWires ?? [])]
      }))
    },
    removeComponent: vi.fn(),
    removeWire: vi.fn(),
    addWire: vi.fn(),
    startPasteSession: vi.fn()
  } as unknown as MockedObject<Project>;
}

// Registers a mock project in the metadata store so paste() can tell a plain
// project from a custom-component document. trackDirty=false — the mock has
// no actionManager.actionChange$.
function registerAs(project: Project, type: 'project' | 'comp'): void {
  TestBed.inject(ProjectMetadataStore).register(
    project,
    {
      id: '',
      name: 'test',
      type,
      source: 'browser',
      hash: '',
      isPublic: false
    },
    false
  );
}

// ── ClipboardService ──────────────────────────────────────────────────────────

describe('ClipboardService', () => {
  let service: ClipboardService;
  let compsToDestroy: Component[];

  beforeEach(() => {
    configureTestBed();
    service = TestBed.inject(ClipboardService);
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
      expect(service.hasClipboard()).toBe(false);
    });

    it('does nothing when selection is empty', () => {
      const project = makeProject();
      service.copy(project);
      expect(service.hasClipboard()).toBe(false);
    });

    it('populates clipboard when components are selected', () => {
      const comp = makeAnd();
      compsToDestroy.push(comp);
      const project = makeProject([comp]);
      service.copy(project);
      expect(service.hasClipboard()).toBe(true);
    });

    it('populates clipboard when wires are selected', () => {
      const wire = makeWire();
      const project = makeProject([], [wire]);
      service.copy(project);
      expect(service.hasClipboard()).toBe(true);
    });

    it('does not consume a live scissor cut', () => {
      const comp = makeAnd();
      compsToDestroy.push(comp);
      const project = makeProject([comp]);
      service.copy(project);
      expect(
        project.selectionManager.consumeLiveCut as ReturnType<typeof vi.fn>
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

    it('coalesces a live cut with the delete into one undo step', () => {
      const comp = makeAnd();
      compsToDestroy.push(comp);
      const cut = new ActionContainer();
      const project = makeProject([comp]);
      (
        project.selectionManager.consumeLiveCut as ReturnType<typeof vi.fn>
      ).mockReturnValue(cut);

      service.delete(project);

      // The cut's history entry absorbs the delete container.
      expect(project.actionManager.coalesceTop).toHaveBeenCalledTimes(1);
      const [top, next] = (
        project.actionManager.coalesceTop as ReturnType<typeof vi.fn>
      ).mock.calls[0];
      expect(top).toBe(cut);
      expect(next).toBeInstanceOf(ActionContainer);
      expect(project.actionManager.register).not.toHaveBeenCalled();
    });

    it('creates a fresh container when no cut is live', () => {
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
      expect(service.hasClipboard()).toBe(false);
      expect(project.removeComponent).not.toHaveBeenCalled();
    });

    it('populates clipboard (copy part)', () => {
      const comp = makeAnd();
      compsToDestroy.push(comp);
      const project = makeProject([comp]);
      service.cut(project);
      expect(service.hasClipboard()).toBe(true);
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

    it('carries port negation through copy/paste', () => {
      const comp = makeAnd(3);
      comp.setPortNegated('in', 1, true);
      comp.setPortNegated('out', 0, true);
      compsToDestroy.push(comp);
      const src = makeProject([comp]);
      service.copy(src);

      const dest = makeProject();
      service.paste(dest);

      const mockFn = dest.startPasteSession as ReturnType<typeof vi.fn>;
      const [freshComps] = mockFn.mock.calls[0] as [Component[], Wire[]];
      expect(freshComps[0].isPortNegated('in', 1)).toBe(true);
      expect(freshComps[0].isPortNegated('out', 0)).toBe(true);
      for (const c of freshComps) {
        if (!c.destroyed) c.destroy({ children: true });
      }
    });

    it('skips unknown component types gracefully', () => {
      // Manually set clipboard with an unknown type; paste should not throw,
      // and with nothing left to place no session is opened.
      const comp = makeAnd();
      compsToDestroy.push(comp);
      const src = makeProject([comp]);
      service.copy(src);

      // Corrupt the type to an unknown value
      (
        service as unknown as {
          _clipboard: () => { components: { type: string }[] };
        }
      )._clipboard().components[0].type = 'nonexistent_type' as never;

      const dest = makeProject();
      expect(() => service.paste(dest)).not.toThrow();

      expect(dest.startPasteSession).not.toHaveBeenCalled();
    });

    it('drops plugs when pasting outside a custom component', () => {
      const plug = makeInput();
      const gate = makeAnd();
      compsToDestroy.push(plug, gate);
      const src = makeProject([plug, gate]);
      service.copy(src);

      const dest = makeProject();
      registerAs(dest, 'project');
      service.paste(dest);

      const mockFn = dest.startPasteSession as ReturnType<typeof vi.fn>;
      const [freshComps] = mockFn.mock.calls[0] as [Component[], Wire[]];
      expect(freshComps).toHaveLength(1);
      expect(freshComps[0].config.type).toBe(gate.config.type);
      for (const c of freshComps) {
        if (!c.destroyed) c.destroy({ children: true });
      }
    });

    it('opens no session when only plugs were copied into a project', () => {
      const plug = makeInput();
      compsToDestroy.push(plug);
      const src = makeProject([plug]);
      service.copy(src);

      const dest = makeProject();
      registerAs(dest, 'project');
      service.paste(dest);

      expect(dest.startPasteSession).not.toHaveBeenCalled();
    });

    it('keeps plugs when pasting into a custom component', () => {
      const plug = makeInput();
      compsToDestroy.push(plug);
      const src = makeProject([plug]);
      service.copy(src);

      const dest = makeProject();
      registerAs(dest, 'comp');
      service.paste(dest);

      const mockFn = dest.startPasteSession as ReturnType<typeof vi.fn>;
      const [freshComps] = mockFn.mock.calls[0] as [Component[], Wire[]];
      expect(freshComps).toHaveLength(1);
      expect(freshComps[0].config.type).toBe(plug.config.type);
      for (const c of freshComps) {
        if (!c.destroyed) c.destroy({ children: true });
      }
    });
  });
});

// ── delete() — wire integration (real project) ────────────────────────────────

describe('ClipboardService delete() — wire integration', () => {
  let service: ClipboardService;
  let project: Project;

  function wire(gx: number, gy: number, dir: WireDirection, length: number) {
    const w = new Wire(dir, length);
    w.position.set(gx + 0.5, gy + 0.5);
    return w;
  }

  beforeEach(() => {
    configureTestBed();
    service = TestBed.inject(ClipboardService);
    project = new Project();
  });

  afterEach(() => {
    project.destroy({ children: true });
  });

  it('merges the bar halves when their junction stem is deleted', () => {
    const left = wire(0, 3, WireDirection.HORIZONTAL, 3);
    const right = wire(3, 3, WireDirection.HORIZONTAL, 3);
    const stem = wire(3, 0, WireDirection.VERTICAL, 3); // ends at (3.5, 3.5)
    project.addWire(left);
    project.addWire(right);
    project.addWire(stem);
    project.selectionManager.select([], [stem]);

    service.delete(project);

    const wires = [...project.wires];
    expect(wires).toHaveLength(1);
    expect(wires[0].direction).toBe(WireDirection.HORIZONTAL);
    expect(wires[0].length).toBe(6);
  });

  it('undo of the delete restores the stem and the split halves', () => {
    const left = wire(0, 3, WireDirection.HORIZONTAL, 3);
    const right = wire(3, 3, WireDirection.HORIZONTAL, 3);
    const stem = wire(3, 0, WireDirection.VERTICAL, 3);
    project.addWire(left);
    project.addWire(right);
    project.addWire(stem);
    const ids = [left.id, right.id, stem.id].sort();
    project.selectionManager.select([], [stem]);

    service.delete(project);
    project.actionManager.undo();

    const wires = [...project.wires];
    expect(wires).toHaveLength(3);
    expect(wires.map((w) => w.id).sort()).toEqual(ids);
  });

  it('merges the wires held apart by a deleted component’s ports', () => {
    // AND at (4,1) facing East: input ports at (3.5, 1.5) and (3.5, 2.5).
    // Three vertical wires split at exactly those ports — only the ports keep
    // them apart.
    const comp = makeAnd(2, Direction.E, 4, 1);
    project.addComponent(comp);
    project.addWire(wire(3, 0, WireDirection.VERTICAL, 1)); // 0.5..1.5
    project.addWire(wire(3, 1, WireDirection.VERTICAL, 1)); // 1.5..2.5
    project.addWire(wire(3, 2, WireDirection.VERTICAL, 2)); // 2.5..4.5
    project.selectionManager.select([comp], []);

    service.delete(project);

    const wires = [...project.wires];
    expect(wires).toHaveLength(1);
    expect(wires[0].direction).toBe(WireDirection.VERTICAL);
    expect(wires[0].length).toBe(4);
  });
});
