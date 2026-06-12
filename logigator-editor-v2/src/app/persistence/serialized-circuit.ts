/**
 * The native, named-option serialized circuit body shared by every snapshot
 * transport (local file, browser store) and held in memory as a definition's
 * own circuit. Distinct from the legacy positional `ProjectElement[]` wire
 * format (server) — see `server/server-circuit.codec.ts`.
 *
 * Pure data + pure helpers, with **no** imports, so it can be referenced from
 * both the component layer (a definition's `circuit`) and the persistence layer
 * (the codec, the file format) without creating an import cycle.
 */

/** One placed component: its type id, grid position, and named option values. */
export interface SerializedComponentBody {
  /** Component type id. In a definition's in-memory circuit this is a session
   * type id; in an on-disk {@link SnapshotDefinition} it is a file-local id. */
  type: number;
  pos: [number, number];
  options: Record<string, unknown>;
}

/** One wire: start position, direction (0 = horizontal, 1 = vertical), length. */
export interface SerializedWireBody {
  pos: [number, number];
  direction: number;
  length: number;
}

/** A circuit's components and wires in the native body encoding. */
export interface SerializedCircuitBody {
  components: SerializedComponentBody[];
  wires: SerializedWireBody[];
}

/**
 * A frozen custom-component snapshot embedded in a document. Its `components`
 * use **file-local** type ids (stable within the document; remapped to session
 * type ids on load). `source` is best-effort provenance back to the library
 * master, absent for a never-saved-to-library local.
 */
export interface SnapshotDefinition extends SerializedCircuitBody {
  /** File-/document-local type id; remapped to a session type id on load. */
  type: number;
  source?: { id: string; version: number };
  name: string;
  symbol: string;
  description: string;
  numInputs: number;
  numOutputs: number;
  labels: string[];
}

/** Deep-copies a component body (positions and option values copied by value). */
export function cloneComponentBody(
  component: SerializedComponentBody
): SerializedComponentBody {
  return {
    type: component.type,
    pos: [component.pos[0], component.pos[1]],
    options: { ...component.options }
  };
}

/** Deep-copies a circuit body so frozen snapshots never share mutable state. */
export function cloneCircuit(
  circuit: SerializedCircuitBody
): SerializedCircuitBody {
  return {
    components: circuit.components.map(cloneComponentBody),
    wires: circuit.wires.map((w) => ({
      pos: [w.pos[0], w.pos[1]],
      direction: w.direction,
      length: w.length
    }))
  };
}

/**
 * Returns a copy of `components` with each `type` translated through `map`
 * (file-local ↔ session). Types absent from the map pass through unchanged, so
 * built-in ids (below the custom range) are preserved.
 */
export function remapComponentTypes(
  components: SerializedComponentBody[],
  map: ReadonlyMap<number, number>
): SerializedComponentBody[] {
  return components.map((c) => ({
    type: map.get(c.type) ?? c.type,
    pos: [c.pos[0], c.pos[1]],
    options: { ...c.options }
  }));
}
