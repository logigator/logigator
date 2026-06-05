import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { TranslocoService } from '@jsverse/transloco';
import {
  serializeProject,
  toCircuitFileV0,
  WIRE_TYPE_ID
} from './server-circuit.codec';
import { EmbeddedDependency } from '../../api/models/dependencies';
import { CircuitFileService } from '../file/circuit-file.service';
import { Project } from '../../project/project';
import { ProjectElement } from '../../api/models/project-element';
import { setStaticDIInjector } from '../../utils/get-di';
import { ComponentProviderService } from '../../components/component-provider.service';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import {
  BuiltInComponentType,
  CUSTOM_TYPE_ID_BASE
} from '../../components/component-type.enum';
import { SerializedCircuitBody } from '../serialized-circuit';

// The server transport is legacy v0-over-HTTP: decode routes through the
// permanent `v0ToV1` migration (covered in v0-to-v1.migration.spec), encode
// through this temporary codec. The round-trip tests below pin the decode→encode
// identity property — the primary guardrail against an `i/o/n/s` transposition.

interface Fixture {
  name: string;
  elements: ProjectElement[];
}

// Inlined fixtures (no JSON imports — TS doesn't have resolveJsonModule
// enabled, and inlining avoids the build-config dependency). Each fixture is a
// minimal but non-trivial circuit. The set covers:
// - Each built-in component type (NOT=1, AND=2, TEXT=7, ROM=12)
// - Non-default rotations (r=1 South, r=2 West, r=3 North)
// - Non-minimum input counts (AND with 4 inputs)
// - Distinct n[] values (ROM word≠address) so n-order regressions show
// - Wires in both directions
// - Two wires crossing (T-junction-style geometry)
// - Multi-element circuit (NOT + AND + wires)
const fixtures: Fixture[] = [
  {
    name: 'NOT gate (default rotation)',
    elements: [{ t: 1, p: [5, 3], i: 1, o: 1 }]
  },
  {
    name: 'NOT gate rotated South',
    elements: [{ t: 1, p: [5, 3], i: 1, o: 1, r: 1 }]
  },
  {
    name: 'AND gate 2 inputs',
    elements: [{ t: 2, p: [3, 4], i: 2, o: 1 }]
  },
  {
    name: 'AND gate 4 inputs rotated West',
    elements: [{ t: 2, p: [10, 10], i: 4, o: 1, r: 2 }]
  },
  {
    name: 'ROM with distinct word/address sizes',
    elements: [{ t: 12, p: [10, 5], i: 3, o: 8, n: [8, 3] }]
  },
  {
    name: 'TEXT with text and fontSize',
    elements: [{ t: 7, p: [2, 2], n: [14], s: 'Hello world' }]
  },
  {
    name: 'TEXT with rotation North',
    elements: [{ t: 7, p: [4, 4], r: 3, n: [12], s: 'sideways' }]
  },
  {
    // Plug: `n[0]` carries the port index, `s` the port label. INPUT has a
    // single output (o:1) and no input — the `i`/`o` fields come from the
    // instance's fixed counts, not from the element.
    name: 'INPUT plug (index 0, label A)',
    elements: [{ t: 100, p: [3, 3], o: 1, n: [0], s: 'A' }]
  },
  {
    name: 'OUTPUT plug (index 2, label Q, rotated South)',
    elements: [{ t: 101, p: [6, 3], i: 1, r: 1, n: [2], s: 'Q' }]
  },
  {
    name: 'Horizontal and vertical wires (crossing)',
    elements: [
      { t: 0, p: [3, 5], q: [8, 5] },
      { t: 0, p: [5, 2], q: [5, 7] }
    ]
  },
  {
    name: 'Multi-component circuit (NOT + AND + wires)',
    elements: [
      { t: 1, p: [5, 3], i: 1, o: 1 },
      { t: 2, p: [15, 3], i: 2, o: 1 },
      { t: 0, p: [7, 3], q: [15, 3] },
      { t: 0, p: [10, 1], q: [10, 6] }
    ]
  }
];

function normalize(elements: ProjectElement[]): string {
  const sorted = [...elements].map((el) => ({
    t: el.t,
    p: el.p,
    q: el.q ?? null,
    r: el.r ?? null,
    i: el.i ?? null,
    o: el.o ?? null,
    n: el.n ?? null,
    s: el.s ?? null
  }));
  sorted.sort((a, b) => {
    const keyA = `${a.t}-${a.p[0]}-${a.p[1]}-${a.q?.[0] ?? ''}-${a.q?.[1] ?? ''}`;
    const keyB = `${b.t}-${b.p[0]}-${b.p[1]}-${b.q?.[0] ?? ''}-${b.q?.[1] ?? ''}`;
    return keyA.localeCompare(keyB);
  });
  return JSON.stringify(sorted);
}

describe('server-circuit.codec', () => {
  let circuitFile: CircuitFileService;
  let registry: CustomComponentRegistry;
  let provider: ComponentProviderService;

  beforeEach(() => {
    const translocoSpy = {
      translate: vi.fn().mockName('TranslocoService.translate')
    };
    translocoSpy.translate.mockImplementation((key: string) => key);
    TestBed.configureTestingModule({
      providers: [
        MessageService,
        { provide: TranslocoService, useValue: translocoSpy }
      ]
    });
    setStaticDIInjector(TestBed.inject(Injector));
    circuitFile = TestBed.inject(CircuitFileService);
    registry = TestBed.inject(CustomComponentRegistry);
    provider = TestBed.inject(ComponentProviderService);
  });

  function encode(project: Project) {
    return serializeProject(project, registry, provider);
  }

  /** Full server-read decode (migration + instance build) for a v0 element list. */
  function decode(
    elements: ProjectElement[],
    dependencies?: EmbeddedDependency[]
  ): Project {
    const { components, wires } = circuitFile.decode(
      toCircuitFileV0({ name: 'X', elements, dependencies })
    );
    const project = new Project();
    for (const c of components) project.addComponent(c);
    for (const w of wires) project.addWire(w);
    return project;
  }

  describe('WIRE_TYPE_ID', () => {
    it('should be 0 (matching old editor ElementTypeId.WIRE)', () => {
      expect(WIRE_TYPE_ID).toBe(0);
    });
  });

  describe('fixture round-trip (decode → encode)', () => {
    for (const fixture of fixtures) {
      it(`round-trips ${fixture.name}`, () => {
        const { elements } = encode(decode(fixture.elements));
        expect(normalize(elements)).toEqual(normalize(fixture.elements));
      });
    }
  });

  describe('serializeProject', () => {
    it('returns empty dependencies', () => {
      const { dependencies } = encode(new Project());
      expect(dependencies).toEqual([]);
    });

    it('ignores element i/o for plugs — counts come from the definition', () => {
      // A plug's port counts are fixed by its type, not the wire fields.
      // Even a bogus i/o must not change the instance's port count.
      const [plug] = [
        ...decode([{ t: 100, p: [0, 0], i: 9, o: 5, n: [0], s: 'A' }])
          .components
      ];
      expect(plug.numInputs).toBe(0);
      expect(plug.numOutputs).toBe(1);
    });

    it('preserves ROM input/output mapping (addressSize → i, wordSize → o)', () => {
      // Regression: old editor had numInputs=addressSize, numOutputs=wordSize.
      const [rom] = [
        ...decode([{ t: 12, p: [0, 0], i: 5, o: 6, n: [6, 5] }]).components
      ];
      expect(rom.numInputs).toBe(5);
      expect(rom.numOutputs).toBe(6);
    });
  });

  // A custom snapshot is folded into a dependency entry — legacy { id, model }
  // for old-client compat PLUS the additive frozen `snapshot`. New clients
  // render from the snapshot with zero extra fetches; ports come from the
  // snapshot, never from the element's i/o (Invariant A).
  describe('custom-component snapshots', () => {
    // A master (1 in / 1 out, two plugs) + a frozen snapshot placed from it.
    function placeOneCustom(direction = 1): {
      project: Project;
      snapType: number;
    } {
      const circuit: SerializedCircuitBody = {
        components: [
          {
            type: BuiltInComponentType.INPUT,
            pos: [0, 0],
            options: { direction: 0, label: 'A', index: 0 }
          },
          {
            type: BuiltInComponentType.OUTPUT,
            pos: [5, 0],
            options: { direction: 0, label: 'Q', index: 0 }
          }
        ],
        wires: [{ pos: [1, 0], direction: 0, length: 4 }]
      };
      const master = registry.createMaster(
        {
          id: 'master-uuid',
          version: 3,
          name: 'Half Adder',
          symbol: 'HA',
          description: 'demo',
          numInputs: 1,
          numOutputs: 1,
          labels: ['A', 'Q'],
          circuit
        },
        'server'
      );
      const snapType = registry.snapshot(master).typeId;
      const config = provider.getComponent(snapType)!;
      const instance = config.create({
        direction: config.options['direction'].clone(direction)
      });
      instance.position.set(7, 2);

      const project = new Project();
      project.addComponent(instance);
      return { project, snapType };
    }

    it('emits both legacy { id, model } and the additive snapshot', () => {
      const { project } = placeOneCustom();
      const { elements, dependencies } = encode(project);

      expect(dependencies.length).toBe(1);
      const dep = dependencies[0];
      // Legacy compat fields.
      expect(dep.id).toBe('master-uuid');
      expect(dep.model).toBe(CUSTOM_TYPE_ID_BASE);
      // The body references the dependency by the same file-local id.
      const customEl = elements.find((e) => e.t >= CUSTOM_TYPE_ID_BASE)!;
      expect(customEl.t).toBe(dep.model);
      expect(customEl.r).toBe(1); // direction round-trips

      // The additive frozen snapshot: provenance, summary, and its circuit.
      expect(dep.snapshot).toBeDefined();
      expect(dep.snapshot!.version).toBe(3);
      expect(dep.snapshot!.numInputs).toBe(1);
      expect(dep.snapshot!.numOutputs).toBe(1);
      expect(dep.snapshot!.labels).toEqual(['A', 'Q']);
      // The snapshot body carries the plugs + wire positionally.
      const plugTypes = dep
        .snapshot!.elements.filter((e) => e.t !== WIRE_TYPE_ID)
        .map((e) => e.t)
        .sort();
      expect(plugTypes).toEqual([
        BuiltInComponentType.INPUT,
        BuiltInComponentType.OUTPUT
      ]);
      expect(
        dep.snapshot!.elements.filter((e) => e.t === WIRE_TYPE_ID).length
      ).toBe(1);
    });

    it('loads from the embedded snapshot — ports come from it (Inv. A)', () => {
      const encoded = encode(placeOneCustom(2).project);
      const reopened = decode(encoded.elements, encoded.dependencies);

      const instance = [...reopened.components].find(
        (c) => c.config.type >= CUSTOM_TYPE_ID_BASE
      )!;
      expect(instance).toBeDefined();
      expect(instance.numInputs).toBe(1);
      expect(instance.numOutputs).toBe(1);
      expect(instance.direction).toBe(2); // direction survived the round-trip

      // Provenance survives so the editor can offer "update available".
      const def = registry.getDefinition(instance.config.type)!;
      expect(def.kind).toBe('snapshot');
      expect(def.id).toBe('master-uuid');
      expect(def.version).toBe(3);
      expect(def.labels).toEqual(['A', 'Q']);
    });

    it('ignores element i/o on load — counts come from the snapshot', () => {
      // A hand-built response with deliberately bogus i/o on the custom body
      // element: the instance must still adopt the snapshot's 1/1, proving the
      // decode pulls counts from the definition, not the wire fields.
      const dependencies: EmbeddedDependency[] = [
        {
          dependency: { id: 'master-uuid', version: 5 },
          model: CUSTOM_TYPE_ID_BASE,
          snapshot: {
            version: 3,
            name: 'HA',
            symbol: 'HA',
            description: '',
            numInputs: 1,
            numOutputs: 1,
            labels: ['A', 'Q'],
            elements: [
              {
                t: BuiltInComponentType.INPUT,
                p: [0, 0],
                o: 1,
                n: [0],
                s: 'A'
              },
              {
                t: BuiltInComponentType.OUTPUT,
                p: [5, 0],
                i: 1,
                n: [0],
                s: 'Q'
              }
            ]
          }
        }
      ];
      const reopened = decode(
        [{ t: CUSTOM_TYPE_ID_BASE, p: [3, 3], i: 9, o: 9 }],
        dependencies
      );
      const instance = [...reopened.components].find(
        (c) => c.config.type >= CUSTOM_TYPE_ID_BASE
      )!;
      expect(instance.numInputs).toBe(1);
      expect(instance.numOutputs).toBe(1);
    });

    it('skips reference-only dependencies (no embedded snapshot)', () => {
      // Old always-latest model: a dependency with no `snapshot`. Nothing to
      // ingest — the custom ref stays unresolved (tombstone territory) and is
      // dropped here rather than throwing.
      const reopened = decode(
        [{ t: BuiltInComponentType.AND, p: [0, 0], i: 2 }],
        [{ dependency: { id: 'x' }, model: CUSTOM_TYPE_ID_BASE }]
      );
      expect([...reopened.components].length).toBe(1);
    });
  });

  describe('wire round-trip detail', () => {
    it('correctly round-trips wire position with half-grid offset', () => {
      const elements: ProjectElement[] = [{ t: 0, p: [3, 5], q: [8, 5] }];

      const project = decode(elements);
      const wire = [...project.wires][0];
      expect(wire.position.x).toBe(3.5);
      expect(wire.position.y).toBe(5.5);

      expect(encode(project).elements).toEqual(elements);
    });
  });
});
