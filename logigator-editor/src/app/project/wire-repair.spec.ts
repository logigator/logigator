import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { Project } from './project';
import { Wire } from '../wires/wire';
import { WireDirection } from '../wires/wire-direction.enum';
import { Direction } from '../utils/direction';
import { auditWireInvariants, computeWireRepair } from './wire-repair';
import { WireRepairService } from './wire-repair.service';
import { makeAnd, makeWire } from '../../testing/factories';
import { ToastMessage, ToastService as UiToastService } from '@logigator/ui';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';

const H = WireDirection.HORIZONTAL;
const V = WireDirection.VERTICAL;

/**
 * The final wire state of a real corrupted user save (wire-junction-bug.dump):
 * pastes committed without integration left one collinear overlap and six
 * endpoints buried inside other wires' interiors.
 */
const CORRUPTED_STATE: [number, number, WireDirection, number][] = [
  [24, 11, V, 6],
  [25, 11, V, 6],
  [27, 11, V, 6],
  [22, 13, H, 4],
  [26, 11, V, 2],
  [26, 14, H, 4],
  [26, 13, V, 1],
  [26, 14, V, 3],
  [23, 12, H, 5],
  [28, 11, V, 1],
  [28, 12, V, 5],
  [21, 16, H, 9],
  [22, 15, H, 7],
  [22, 17, H, 7],
  [26, 16, H, 4],
  [21, 18, H, 9]
];

/**
 * The set of unit grid segments covered by wires, keyed per axis. A repair
 * must never change which cells carry a wire — only how the cells are grouped
 * into Wire instances.
 */
function coveredSegments(project: Project): Set<string> {
  const covered = new Set<string>();
  for (const w of project.wires) {
    const x = Math.floor(w.position.x);
    const y = Math.floor(w.position.y);
    for (let i = 0; i < w.length; i++) {
      covered.add(w.direction === H ? `h:${x + i},${y}` : `v:${x},${y + i}`);
    }
  }
  return covered;
}

describe('auditWireInvariants / computeWireRepair', () => {
  let project: Project;

  beforeEach(() => {
    configureTestBed();
    project = new Project();
  });

  afterEach(() => {
    project.destroy({ children: true });
  });

  function loadCorruptedState(): void {
    for (const [x, y, d, l] of CORRUPTED_STATE) {
      project.addWire(makeWire(x, y, d, l));
    }
  }

  function materializeRepair(): void {
    const plan = computeWireRepair(project);
    for (const w of plan.removeWires) project.removeWire(w.id);
    for (const w of plan.addWires) project.addWire(w);
  }

  it('audit reports nothing on a clean board', () => {
    project.addWire(makeWire(0, 0, H, 4));
    project.addWire(makeWire(0, 2, V, 4));
    expect(auditWireInvariants(project)).toEqual([]);
  });

  it('audit classifies the corrupted dump state', () => {
    loadCorruptedState();
    const violations = auditWireInvariants(project);
    const kinds = violations.map((v) => v.kind);
    expect(kinds.filter((k) => k === 'overlap')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'endpoint-in-interior')).toHaveLength(6);
    expect(violations).toHaveLength(7);
  });

  it('audit flags an unmerged collinear pair (I3)', () => {
    project.addWire(makeWire(0, 0, H, 3));
    project.addWire(makeWire(3, 0, H, 3));
    const violations = auditWireInvariants(project);
    expect(violations).toHaveLength(1);
    expect(violations[0].kind).toBe('unmerged-pair');
  });

  it('audit accepts a pair whose junction has a third terminator', () => {
    project.addWire(makeWire(0, 0, H, 3));
    project.addWire(makeWire(3, 0, H, 3));
    project.addWire(makeWire(3, 0, V, 3)); // stem ends at (3.5, 0.5)
    expect(auditWireInvariants(project)).toEqual([]);
  });

  it('audit flags a component port buried in a wire interior (I2)', () => {
    // AND at (4,1) facing East: input port at (3.5, 1.5), inside the wire.
    project.addComponent(makeAnd(2, Direction.E, 4, 1));
    project.addWire(makeWire(3, 1, V, 2));
    const violations = auditWireInvariants(project);
    expect(violations.some((v) => v.kind === 'port-in-interior')).toBe(true);
  });

  it('repair heals the corrupted dump state without changing coverage', () => {
    loadCorruptedState();
    const before = coveredSegments(project);
    materializeRepair();
    expect(auditWireInvariants(project)).toEqual([]);
    expect(coveredSegments(project)).toEqual(before);
  });

  it('repair is idempotent', () => {
    loadCorruptedState();
    materializeRepair();
    const plan = computeWireRepair(project);
    expect(plan.removeWires).toEqual([]);
    expect(plan.addWires).toEqual([]);
  });

  it('repair leaves wires outside the broken region untouched', () => {
    loadCorruptedState();
    // (21,18) H 9 — the bottom-most row, nothing terminates on it.
    const untouched = [...project.wires].find(
      (w) => w.position.y === 18.5 && w.direction === H
    )!;
    materializeRepair();
    expect([...project.wires]).toContain(untouched);
  });

  it('repair drops zero-length wires', () => {
    // The constructor treats 0 as "unset" (length stays 1), so degeneracy has
    // to be forced through the setter — as a runtime mutation would.
    const degenerate = new Wire(H, 2);
    degenerate.length = 0;
    degenerate.position.set(2.5, 2.5);
    project.addWire(degenerate);
    const plan = computeWireRepair(project);
    expect(plan.removeWires).toEqual([degenerate]);
    expect(plan.addWires).toEqual([]);
  });

  it('repair keeps split state that ports justify', () => {
    // Wires split at the AND's input ports (3.5, 1.5) and (3.5, 2.5) — valid
    // split state the rebuild must reproduce rather than merge away.
    project.addComponent(makeAnd(2, Direction.E, 4, 1));
    project.addWire(makeWire(3, 0, V, 1)); // 0.5..1.5, ends at the first port
    project.addWire(makeWire(3, 1, V, 1)); // 1.5..2.5, port to port
    project.addWire(makeWire(3, 2, V, 2)); // 2.5..4.5, below the second port
    const plan = computeWireRepair(project);
    expect(plan.removeWires).toEqual([]);
    expect(plan.addWires).toEqual([]);
  });
});

describe('WireRepairService', () => {
  let service: WireRepairService;
  let project: Project;
  /** Toasts that offer a follow-up action — what the on-load audit raises. */
  let offered: ToastMessage[];

  beforeEach(() => {
    configureTestBed();
    service = TestBed.inject(WireRepairService);
    offered = [];
    TestBed.inject(UiToastService).messageObserver.subscribe((message) => {
      if (message.action) offered.push(message);
    });
    project = new Project();
  });

  afterEach(() => {
    project.destroy({ children: true });
  });

  function corrupt(): void {
    // Two overlapping collinear wires — the paste-without-integration shape.
    project.addWire(makeWire(0, 0, H, 4));
    project.addWire(makeWire(2, 0, H, 4));
  }

  it('repairManually fixes the board and registers one undoable entry', () => {
    corrupt();
    service.repairManually(project);

    expect(auditWireInvariants(project)).toEqual([]);
    expect([...project.wires]).toHaveLength(1);
    expect(project.actionManager.undoAvailable).toBe(true);

    project.actionManager.undo();
    expect([...project.wires]).toHaveLength(2);
    expect(auditWireInvariants(project)).toHaveLength(1);
  });

  it('repairManually on a clean board records no history', () => {
    project.addWire(makeWire(0, 0, H, 4));
    service.repairManually(project);
    expect(project.actionManager.undoAvailable).toBe(false);
  });

  it('offerRepairOnLoad leaves the board alone until the offer is accepted', () => {
    corrupt();
    service.offerRepairOnLoad(project);

    // Detection only — nothing changed and nothing is undoable yet.
    expect([...project.wires]).toHaveLength(2);
    expect(project.actionManager.undoAvailable).toBe(false);

    const offer = offered.at(-1);
    expect(offer?.action).toBeDefined();
    offer!.action!.handler();

    expect(auditWireInvariants(project)).toEqual([]);
    expect(project.actionManager.undoAvailable).toBe(true);
    project.actionManager.undo();
    expect(project.actionManager.undoAvailable).toBe(false);
  });

  it('offerRepairOnLoad stays silent on a clean board', () => {
    project.addWire(makeWire(0, 0, H, 4));
    service.offerRepairOnLoad(project);
    expect(offered).toEqual([]);
  });

  it('offerRepairOnLoad skips a read-only share', () => {
    // A share cannot be saved or exported, so a repair would have nowhere to go.
    TestBed.inject(ProjectMetadataStore).register(
      project,
      {
        id: 'link',
        name: 'Shared',
        type: 'project',
        source: 'share',
        hash: '',
        isPublic: true
      },
      false
    );
    corrupt();
    service.offerRepairOnLoad(project);
    expect(offered).toEqual([]);
  });
});
