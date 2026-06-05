import { TestBed } from '@angular/core/testing';
import { v0ToV1Migration } from './v0-to-v1.migration';
import { MigrationContext } from './migration';
import { ComponentProviderService } from '../../../components/component-provider.service';
import { LoggingService } from '../../../logging/logging.service';
import { InvalidFileError } from '../circuit-file.errors';
import { CircuitFileV0 } from '../circuit-file.types';
import { BuiltInComponentType } from '../../../components/component-type.enum';
import { LegacyV0Slots } from '../../../components/component-config.model';

describe('v0ToV1Migration', () => {
  let ctx: MigrationContext;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    ctx = {
      componentProvider: TestBed.inject(ComponentProviderService),
      logging: TestBed.inject(LoggingService)
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
          { t: 12, p: [10, 5], i: 3, o: 8, n: [8, 3] }, // ROM word=8 addr=3
          { t: 7, p: [2, 2], n: [14], s: 'Hello world' }, // TEXT
          { t: 0, p: [3, 5], q: [8, 5] }, // horizontal wire
          { t: 0, p: [5, 2], q: [5, 7] } // vertical wire
        ]
      }
    });

    expect(result.version).toBe(1);
    expect(result.name).toBe('Legacy Circuit');
    // Legacy files carry no native custom snapshots; sub-circuits are dropped.
    expect(result.definitions).toEqual([]);

    const and = result.components.find((c) => c.type === 2)!;
    expect(and.pos).toEqual([3, 4]);
    expect(and.options).toEqual({ direction: 1, numInputs: 3 });

    const rom = result.components.find((c) => c.type === 12)!;
    expect(rom.options).toEqual({ direction: 0, wordSize: 8, addressSize: 3 });

    const text = result.components.find((c) => c.type === 7)!;
    expect(text.options).toEqual({
      direction: 0,
      fontSize: 14,
      text: 'Hello world'
    });

    expect(result.wires).toEqual([
      { pos: [3, 5], direction: 0, length: 5 },
      { pos: [5, 2], direction: 1, length: 5 }
    ]);
  });

  it('drops unsupported component types with a warning', () => {
    const warnSpy = spyOn(ctx.logging, 'warn');
    const result = migrate({
      project: {
        elements: [
          { t: 3, p: [0, 0] }, // OR — not supported in v1
          { t: 1, p: [5, 5], i: 1, o: 1 } // NOT — supported
        ]
      }
    });

    expect(result.components.length).toBe(1);
    expect(result.components[0].type).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(
      jasmine.stringContaining('Unknown component type ID: 3'),
      'v0ToV1Migration'
    );
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

  // Pins each built-in's legacyV0Slots descriptor exactly. A new built-in
  // without one — or a wrong n[]/s mapping — would silently drop or transpose
  // options on decode; this catches it. Mirrors the encoder, which reads the
  // same descriptor in reverse (server-circuit.codec.spec round-trips).
  describe('legacyV0Slots descriptors', () => {
    const expected: Record<number, LegacyV0Slots> = {
      [BuiltInComponentType.NOT]: { r: 'direction' },
      [BuiltInComponentType.AND]: { r: 'direction', i: 'numInputs' },
      [BuiltInComponentType.TEXT]: {
        r: 'direction',
        n: ['fontSize'],
        s: 'text'
      },
      [BuiltInComponentType.ROM]: {
        r: 'direction',
        n: ['wordSize', 'addressSize']
      },
      [BuiltInComponentType.INPUT]: {
        r: 'direction',
        s: 'label',
        n: ['index']
      },
      [BuiltInComponentType.OUTPUT]: {
        r: 'direction',
        s: 'label',
        n: ['index']
      }
    };

    for (const [type, slots] of Object.entries(expected)) {
      it(`pins the descriptor for built-in type ${type}`, () => {
        expect(
          ctx.componentProvider.getComponent(Number(type))?.legacyV0Slots
        ).toEqual(slots);
      });
    }
  });
});
