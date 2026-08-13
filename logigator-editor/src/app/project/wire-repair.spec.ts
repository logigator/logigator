import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { Project } from './project';
import { Wire } from '../wires/wire';
import { Direction, WireDirection } from '@logigator/core';
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

  // The audit derives every violation from bucket-local sweeps and point
  // lookups rather than comparing wires pairwise, so the invariant worth
  // pinning is that it still agrees with an exhaustive pairwise scan. A
  // disagreement here means the index missed a pair the definition covers.
  describe('agrees with an exhaustive pairwise scan', () => {
    /** Direct transcription of the invariant definitions — no spatial index. */
    function bruteForceAudit(): string[] {
      const wires = [...project.wires];
      const comps = [...project.components];
      const found: string[] = [];

      const terminations = new Map<string, number>();
      const bump = (p: { x: number; y: number }): void => {
        const k = `${p.x},${p.y}`;
        terminations.set(k, (terminations.get(k) ?? 0) + 1);
      };
      for (const w of wires) for (const p of w.connectionPoints) bump(p);
      for (const c of comps) for (const p of c.connectionPoints) bump(p);

      const axis = (w: Wire): number =>
        w.direction === H ? w.position.x : w.position.y;
      const cross = (w: Wire): number =>
        w.direction === H ? w.position.y : w.position.x;
      const inside = (w: Wire, p: { x: number; y: number }): boolean =>
        w.direction === H
          ? p.y === w.position.y &&
            p.x > w.position.x &&
            p.x < w.position.x + w.length
          : p.x === w.position.x &&
            p.y > w.position.y &&
            p.y < w.position.y + w.length;

      for (let i = 0; i < wires.length; i++) {
        for (let j = i + 1; j < wires.length; j++) {
          const [a, b] =
            wires[i].id < wires[j].id
              ? [wires[i], wires[j]]
              : [wires[j], wires[i]];
          if (a.direction === b.direction && cross(a) === cross(b)) {
            const start = Math.max(axis(a), axis(b));
            const end = Math.min(axis(a) + a.length, axis(b) + b.length);
            if (start < end) {
              found.push(`overlap ${a.id}+${b.id} by ${end - start}`);
            } else if (start === end) {
              const p =
                a.direction === H
                  ? { x: start, y: a.position.y }
                  : { x: a.position.x, y: start };
              if ((terminations.get(`${p.x},${p.y}`) ?? 0) < 3) {
                found.push(`unmerged ${a.id}+${b.id} at ${p.x},${p.y}`);
              }
            }
            continue;
          }
          for (const [owner, other] of [
            [a, b],
            [b, a]
          ] as const) {
            for (const p of owner.connectionPoints) {
              if (inside(other, p)) {
                found.push(
                  `endpoint ${owner.id} in ${other.id} @ ${p.x},${p.y}`
                );
              }
            }
          }
        }
      }
      for (const c of comps) {
        for (const p of c.connectionPoints) {
          for (const w of wires) {
            if (inside(w, p)) {
              found.push(`port ${c.id} in ${w.id} @ ${p.x},${p.y}`);
            }
          }
        }
      }
      return found.sort();
    }

    /** The audit's own output, reduced to the same comparable shape. */
    function auditKeys(): string[] {
      return auditWireInvariants(project)
        .map((v) => {
          const overlap = /wires (\d+) and (\d+) overlap by (\d+)/.exec(
            v.detail
          );
          if (overlap) {
            return `overlap ${overlap[1]}+${overlap[2]} by ${overlap[3]}`;
          }
          const unmerged =
            /wires (\d+) and (\d+) touch at \(([-\d.]+), ([-\d.]+)\)/.exec(
              v.detail
            );
          if (unmerged) {
            return `unmerged ${unmerged[1]}+${unmerged[2]} at ${unmerged[3]},${unmerged[4]}`;
          }
          const endpoint =
            /endpoint \(([-\d.]+), ([-\d.]+)\) of wire (\d+) lies inside wire (\d+)/.exec(
              v.detail
            );
          if (endpoint) {
            return `endpoint ${endpoint[3]} in ${endpoint[4]} @ ${endpoint[1]},${endpoint[2]}`;
          }
          const port =
            /port \(([-\d.]+), ([-\d.]+)\) of component (\d+) lies inside wire (\d+)/.exec(
              v.detail
            );
          return `port ${port![3]} in ${port![4]} @ ${port![1]},${port![2]}`;
        })
        .sort();
    }

    it('on the corrupted dump state', () => {
      loadCorruptedState();
      expect(auditKeys()).toEqual(bruteForceAudit());
    });

    // Deterministic pseudo-random boards: dense enough that overlaps, buried
    // endpoints and buried ports all occur, and including long wires, which
    // are what the point-lookup form exists to keep cheap.
    it('on dense pseudo-random boards, including long wires', () => {
      let seed = 12345;
      const rnd = (n: number): number => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed % n;
      };
      for (let board = 0; board < 25; board++) {
        for (const w of [...project.wires]) project.removeWire(w.id);
        for (let i = 0; i < 40; i++) {
          const long = rnd(5) === 0;
          project.addWire(
            makeWire(
              rnd(8),
              rnd(8),
              rnd(2) === 0 ? H : V,
              long ? 6 + rnd(6) : 1 + rnd(3)
            )
          );
        }
        // End-to-end pairs out in open space, so their junction stays below
        // three terminations. Nothing above reliably produces one, and the
        // sweep's touching case is the branch most easily lost.
        for (let i = 0; i < 3; i++) {
          const x = 40 + rnd(40) * 3;
          const y = 40 + rnd(40) * 3;
          const len = 1 + rnd(2);
          const dir = rnd(2) === 0 ? H : V;
          project.addWire(makeWire(x, y, dir, len));
          project.addWire(
            dir === H
              ? makeWire(x + len, y, H, 1 + rnd(2))
              : makeWire(x, y + len, V, 1 + rnd(2))
          );
        }
        project.addComponent(makeAnd(2, Direction.E, rnd(8), rnd(8)));
        expect(auditKeys(), `board ${board}`).toEqual(bruteForceAudit());
      }
    });
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
