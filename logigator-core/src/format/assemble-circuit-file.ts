import { CURRENT_FILE_VERSION } from './circuit-file-version';
import {
  CurrentCircuitFile,
  FileForkAttributionV1
} from './circuit-file.types';
import {
  SerializedCircuitBody,
  SnapshotDefinition
} from '../model/serialized-circuit';
import { encodeComponentPositions } from '../codecs/position-delta.codec';
import { encodeWireChain } from '../codecs/wire-chain.codec';
import { toPersistedDefinition } from '../codecs/persisted-definition.codec';

/** A document plus the order its encoders emitted the body's elements in. */
export interface AssembledCircuitFile {
  file: CurrentCircuitFile;
  /**
   * `wireOrder[k]` / `componentOrder[k]` is the index, in the input body's
   * arrays, of the element emitted k-th. Both encoders reorder — the chain walk
   * for wires, the position-delta sort for components — so the document's
   * element order is the emission order, and a consumer aligning per-element
   * data with the document (the editor's project dump maps element ids) has to
   * map through these rather than iterate its own source.
   */
  wireOrder: number[];
  componentOrder: number[];
}

/**
 * Encodes a circuit body and its embedded definitions into a current-version
 * document. The write half of the format, and the counterpart to
 * `migrateToCurrent` + the decoders on the read side.
 *
 * Pure data → data, so both sides share it: the editor calls it after
 * snapshotting its live `Project` into a body (and remapping session type ids
 * to file-local ones), and the server's bulk re-normalization job calls it to
 * write a migrated document back.
 */
export function assembleCircuitFile(
  body: SerializedCircuitBody,
  definitions: readonly SnapshotDefinition[],
  name: string,
  attribution?: readonly FileForkAttributionV1[]
): AssembledCircuitFile {
  const wires = encodeWireChain(body.wires);
  const components = encodeComponentPositions(body.components);

  return {
    file: {
      version: CURRENT_FILE_VERSION,
      name,
      components: components.components,
      wires: wires.text,
      definitions: definitions.map(toPersistedDefinition),
      // Fork lineage rides along only when the document has one — an empty
      // field would suggest a checked-and-absent lineage rather than none.
      ...(attribution?.length ? { attribution: [...attribution] } : {})
    },
    wireOrder: wires.order,
    componentOrder: components.order
  };
}
