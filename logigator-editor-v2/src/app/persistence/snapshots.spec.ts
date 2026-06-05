import { beforeEach, describe, expect, it } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { setStaticDIInjector } from '../utils/get-di';
import { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import { BuiltInComponentType } from '../components/component-type.enum';
import { Project } from '../project/project';
import { SerializedCircuitBody } from './serialized-circuit';
import { collectSnapshots } from './snapshots';

// collectSnapshots only reads `project.components` (each component's config.type),
// so a lightweight stand-in keeps these tests free of PixiJS construction. The
// body serialization is exercised by the file round-trip spec via real Projects.
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

  // Master B (1 in / 1 out, two plugs) nested inside master A. Returns the
  // snapshot type ids the way the palette would place them.
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
          options: { direction: 0, label: 'in', index: 0 }
        },
        {
          type: BuiltInComponentType.OUTPUT,
          pos: [5, 0],
          options: { direction: 0, label: 'out', index: 0 }
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
          components: [{ type: snapB, pos: [2, 2], options: { direction: 0 } }],
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
      expect(definitions[0].source).toEqual({ id: 'id-b', version: 1 });
      // The body remap covers the directly-placed snapshot.
      expect(sessionToLocal.get(snapB)).toBe(1000);
    });

    it('dedups repeated placements of the same snapshot', () => {
      const master = registry.createMaster({ symbol: 'M' }, 'browser');
      const snap = registry.snapshot(master).typeId;
      expect(
        collectSnapshots(fakeProject([snap, snap]), registry).definitions.length
      ).toBe(1);
    });

    it('walks nested customs and rewrites the parent body to file-local ids', () => {
      const { snapA } = buildNestedSnapshots();
      const { definitions } = collectSnapshots(fakeProject([snapA]), registry);

      // First-encounter order: A is 1000, the B it nests is 1001.
      expect(definitions.map((d) => d.type)).toEqual([1000, 1001]);
      const defA = definitions.find((d) => d.symbol === 'A')!;
      const defB = definitions.find((d) => d.symbol === 'B')!;
      expect(defA.type).toBe(1000);
      expect(defB.type).toBe(1001);

      // The crux: A's body references B by its file-local id, not its session id.
      expect(defA.components.map((c) => c.type)).toEqual([defB.type]);
      // B's own body keeps built-in plug ids untouched.
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

      // Ingesting allocates fresh session ids; the returned remap keys are the
      // file-local ids.
      const remap = registry.ingestSnapshots(definitions);
      const sessionA = remap.get(1000)!;
      const sessionB = remap.get(1001)!;

      const ingestedA = registry.getDefinition(sessionA)!;
      const ingestedB = registry.getDefinition(sessionB)!;

      expect(ingestedA.kind).toBe('snapshot');
      expect(ingestedA.symbol).toBe('A');
      expect(ingestedA.id).toBe(idA);
      // id-space rule: the stored circuit holds post-remap SESSION ids.
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
