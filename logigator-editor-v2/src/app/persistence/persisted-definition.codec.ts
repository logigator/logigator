import { SnapshotDefinition } from './serialized-circuit';
import { PersistedSnapshotDefinitionV1 } from './persisted-circuit.types';
import { decodeWireChain, encodeWireChain } from './wire-chain.codec';
import {
  decodeComponentPositions,
  encodeComponentPositions
} from './position-delta.codec';

/**
 * Converts embedded snapshot definitions between the in-memory form (absolute
 * component positions, object wires) and the persisted form (delta-encoded
 * component positions, chain-encoded wires). A definition's internal element
 * order carries no meaning, so the encoders' reordering needs no order
 * bookkeeping here — unlike the document body (see `ProjectDump`).
 */

/** Converts an in-memory definition to its persisted form. */
export function toPersistedDefinition(
  def: SnapshotDefinition
): PersistedSnapshotDefinitionV1 {
  return {
    ...def,
    components: encodeComponentPositions(def.components).components,
    wires: encodeWireChain(def.wires).text
  };
}

/** Revives a persisted definition into the in-memory form. */
export function fromPersistedDefinition(
  def: PersistedSnapshotDefinitionV1
): SnapshotDefinition {
  return {
    ...def,
    components: decodeComponentPositions(def.components),
    wires: decodeWireChain(def.wires)
  };
}
