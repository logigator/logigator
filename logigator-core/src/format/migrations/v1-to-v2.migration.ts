import { Migration, MigrationContext } from './migration';
import { CircuitFileV1, CircuitFileV2 } from '../circuit-file.types';
import { InvalidFileError } from '../circuit-file.errors';
import {
  PersistedComponentV1,
  PersistedSnapshotDefinitionV1,
  PersistedSnapshotDefinitionV2
} from '../../model/persisted-circuit.types';
import { decodeComponentPositions } from '../../codecs/position-delta.codec';
import { encodeComponentBlocks } from '../../codecs/component-block.codec';

/**
 * Converts v1 (one object per component, positions a running delta chain over
 * a (type, y, x) sort) into v2 (one column block per type, positions delta
 * columns reset per block over a (type, direction, y, x) sort).
 *
 * Not a re-grouping of the stored numbers: v1's chain is prefix-summed back to
 * absolute positions, the components re-sorted, and the deltas recomputed.
 * Option columns are completed from the catalog — a component that omitted a
 * key gets the schema default, which is what the catalog step used to do on
 * every read — while `wires`, the definition metadata and `attribution` are
 * carried over untouched, v2 changing none of them.
 *
 * It also owns the frozen v1 shape checks that reach the decoders. Until this
 * version existed the structural validator ran over v1 documents; now it
 * describes v2, so a v1 document's own structure is checked here, before its
 * numbers feed a prefix sum.
 */
export const v1ToV2Migration: Migration<CircuitFileV1, CircuitFileV2> = {
  from: 1,
  to: 2,
  migrate(input, ctx: MigrationContext): CircuitFileV2 {
    if (!isRecord(input)) {
      throw new InvalidFileError('File is not an object');
    }

    const components = decodeComponentPositions(
      readComponents(input.components, 'components')
    );

    return {
      version: 2,
      name: input.name,
      components: encodeComponentBlocks(components, ctx.catalog).blocks,
      wires: input.wires,
      definitions: readDefinitions(input).map((definition, index) =>
        migrateDefinition(definition, `definitions[${index}]`, ctx)
      ),
      ...(input.attribution ? { attribution: input.attribution } : {})
    };
  }
};

/**
 * A definition carries components the same way the body does, so it gets the
 * same treatment. Everything else — including the wire chain — is spread over
 * unchanged.
 */
function migrateDefinition(
  definition: PersistedSnapshotDefinitionV1,
  path: string,
  ctx: MigrationContext
): PersistedSnapshotDefinitionV2 {
  const components = decodeComponentPositions(
    readComponents(definition.components, `${path}.components`)
  );
  return {
    ...definition,
    components: encodeComponentBlocks(components, ctx.catalog).blocks
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(path: string, expected: string): never {
  throw new InvalidFileError(`File "${path}" must be ${expected}`);
}

function isNumberPair(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  );
}

/**
 * The v1 component list, checked down to what the delta codec and the block
 * encoder read. An absent list decodes as empty, as it always did.
 */
function readComponents(value: unknown, path: string): PersistedComponentV1[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail(path, 'an array');
  value.forEach((component, index) => {
    const where = `${path}[${index}]`;
    if (!isRecord(component)) fail(where, 'an object');
    if (typeof component['type'] !== 'number')
      fail(`${where}.type`, 'a number');
    if (!isNumberPair(component['pos'])) {
      fail(`${where}.pos`, 'a number pair');
    }
    if (!isRecord(component['options'])) fail(`${where}.options`, 'an object');
  });
  return value as PersistedComponentV1[];
}

/**
 * Only enough of a definition to reach its components: everything else rides
 * through the spread and is checked by the v2 structural validator afterwards.
 */
function readDefinitions(
  input: Record<string, unknown>
): PersistedSnapshotDefinitionV1[] {
  const definitions = input['definitions'];
  if (definitions === undefined) return [];
  if (!Array.isArray(definitions)) fail('definitions', 'an array');
  definitions.forEach((definition, index) => {
    if (!isRecord(definition)) fail(`definitions[${index}]`, 'an object');
  });
  return definitions as PersistedSnapshotDefinitionV1[];
}
