import { beforeEach, describe, expect, it } from 'vitest';
import { v0ToV1Migration } from './v0-to-v1.migration';
import { MigrationContext } from './migration';
import { builtInMeta } from '../../catalog/built-in-meta';
import { LegacyV0Slots } from '../../catalog/component-meta';
import { BuiltInComponentType } from '../../model/component-type.enum';
import { decodeComponentPositions } from '../../codecs/position-delta.codec';
import { decodeWireChain } from '../../codecs/wire-chain.codec';
import { CircuitFileV0 } from '../circuit-file.types';
import { InvalidFileError } from '../circuit-file.errors';

describe('v0ToV1Migration', () => {
  let ctx: MigrationContext;
  let warnings: string[];

  beforeEach(() => {
    warnings = [];
    ctx = {
      catalog: builtInMeta,
      log: { info: () => undefined, warn: (message) => warnings.push(message) }
    };
  });

  function migrate(input: CircuitFileV0) {
    return v0ToV1Migration.migrate(input, ctx);
  }

  it('maps a full legacy file to v1 with named options and empty definitions', () => {
    const result = migrate({
      project: {
        name: 'Legacy Circuit',
        elements: [
          { t: 2, p: [3, 4], i: 3, r: 1 }, // AND, 3 inputs, rotated South
          { t: 12, p: [10, 5], i: 3, o: 8, n: [8, 3], s: 'gQ==' }, // ROM word=8 addr=3, contents 0x81
          { t: 7, p: [2, 2], n: [14], s: 'Hello world' }, // TEXT
          { t: 0, p: [3, 5], q: [8, 5] }, // horizontal wire
          { t: 0, p: [5, 2], q: [5, 7] } // vertical wire
        ]
      }
    });

    expect(result.version).toBe(1);
    expect(result.name).toBe('Legacy Circuit');
    // No top-level `components` array here, so no sub-circuit definitions.
    expect(result.definitions).toEqual([]);

    // Persisted positions are delta-encoded; restore absolutes to assert.
    const components = decodeComponentPositions(result.components);
    const and = components.find((c) => c.type === 2)!;
    // Rotated South (W=2, H=max(1,3)=3): the legacy top-left is fixed, so the
    // pivot shifts by +H on x.
    expect(and.pos).toEqual([6, 4]);
    expect(and.direction).toBe(1);
    expect(and.options).toEqual({ numInputs: 3 });

    const rom = components.find((c) => c.type === 12)!;
    expect(rom.direction).toBeUndefined();
    expect(rom.options).toEqual({
      wordSize: 8,
      addressSize: 3,
      data: 'gQ==' // legacy `s` blob decodes verbatim into the data option
    });

    const text = components.find((c) => c.type === 7)!;
    expect(text.direction).toBeUndefined();
    expect(text.options).toEqual({
      fontSize: 28, // legacy n[0]=14 rendered at ×(16/8)=28 px
      text: 'Hello world'
    });

    // Emission order: the walk starts at the (y, x)-smallest canonical start,
    // so the vertical wire at y=2 comes first.
    expect(decodeWireChain(result.wires)).toEqual([
      { pos: [5, 2], direction: 1, length: 5 },
      { pos: [3, 5], direction: 0, length: 5 }
    ]);
  });

  it('revives an old-editor file sub-circuit into a snapshot definition', () => {
    const result = migrate({
      project: {
        name: 'With Custom',
        elements: [
          { t: 2, p: [15, 36], i: 2, o: 1 }, // AND
          { t: 1003, p: [11, 36], o: 1 } // custom instance
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
            { t: 201, p: [19, 39], o: 1 }, // SWITCH
            { t: 101, p: [21, 39], i: 1 }, // OUTPUT
            { t: 12, p: [21, 26], i: 4, o: 4, n: [4, 4] } // ROM
          ]
        }
      ]
    });

    // The custom instance survives in the body with its file-local type id.
    expect(result.components.find((c) => c.type === 1003)).toBeTruthy();

    expect(result.definitions.length).toBe(1);
    const def = result.definitions[0];
    expect(def.type).toBe(1003); // info.id becomes the file-local type
    expect(def.name).toBe('sadf');
    expect(def.symbol).toBe('asdf');
    expect(def.description).toBe('dsaf');
    expect(def.numInputs).toBe(0);
    expect(def.numOutputs).toBe(1);
    expect(def.labels).toEqual([]);
    // Inner built-ins decode through the same positional-slot mapping.
    expect(def.components.map((c) => c.type).sort((a, b) => a - b)).toEqual([
      12, 101, 201
    ]);
    const rom = def.components.find((c) => c.type === 12)!;
    expect(rom.options).toMatchObject({ wordSize: 4, addressSize: 4 });
  });

  it('re-anchors a rotated custom instance from body top-left to pivot', () => {
    // A 0-in/1-out custom (W=3, H=max(1,0,1)=1) at legacy anchor [10,10] in
    // each direction, its extent taken from the inline definition's port
    // counts.
    const positions = [0, 1, 2, 3].map((r) => {
      const result = migrate({
        project: { elements: [{ t: 1003, p: [10, 10], o: 1, r }] },
        components: [
          {
            info: { id: 1003, numInputs: 0, numOutputs: 1 },
            elements: []
          }
        ]
      });
      return result.components[0].pos;
    });

    expect(positions).toEqual([
      [10, 10], // E
      [11, 10], // S: +H
      [13, 11], // W: +W, +H
      [10, 13] // N: +W
    ]);
  });

  it('re-anchors a rotated custom from its own instance i/o when no definition', () => {
    // No matching definition, so dims fall back to the instance's i/o: a
    // 2-in/2-out custom (W=3, H=2) rotated South at [10,10] pivots to [12,10].
    const result = migrate({
      project: { elements: [{ t: 1003, p: [10, 10], i: 2, o: 2, r: 1 }] }
    });
    expect(result.components[0].pos).toEqual([12, 10]);
  });

  it('skips a legacy sub-circuit definition with no numeric info.id', () => {
    const result = migrate({
      project: { elements: [{ t: 1, p: [0, 0], i: 1, o: 1 }] },
      components: [{ info: { name: 'orphan' }, elements: [] }]
    });
    expect(result.definitions).toEqual([]);
  });

  it('re-anchors a rotated component from body top-left to rotation pivot', () => {
    // Same AND (type 2, W=2, H=max(1,3)=3) at legacy anchor [3,4] in each
    // direction. Pivot offsets: E (0,0), S (+H,0), W (+W,+H), N (0,+W).
    const positions = [0, 1, 2, 3].map((r) => {
      const result = migrate({
        project: { elements: [{ t: 2, p: [3, 4], i: 3, r }] }
      });
      return result.components[0].pos;
    });

    expect(positions).toEqual([
      [3, 4], // E
      [6, 4], // S: +H
      [5, 7], // W: +W, +H
      [3, 6] // N: +W
    ]);
  });

  it('drops unsupported component types with a warning', () => {
    const result = migrate({
      project: {
        elements: [
          { t: 98, p: [0, 0] }, // unassigned built-in id — unknown
          { t: 1, p: [5, 5], i: 1, o: 1 } // NOT — supported
        ]
      }
    });

    expect(result.components.length).toBe(1);
    expect(result.components[0].type).toBe(1);
    expect(warnings).toEqual([
      expect.stringContaining('Unknown component type ID: 98')
    ]);
  });

  it('decodes tunnel labels from s, falling back to the legacy numeric id', () => {
    const result = migrate({
      project: {
        elements: [
          { t: 8, p: [0, 0], i: 1, n: [7] }, // legacy save: numeric id only
          { t: 8, p: [0, 5], i: 1, n: [7], s: 'CLK' } // v2 save: label in s
        ]
      }
    });

    expect(result.components.map((c) => c.options['label'])).toEqual([
      '7',
      'CLK'
    ]);
  });

  it("defaults a missing project name to 'Untitled'", () => {
    const result = migrate({ project: { elements: [] } });
    expect(result.name).toBe('Untitled');
  });

  it('throws InvalidFileError when project elements are missing', () => {
    expect(() => migrate({} as CircuitFileV0)).toThrowError(InvalidFileError);
    expect(() => migrate({ project: {} } as CircuitFileV0)).toThrowError(
      InvalidFileError
    );
  });

  // v0 has no schema, so an element missing a coordinate must be a rejection:
  // reading past it turns a malformed upload into a crash.
  describe('elements with unreadable coordinates', () => {
    const malformed: Record<string, unknown> = {
      'a wire with no end': { t: 0, p: [0, 0] },
      'a wire with a one-element end': { t: 0, p: [0, 0], q: [4] },
      'a component with no position': { t: BuiltInComponentType.AND, i: 2 },
      'a custom with no position': { t: 1000, i: 1, o: 1 },
      'a position that is not numeric': {
        t: BuiltInComponentType.AND,
        p: ['x', 'y']
      },
      'a position that is not finite': {
        t: BuiltInComponentType.AND,
        p: [Number.NaN, 0]
      }
    };

    for (const [what, element] of Object.entries(malformed)) {
      it(`rejects ${what}`, () => {
        expect(() =>
          migrate({ project: { elements: [element] } } as CircuitFileV0)
        ).toThrowError(InvalidFileError);
      });
    }
  });

  // Pins each built-in's legacyV0Slots descriptor exactly: a missing one, or a
  // wrong n[]/s mapping, silently drops or transposes options on decode.
  describe('legacyV0Slots descriptors', () => {
    const expected: Record<number, LegacyV0Slots> = {
      [BuiltInComponentType.NOT]: {},
      [BuiltInComponentType.AND]: { i: 'numInputs' },
      [BuiltInComponentType.TEXT]: {
        n: ['fontSize'],
        s: 'text'
      },
      [BuiltInComponentType.ROM]: {
        s: 'data',
        n: ['wordSize', 'addressSize']
      },
      [BuiltInComponentType.INPUT]: {
        s: 'label',
        n: ['index']
      },
      [BuiltInComponentType.OUTPUT]: {
        s: 'label',
        n: ['index']
      }
    };

    for (const [type, slots] of Object.entries(expected)) {
      it(`pins the descriptor for built-in type ${type}`, () => {
        expect(builtInMeta(Number(type))?.legacyV0Slots).toEqual(slots);
      });
    }
  });
});
