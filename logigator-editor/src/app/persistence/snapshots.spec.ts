import { beforeEach, describe, expect, it } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { setStaticDIInjector } from '../utils/get-di';
import { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import { BuiltInComponentType, SerializedCircuitBody } from '@logigator/core';
import { Project } from '../project/project';
import { collectSnapshots } from './snapshots';

// collectSnapshots only reads each component's `config.type`, so a stand-in
// keeps these tests free of PixiJS construction. Body serialization is covered
// by the file round-trip spec, over real Projects.
function fakeProject(types: number[]): Project {
  return {
    components: types.map((type) => ({ config: { type } }))
  } as unknown as Project;
}

describe('snapshots codec', () => {
  let registry: CustomComponentRegistry;

  beforeEach(() => {
    setStaticDIInjector(TestBed.inject(Injector));
    registry = TestBed.inject(CustomComponentRegistry);
  });

  // Master B nested inside master A, returning snapshot type ids the way the
  // palette would place them.
  function buildNestedSnapshots(): {
    snapA: number;
    snapB: number;
    idA: string;
  } {
    const bCircuit: SerializedCircuitBody = {
      components: [
        {
          type: BuiltInComponentType.INPUT,
          pos: [0, 0],
          options: { label: 'in', index: 0 }
        },
        {
          type: BuiltInComponentType.OUTPUT,
          pos: [5, 0],
          options: { label: 'out', index: 0 }
        }
      ],
      wires: []
    };
    const masterB = registry.createMaster(
      {
        id: 'id-b',
        symbol: 'B',
        numInputs: 1,
        numOutputs: 1,
        labels: ['in', 'out'],
        circuit: bCircuit
      },
      'browser'
    );
    const snapB = registry.snapshot(masterB).typeId;

    const masterA = registry.createMaster(
      {
        id: 'id-a',
        symbol: 'A',
        circuit: {
          components: [{ type: snapB, pos: [2, 2], options: {} }],
          wires: []
        }
      },
      'browser'
    );
    const snapA = registry.snapshot(masterA).typeId;
    return { snapA, snapB, idA: 'id-a' };
  }

  describe('collectSnapshots', () => {
    it('returns nothing for a project that places no customs', () => {
      const { definitions } = collectSnapshots(
        fakeProject([BuiltInComponentType.AND]),
        registry
      );
      expect(definitions).toEqual([]);
    });

    it('emits one definition per placed snapshot, with provenance', () => {
      const masterB = registry.createMaster(
        {
          id: 'id-b',
          symbol: 'B',
          numInputs: 1,
          numOutputs: 1,
          labels: ['i', 'o']
        },
        'browser'
      );
      const snapB = registry.snapshot(masterB).typeId;

      const { definitions, sessionToLocal } = collectSnapshots(
        fakeProject([snapB]),
        registry
      );

      expect(definitions.length).toBe(1);
      expect(definitions[0].type).toBe(1000);
      expect(definitions[0].symbol).toBe('B');
      expect(definitions[0].numInputs).toBe(1);
      expect(definitions[0].labels).toEqual(['i', 'o']);
      expect(definitions[0].source).toEqual({
        id: 'id-b',
        version: 1,
        origin: 'browser'
      });
      expect(sessionToLocal.get(snapB)).toBe(1000);
    });

    it('rewrites a snapshot provenance id through the promotion alias', () => {
      const masterB = registry.createMaster(
        { id: 'id-b', symbol: 'B' },
        'browser'
      );
      const snapB = registry.snapshot(masterB).typeId;

      registry.promoteMaster(masterB, 'srv-b', 2);

      const { definitions } = collectSnapshots(fakeProject([snapB]), registry);
      // The document references the master's current id and origin, the frozen
      // version staying as captured: the alias table is device-local, so a
      // stale id would strand everywhere else.
      expect(definitions[0].source).toEqual({
        id: 'srv-b',
        version: 1,
        origin: 'server'
      });
    });

    it('emits provenance for an id-carrying snapshot with no version (defaults to 1)', () => {
      // An orphan re-linked to a fresh master can carry an id but no version,
      // and must still emit provenance or it re-orphans on reload.
      const snap = registry.registerSnapshot({
        kind: 'snapshot',
        source: 'browser',
        id: 'id-x',
        version: undefined,
        name: 'X',
        symbol: 'X',
        description: '',
        numInputs: 0,
        numOutputs: 0,
        labels: [],
        circuit: { components: [], wires: [] }
      });

      const { definitions } = collectSnapshots(fakeProject([snap]), registry);

      expect(definitions[0].source).toEqual({
        id: 'id-x',
        version: 1,
        origin: 'browser'
      });
    });

    it('dedups repeated placements of the same snapshot', () => {
      const master = registry.createMaster({ symbol: 'M' }, 'browser');
      const snap = registry.snapshot(master).typeId;
      expect(
        collectSnapshots(fakeProject([snap, snap]), registry).definitions.length
      ).toBe(1);
    });

    it('emits one definition when the same master is placed multiple times', () => {
      const master = registry.createMaster({ symbol: 'M' }, 'browser');
      const snap1 = registry.snapshot(master).typeId;
      const snap2 = registry.snapshot(master).typeId;
      const snap3 = registry.snapshot(master).typeId;
      const { definitions } = collectSnapshots(
        fakeProject([snap1, snap2, snap3]),
        registry
      );
      expect(definitions.length).toBe(1);
    });

    it('emits two definitions when port count changes between placements (guards against unsafe source-key dedup)', () => {
      const master = registry.createMaster(
        { symbol: 'M', numInputs: 1, numOutputs: 1, labels: ['i', 'o'] },
        'browser'
      );
      const snap1 = registry.snapshot(master).typeId;
      // Same source.{id,version}, different content.
      registry.updateDefinition(master, {
        numInputs: 2,
        numOutputs: 1,
        labels: ['a', 'b', 'o']
      });
      const snap2 = registry.snapshot(master).typeId;
      const { definitions } = collectSnapshots(
        fakeProject([snap1, snap2]),
        registry
      );
      expect(definitions.length).toBe(2);
      expect(definitions.find((d) => d.numInputs === 1)).toBeTruthy();
      expect(definitions.find((d) => d.numInputs === 2)).toBeTruthy();
    });

    it('walks nested customs and rewrites the parent body to file-local ids', () => {
      const { snapA } = buildNestedSnapshots();
      const { definitions } = collectSnapshots(fakeProject([snapA]), registry);

      expect(definitions.map((d) => d.type)).toEqual([1000, 1001]);
      const defA = definitions.find((d) => d.symbol === 'A')!;
      const defB = definitions.find((d) => d.symbol === 'B')!;
      expect(defA.type).toBe(1000);
      expect(defB.type).toBe(1001);

      // A's body references B by its file-local id, not its session id.
      expect(defA.components.map((c) => c.type)).toEqual([defB.type]);
      expect(defB.components.map((c) => c.type)).toEqual([
        BuiltInComponentType.INPUT,
        BuiltInComponentType.OUTPUT
      ]);
    });
  });

  describe('collect → ingest round-trip', () => {
    it('re-registers a 2-deep set and resolves nested refs to session ids', () => {
      const { snapA, idA } = buildNestedSnapshots();
      const { definitions } = collectSnapshots(fakeProject([snapA]), registry);

      // Ingesting allocates fresh session ids, keyed by the file-local ones.
      const remap = registry.ingestSnapshots(definitions);
      const sessionA = remap.get(1000)!;
      const sessionB = remap.get(1001)!;

      const ingestedA = registry.getDefinition(sessionA)!;
      const ingestedB = registry.getDefinition(sessionB)!;

      expect(ingestedA.kind).toBe('snapshot');
      expect(ingestedA.symbol).toBe('A');
      expect(ingestedA.id).toBe(idA);
      expect(ingestedA.circuit!.components.map((c) => c.type)).toEqual([
        sessionB
      ]);
      expect(ingestedB.symbol).toBe('B');
      expect(ingestedB.numInputs).toBe(1);
      expect(ingestedB.circuit!.components.map((c) => c.type)).toEqual([
        BuiltInComponentType.INPUT,
        BuiltInComponentType.OUTPUT
      ]);
    });
  });
});
