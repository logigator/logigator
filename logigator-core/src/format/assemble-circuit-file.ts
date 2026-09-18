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
   * arrays, of the element emitted k-th. Both encoders reorder, so aligning
   * per-element data with the document means mapping through these rather than
   * iterating the source arrays.
   */
  wireOrder: number[];
  componentOrder: number[];
}

/**
 * Encodes a circuit body and its embedded definitions into a current-version
 * document: the write half of the format. Pure data → data, so every writer
 * shares it.
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
      // Only present when there is a lineage; an empty field would read as a
      // checked-and-absent one.
      ...(attribution?.length ? { attribution: [...attribution] } : {})
    },
    wireOrder: wires.order,
    componentOrder: components.order
  };
}
