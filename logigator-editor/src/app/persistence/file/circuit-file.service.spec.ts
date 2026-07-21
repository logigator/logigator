/* eslint-disable @typescript-eslint/no-empty-function */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TranslationService } from '../../translation/translation.service';
import { configureTestBed } from '../../../testing/configure-test-bed';
import { CircuitFileService } from './circuit-file.service';
import { toCircuitFileV0 } from '../server/server-circuit.codec';
import { LoggingService } from '../../logging/logging.service';
import { ComponentProviderService } from '../../components/component-provider.service';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import {
  BuiltInComponentType,
  CUSTOM_TYPE_ID_BASE
} from '../../components/component-type.enum';
import { Component } from '../../components/component';
import { Project } from '../../project/project';
import { ProjectElement } from '../../api/models/project-element';
import { SerializedCircuitBody } from '../serialized-circuit';
import { decodeWireChain } from '../wire-chain.codec';
import { InvalidFileError } from './circuit-file.errors';

interface BodyComponent {
  type: number;
  pos: [number, number];
  options: Record<string, unknown>;
  negInputs?: number[];
  negOutputs?: number[];
}
interface BodyWire {
  pos: [number, number];
  direction: number;
  length: number;
}

function sortComponents(components: BodyComponent[]): BodyComponent[] {
  return [...components].sort((a, b) =>
    `${a.type}-${a.pos[0]}-${a.pos[1]}`.localeCompare(
      `${b.type}-${b.pos[0]}-${b.pos[1]}`
    )
  );
}

function sortWires(wires: BodyWire[]): BodyWire[] {
  return [...wires].sort((a, b) =>
    `${a.pos[0]}-${a.pos[1]}-${a.direction}`.localeCompare(
      `${b.pos[0]}-${b.pos[1]}-${b.direction}`
    )
  );
}

// Sort components/wires (and recursively, embedded definitions) into a stable
// order so structurally-equal documents with different element ordering compare
// equal (mirrors server-circuit.codec.spec). Chain-encoded wires are decoded
// first: two encodings are equal iff they decode to the same wire set.
function normalize(json: string): string {
  const parsed = JSON.parse(json);
  return JSON.stringify({
    version: parsed.version,
    name: parsed.name,
    components: sortComponents(parsed.components ?? []),
    wires: sortWires(decodeWireChain(parsed.wires ?? '')),
    definitions: [...(parsed.definitions ?? [])]
      .sort((a, b) => a.type - b.type)
      .map((d) => ({
        ...d,
        components: sortComponents(d.components),
        wires: sortWires(decodeWireChain(d.wires))
      }))
  });
}

describe('CircuitFileService', () => {
  let service: CircuitFileService;
  let provider: ComponentProviderService;
  let registry: CustomComponentRegistry;
  let logging: LoggingService;

  beforeEach(() => {
    // Suppress console output from expected warning/error paths exercised by the tests.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const translocoSpy = {
      translate: vi.fn().mockName('TranslocoService.translate'),
      getActiveLang: () => 'en',
      load: () => of({})
    };
    translocoSpy.translate.mockImplementation((key: string) => key);
    configureTestBed([{ provide: TranslationService, useValue: translocoSpy }]);
    service = TestBed.inject(CircuitFileService);
    provider = TestBed.inject(ComponentProviderService);
    registry = TestBed.inject(CustomComponentRegistry);
    logging = TestBed.inject(LoggingService);
  });

  // Build a Project from legacy positional elements via the server-read decode
  // path (v0→v1 migration + instance build), the same route real server loads take.
  function buildProject(elements: ProjectElement[]): Project {
    const { components, wires } = service.decode(
      toCircuitFileV0({ name: 'x', elements })
    );
    const project = new Project();
    for (const c of components) project.addComponent(c);
    for (const w of wires) project.addWire(w);
    return project;
  }

  function rebuild(json: string): Project {
    const { components, wires } = service.fromJson(json);
    const project = new Project();
    for (const c of components) project.addComponent(c);
    for (const w of wires) project.addWire(w);
    return project;
  }

  function place(project: Project, snapTypeId: number, pos: [number, number]) {
    const config = provider.getComponent(snapTypeId)!;
    project.addComponent(Component.deserialize({ pos, options: {} }, config));
  }

  // A single INPUT + OUTPUT plug pair — the contents shared by the nested-custom
  // fixtures, exercising plug round-tripping inside an embedded definition.
  const plugCircuit: SerializedCircuitBody = {
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

  describe('toJson', () => {
    it('encodes version, name, named options, and empty definitions', () => {
      const project = buildProject([{ t: 2, p: [15, 3], i: 2, o: 1 }]);
      const json = JSON.parse(service.toJson(project, 'My Circuit'));

      expect(json.version).toBe(1);
      expect(json.name).toBe('My Circuit');
      expect(json.wires).toBe('');
      expect(json.definitions).toEqual([]);
      expect(json.components.length).toBe(1);
      expect(json.components[0]).toEqual({
        type: 2,
        pos: [15, 3],
        options: { numInputs: 2 }
      });
    });

    it('omits the attribution field when no lineage is passed', () => {
      const project = buildProject([{ t: 1, p: [0, 0], i: 1, o: 1 }]);
      const json = JSON.parse(service.toJson(project, 'NoFork'));

      expect('attribution' in json).toBe(false);
    });

    it('encodes a plug with its named label/index options', () => {
      const project = buildProject([
        { t: 100, p: [4, 4], o: 1, n: [3], s: 'CLK' }
      ]);
      const json = JSON.parse(service.toJson(project, 'Plug'));

      expect(json.components.length).toBe(1);
      expect(json.components[0]).toEqual({
        type: 100,
        pos: [4, 4],
        options: { label: 'CLK', index: 3 }
      });
    });
  });

  describe('round-trip', () => {
    it('preserves a multi-element circuit through toJson → fromJson → toJson', () => {
      const elements: ProjectElement[] = [
        { t: 1, p: [5, 3], i: 1, o: 1 }, // NOT
        { t: 2, p: [15, 3], i: 2, o: 1 }, // AND
        { t: 12, p: [10, 5], i: 3, o: 8, n: [8, 3] }, // ROM
        { t: 7, p: [2, 2], n: [14], s: 'Hello' }, // TEXT
        { t: 100, p: [0, 8], o: 1, n: [0], s: 'A' }, // INPUT plug
        { t: 101, p: [20, 8], i: 1, n: [1], s: 'Q' }, // OUTPUT plug
        { t: 200, p: [8, 8], o: 1, r: 1 }, // BUTTON
        { t: 201, p: [12, 8], o: 1 }, // SWITCH
        { t: 0, p: [7, 3], q: [15, 3] } // wire
      ];
      const json = service.toJson(buildProject(elements), 'Round');
      const json2 = service.toJson(rebuild(json), 'Round');

      expect(normalize(json2)).toEqual(normalize(json));
    });

    it('round-trips port negation on a built-in through toJson → fromJson', () => {
      const project = buildProject([{ t: 2, p: [5, 3], i: 3, o: 1 }]); // AND, 3 inputs
      const and = [...project.components][0];
      and.setPortNegated('in', 2, true);
      and.setPortNegated('out', 0, true);

      const parsed = JSON.parse(service.toJson(project, 'Neg'));
      expect(parsed.components[0].negInputs).toEqual([2]);
      expect(parsed.components[0].negOutputs).toEqual([0]);

      const reloaded = rebuild(service.toJson(project, 'Neg'));
      const restored = [...reloaded.components][0];
      expect(restored.isPortNegated('in', 2)).toBe(true);
      expect(restored.isPortNegated('out', 0)).toBe(true);
    });

    it('round-trips a 1-deep custom (with plugs) and embeds it as a definition', () => {
      const masterB = registry.createMaster(
        {
          id: 'id-b',
          symbol: 'B',
          numInputs: 1,
          numOutputs: 1,
          labels: ['in', 'out'],
          circuit: plugCircuit
        },
        'browser'
      );
      const project = new Project();
      place(project, registry.snapshot(masterB).typeId, [3, 3]);

      const json = service.toJson(project, 'OneDeep');
      const parsed = JSON.parse(json);

      expect(parsed.definitions.length).toBe(1);
      expect(parsed.definitions[0].type).toBe(1000);
      expect(parsed.definitions[0].numInputs).toBe(1);
      expect(
        parsed.definitions[0].components.map((c: BodyComponent) => c.type)
      ).toEqual([BuiltInComponentType.INPUT, BuiltInComponentType.OUTPUT]);
      expect(parsed.components[0].type).toBe(1000);

      const json2 = service.toJson(rebuild(json), 'OneDeep');
      expect(normalize(json2)).toEqual(normalize(json));
    });

    it('preserves negation on a built-in embedded inside a custom definition', () => {
      const master = registry.createMaster(
        {
          id: 'id-neg',
          symbol: 'N',
          numInputs: 1,
          numOutputs: 1,
          labels: ['in', 'out'],
          circuit: {
            components: [
              {
                type: BuiltInComponentType.AND,
                pos: [2, 2],
                options: { numInputs: 2 },
                negInputs: [1]
              }
            ],
            wires: []
          }
        },
        'browser'
      );
      const project = new Project();
      place(project, registry.snapshot(master).typeId, [3, 3]);

      const parsed = JSON.parse(service.toJson(project, 'NegCustom'));
      const andBody = parsed.definitions[0].components.find(
        (c: BodyComponent) => c.type === BuiltInComponentType.AND
      );
      expect(andBody.negInputs).toEqual([1]);

      // The embedded negation survives a full reload + re-encode.
      const json2 = service.toJson(rebuild(service.toJson(project, 'X')), 'X');
      const reAnd = JSON.parse(json2).definitions[0].components.find(
        (c: BodyComponent) => c.type === BuiltInComponentType.AND
      );
      expect(reAnd.negInputs).toEqual([1]);
    });

    it('round-trips a 2-deep nested custom and opens it post-load (id-space rule)', () => {
      const masterB = registry.createMaster(
        {
          id: 'id-b',
          symbol: 'B',
          numInputs: 1,
          numOutputs: 1,
          labels: ['in', 'out'],
          circuit: plugCircuit
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
      const project = new Project();
      place(project, registry.snapshot(masterA).typeId, [4, 4]);

      const json = service.toJson(project, 'TwoDeep');
      const parsed = JSON.parse(json);

      // A (1000) embeds a reference to B (1001) in its body.
      const defA = parsed.definitions.find(
        (d: { symbol: string }) => d.symbol === 'A'
      );
      const defB = parsed.definitions.find(
        (d: { symbol: string }) => d.symbol === 'B'
      );
      expect(defA.type).toBe(1000);
      expect(defB.type).toBe(1001);
      expect(defA.components.map((c: BodyComponent) => c.type)).toEqual([1001]);

      // Reload: the main instance resolves, and its definition's nested ref also
      // resolves against the session id space (nothing dangles).
      const { components } = service.fromJson(json);
      const reloadedType = components[0].config.type;
      const reloadedDefA = registry.getDefinition(reloadedType)!;
      expect(reloadedDefA.symbol).toBe('A');
      const nestedType = reloadedDefA.circuit!.components[0].type;
      const nestedDefB = registry.getDefinition(nestedType)!;
      expect(nestedDefB.symbol).toBe('B');
      expect(provider.getComponent(nestedType)).toBeTruthy();

      const json2 = service.toJson(rebuild(json), 'TwoDeep');
      expect(normalize(json2)).toEqual(normalize(json));
    });
  });

  describe('fork attribution', () => {
    const lineage = [
      { projectId: 'root-id', projectName: 'Root', authorName: 'alice' },
      { projectId: 'parent-id', projectName: 'Parent', authorName: 'bob' }
    ];

    it('round-trips the lineage through toJson → fromJson', () => {
      const project = buildProject([{ t: 1, p: [0, 0], i: 1, o: 1 }]);
      const json = service.toJson(project, 'Fork', lineage);

      const { attribution } = service.fromJson(json);

      expect(attribution).toEqual(lineage);
    });

    it('returns no attribution for a document without one', () => {
      const json = service.toJson(
        buildProject([{ t: 1, p: [0, 0], i: 1, o: 1 }]),
        'NoFork'
      );

      expect(service.fromJson(json).attribution).toBeUndefined();
    });

    it('throws InvalidFileError on a malformed attribution entry', () => {
      const file = JSON.stringify({
        version: 1,
        name: 'x',
        components: [],
        wires: '',
        definitions: [],
        attribution: [{ projectId: 'a', projectName: 'b' }] // authorName missing
      });

      expect(() => service.fromJson(file)).toThrowError(InvalidFileError);
    });
  });

  describe('fromJson', () => {
    it('reads a legacy (versionless) file by migrating it', () => {
      const legacy = JSON.stringify({
        project: { name: 'L', elements: [{ t: 1, p: [0, 0], i: 1, o: 1 }] }
      });
      const { name, components, wires } = service.fromJson(legacy);

      expect(name).toBe('L');
      expect(components.length).toBe(1);
      expect(wires.length).toBe(0);
    });

    it('loads a legacy file custom component from its inline definition', () => {
      const warnSpy = vi.spyOn(logging, 'warn');
      // The exact old-editor local-file shape: the sub-circuit definition lives
      // in the top-level `components` array, and the body references it by id.
      const legacy = JSON.stringify({
        project: {
          name: 'New Project',
          elements: [
            { t: 2, p: [15, 36], i: 2, o: 1 },
            { t: 1003, p: [11, 36], o: 1 }
          ]
        },
        components: [
          {
            info: {
              id: 1003,
              numInputs: 0,
              numOutputs: 1,
              labels: [],
              description: 'dsaf',
              name: 'sadf',
              symbol: 'asdf'
            },
            elements: [
              { t: 201, p: [19, 39], o: 1 },
              { t: 101, p: [21, 39], i: 1 },
              { t: 12, p: [21, 26], i: 4, o: 4, n: [4, 4] }
            ]
          }
        ]
      });

      const { components, skippedCustom } = service.fromJson(legacy);

      // Both the AND and the custom instance load — nothing skipped.
      expect(components.length).toBe(2);
      expect(skippedCustom).toBe(0);
      expect(warnSpy).not.toHaveBeenCalled();
      const custom = components.find(
        (c) => c.config.type >= CUSTOM_TYPE_ID_BASE
      )!;
      expect(custom).toBeTruthy();
      expect(custom.numOutputs).toBe(1);
      expect(custom.numInputs).toBe(0);
    });

    it('throws InvalidFileError on malformed JSON', () => {
      expect(() => service.fromJson('{not json')).toThrowError(
        InvalidFileError
      );
    });

    it('throws InvalidFileError on a structurally invalid component', () => {
      const file = JSON.stringify({
        version: 1,
        name: 'x',
        components: [{ type: 1, pos: 'nope', options: {} }],
        wires: '',
        definitions: []
      });
      expect(() => service.fromJson(file)).toThrowError(InvalidFileError);
    });

    it('throws InvalidFileError on a structurally invalid wire chain', () => {
      const file = JSON.stringify({
        version: 1,
        name: 'x',
        components: [],
        wires: '0,0:x3',
        definitions: []
      });
      expect(() => service.fromJson(file)).toThrowError(InvalidFileError);
    });

    it('throws InvalidFileError when wires is not a chain string', () => {
      const file = JSON.stringify({
        version: 1,
        name: 'x',
        components: [],
        wires: [{ pos: [0, 0], direction: 0, length: 3 }],
        definitions: []
      });
      expect(() => service.fromJson(file)).toThrowError(InvalidFileError);
    });

    it('throws InvalidFileError (not a TypeError) on a definition with a broken body', () => {
      const file = JSON.stringify({
        version: 1,
        name: 'x',
        components: [],
        wires: '',
        definitions: [
          {
            type: CUSTOM_TYPE_ID_BASE,
            name: 'Broken',
            symbol: 'B',
            description: '',
            numInputs: 1,
            numOutputs: 1,
            labels: [],
            components: 'junk',
            wires: ''
          }
        ]
      });
      expect(() => service.fromJson(file)).toThrowError(InvalidFileError);
    });

    it('drops unknown component types with a warning', () => {
      const warnSpy = vi.spyOn(logging, 'warn');
      const file = JSON.stringify({
        version: 1,
        name: 'x',
        components: [
          { type: 99, pos: [0, 0], options: {} },
          { type: 1, pos: [1, 1], options: {} }
        ],
        wires: '',
        definitions: []
      });

      const { components } = service.fromJson(file);

      expect(components.length).toBe(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('unresolved type 99'),
        'circuit-builder'
      );
    });

    it('drops a custom whose snapshot is missing and counts the skip', () => {
      const warnSpy = vi.spyOn(logging, 'warn');
      // A custom-range body element with no matching definition — an old
      // reference-only / client-stripped document.
      const file = JSON.stringify({
        version: 1,
        name: 'x',
        components: [
          { type: CUSTOM_TYPE_ID_BASE, pos: [0, 0], options: {} },
          { type: BuiltInComponentType.AND, pos: [1, 1], options: {} }
        ],
        wires: '',
        definitions: []
      });

      const { components, skippedCustom } = service.fromJson(file);

      expect(components.length).toBe(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          `Unknown component type ID: ${CUSTOM_TYPE_ID_BASE}`
        ),
        'CircuitFileService'
      );
      // Unlike unknown built-ins, a missing custom is counted so the load
      // entry points can surface it to the user.
      expect(skippedCustom).toBe(1);
    });

    it('does not alias a missing custom snapshot to an unrelated session type', () => {
      // Occupy session type id 1000 with an unrelated master, so a naive
      // `remap.get(t) ?? t` fallthrough would resolve a missing file-local 1000
      // to THIS component. The id-space branch must skip it instead.
      const occupant = registry.createMaster({ symbol: 'Z' }, 'browser');
      expect(occupant).toBe(CUSTOM_TYPE_ID_BASE);
      vi.spyOn(logging, 'warn');

      const file = JSON.stringify({
        version: 1,
        name: 'x',
        components: [{ type: CUSTOM_TYPE_ID_BASE, pos: [0, 0], options: {} }],
        wires: '',
        definitions: []
      });

      const { components } = service.fromJson(file);

      expect(components.length).toBe(0);
    });

    it('tolerates malformed negation fields, sanitizing rather than crashing', () => {
      const file = JSON.stringify({
        version: 1,
        name: 'x',
        components: [
          {
            type: BuiltInComponentType.AND,
            pos: [0, 0],
            options: { numInputs: 2 },
            negInputs: 'garbage', // not an array → ignored
            negOutputs: [0, -1, 1.5] // sanitized to [0]
          }
        ],
        wires: '',
        definitions: []
      });

      const { components } = service.fromJson(file);

      expect(components.length).toBe(1);
      expect(components[0].isPortNegated('in', 0)).toBe(false);
      expect(components[0].isPortNegated('out', 0)).toBe(true);
    });

    it('allocates fresh ids for loaded components and wires', () => {
      const json = service.toJson(
        buildProject([
          { t: 1, p: [0, 0], i: 1, o: 1 },
          { t: 0, p: [2, 2], q: [5, 2] }
        ]),
        'Ids'
      );
      const { components, wires } = service.fromJson(json);

      expect(components[0].id).toBeGreaterThan(0);
      expect(wires[0].id).toBeGreaterThan(0);
    });
  });
});
