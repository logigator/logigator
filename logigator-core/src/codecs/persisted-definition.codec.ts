import { SnapshotDefinition } from '../model/serialized-circuit';
import {
  PersistedSnapshotDefinitionV1,
  PersistedSnapshotDefinitionV2
} from '../model/persisted-circuit.types';
import { decodeWireChain, encodeWireChain } from './wire-chain.codec';
import { encodeComponentPositions } from './position-delta.codec';
import {
  ComponentCatalogLookup,
  decodeComponentBlocks,
  encodeComponentBlocks
} from './component-block.codec';

/**
 * Converts embedded snapshot definitions between the in-memory form (absolute
 * positions, object wires) and the persisted form (components in the version's
 * compact encoding, chain-encoded wires). A definition's internal element order
 * carries no meaning, so the encoders' reordering needs no bookkeeping here.
 *
 * The unsuffixed pair is the current version's and is re-pointed on a bump, the
 * way `CurrentCircuitFile` is; `toPersistedDefinitionV1` stays because the
 * v0 → v1 migration writes that frozen shape. A v1 definition is read by the
 * v1 → v2 migration, which re-encodes only the components and carries the wire
 * chain over untouched.
 */

/** Converts an in-memory definition to its current-version persisted form. */
export function toPersistedDefinition(
  def: SnapshotDefinition,
  catalog?: ComponentCatalogLookup
): PersistedSnapshotDefinitionV2 {
  return {
    ...def,
    components: encodeComponentBlocks(def.components, catalog).blocks,
    wires: encodeWireChain(def.wires).text
  };
}

/** Revives a current-version persisted definition into the in-memory form. */
export function fromPersistedDefinition(
  def: PersistedSnapshotDefinitionV2
): SnapshotDefinition {
  return {
    ...def,
    components: decodeComponentBlocks(def.components),
    wires: decodeWireChain(def.wires)
  };
}

/** Converts an in-memory definition to the frozen v1 persisted form. */
export function toPersistedDefinitionV1(
  def: SnapshotDefinition
): PersistedSnapshotDefinitionV1 {
  return {
    ...def,
    components: encodeComponentPositions(def.components).components,
    wires: encodeWireChain(def.wires).text
  };
}
