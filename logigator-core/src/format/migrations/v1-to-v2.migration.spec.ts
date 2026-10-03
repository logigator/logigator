import { describe, expect, it } from 'vitest';
import { v1ToV2Migration } from './v1-to-v2.migration';
import { v0ToV1Migration } from './v0-to-v1.migration';
import { MigrationContext } from './migration';
import { builtInMeta } from '../../catalog/built-in-meta';
import { BuiltInComponentType } from '../../model/component-type.enum';
import { Direction } from '../../model/direction';
import { CircuitFileV0, CircuitFileV1 } from '../circuit-file.types';
import { InvalidFileError } from '../circuit-file.errors';
import { SerializedComponentBody } from '../../model/serialized-circuit';
import {
  decodeComponentPositions,
  encodeComponentPositions
} from '../../codecs/position-delta.codec';
import { decodeComponentBlocks } from '../../codecs/component-block.codec';

import romV1 from '../fixtures/rom.v1.json';
import nestedCustomV1 from '../fixtures/nested-custom.v1.json';
import halfAdderV0 from '../fixtures/half-adder.v0.json';

const ctx: MigrationContext = {
  catalog: builtInMeta,
  log: { info: () => undefined, warn: () => undefined }
};

/** A v1 document carrying `components`, delta-chained the way v1 stores them. */
function v1Document(
  components: SerializedComponentBody[],
  extra: Partial<CircuitFileV1> = {}
): CircuitFileV1 {
  return {
    version: 1,
    name: 'Board',
    components: encodeComponentPositions(components).components,
    wires: '',
    definitions: [],
    ...extra
  };
}

/**
 * What a document says about where its components are, order-free: the two
 * encodings emit in different orders, so the comparable fact is the set.
 */
function placements(components: readonly SerializedComponentBody[]): string[] {
  return components
    .map((c) => JSON.stringify([c.type, c.pos[0], c.pos[1], c.direction ?? 0]))
    .sort();
}

const migrate = (file: CircuitFileV1) => v1ToV2Migration.migrate(file, ctx);

describe('v1ToV2Migration', () => {
  /**
   * The whole point of the migration: v1's running chain is prefix-summed back
   * to absolute positions before anything is re-sorted, so a re-grouping of the
   * stored numbers would land every component somewhere else. Negative
   * coordinates and two components sharing a cell are both real — `cpu.json`
   * starts at x = −13 and `rendering_bench.json` has 136 such pairs.
   */
  it('lands on the same absolute positions, through negatives and shared cells', () => {
    const board: SerializedComponentBody[] = [
      { type: BuiltInComponentType.AND, pos: [-13, -7], options: {} },
      { type: BuiltInComponentType.LED, pos: [-13, -7], options: {} },
      { type: BuiltInComponentType.AND, pos: [-13, -7], options: {} },
      {
        type: BuiltInComponentType.AND,
        pos: [40, -80],
        direction: Direction.W,
        options: {}
      },
      { type: 1000, pos: [0, 0], options: {} }
    ];

    const decoded = decodeComponentBlocks(
      migrate(v1Document(board)).components
    );

    expect(placements(decoded)).toEqual(placements(board));
  });

  it('keeps a real v1 export placing exactly what it placed', () => {
    const before = decodeComponentPositions(
      romV1.components as SerializedComponentBody[]
    );
    const after = decodeComponentBlocks(
      migrate(romV1 as unknown as CircuitFileV1).components
    );
    expect(placements(after)).toEqual(placements(before));
  });

  it('gives a definition the same treatment and carries its wire chain over', () => {
    const migrated = migrate(nestedCustomV1 as unknown as CircuitFileV1);

    migrated.definitions.forEach((definition, index) => {
      const source = nestedCustomV1.definitions[index];
      expect(placements(decodeComponentBlocks(definition.components))).toEqual(
        placements(
          decodeComponentPositions(
            source.components as SerializedComponentBody[]
          )
        )
      );
      // v2 changes components and nothing else.
      expect(definition.wires).toBe(source.wires);
      expect(definition.name).toBe(source.name);
    });
    expect(migrated.wires).toBe(nestedCustomV1.wires);
  });

  // Not a jump to newest: a legacy document reaches v2 through v1, and what it
  // placed survives both steps.
  it('composes with the v0 migration over the whole chain', () => {
    const v1 = v0ToV1Migration.migrate(
      halfAdderV0 as unknown as CircuitFileV0,
      ctx
    );
    const v2 = v1ToV2Migration.migrate(v1, ctx);

    expect(v2.version).toBe(2);
    expect(placements(decodeComponentBlocks(v2.components))).toEqual(
      placements(decodeComponentPositions(v1.components))
    );
    expect(v2.definitions).toHaveLength(v1.definitions.length);
  });

  it('fills an option the v1 component omitted with the schema default', () => {
    const migrated = migrate(
      v1Document([
        {
          type: BuiltInComponentType.ROM,
          pos: [0, 0],
          options: { wordSize: 8 }
        }
      ])
    );

    expect(migrated.components[0].opt).toEqual({
      wordSize: [8],
      addressSize: [4],
      data: ['']
    });
  });

  it('emits no option columns for a type the catalog does not know', () => {
    const migrated = migrate(
      v1Document([{ type: 1000, pos: [2, 2], options: {} }])
    );
    expect(migrated.components[0].opt).toBe(undefined);
  });

  it('omits dir when every component of a block faces East', () => {
    const migrated = migrate(
      v1Document([
        { type: BuiltInComponentType.AND, pos: [0, 0], options: {} },
        { type: BuiltInComponentType.AND, pos: [0, 1], options: {} }
      ])
    );
    expect(migrated.components[0].dir).toBe(undefined);
  });

  it('carries negations over, the first component reading as a delta of one', () => {
    const migrated = migrate(
      v1Document([
        {
          type: BuiltInComponentType.AND,
          pos: [0, 0],
          options: {},
          negInputs: [0, 2]
        },
        { type: BuiltInComponentType.AND, pos: [0, 1], options: {} }
      ])
    );

    expect(migrated.components[0].negIn).toEqual([[1], [[0, 2]]]);
    expect(migrated.components[0].negOut).toBe(undefined);
    expect(decodeComponentBlocks(migrated.components)[0].negInputs).toEqual([
      0, 2
    ]);
  });

  it('carries the envelope over', () => {
    const attribution = [{ projectId: 'p', projectName: 'n', authorName: 'a' }];
    const migrated = migrate(
      v1Document([], { name: 'Kept', wires: '0,0:e3', attribution })
    );

    expect(migrated.name).toBe('Kept');
    expect(migrated.wires).toBe('0,0:e3');
    expect(migrated.attribution).toEqual(attribution);
  });

  /**
   * Until v2 existed the structural validator ran over v1 documents; it now
   * describes v2, so the frozen v1 shape is checked here — before its numbers
   * feed a prefix sum that would read past a broken one.
   */
  it.each([
    ['components not an array', { components: 'junk' }],
    ['a component that is not an object', { components: ['junk'] }],
    [
      'a component pos that is not a number pair',
      { components: [{ type: 1, pos: [0], options: {} }] }
    ],
    ['a component without options', { components: [{ type: 1, pos: [0, 0] }] }],
    ['definitions not an array', { definitions: 'junk' }],
    ['a definition that is not an object', { definitions: ['junk'] }],
    [
      'a definition component without options',
      { definitions: [{ components: [{ type: 1, pos: [0, 0] }] }] }
    ]
  ])('rejects a v1 document with %s', (_desc, broken) => {
    expect(() =>
      migrate({ ...v1Document([]), ...broken } as unknown as CircuitFileV1)
    ).toThrowError(InvalidFileError);
  });
});
