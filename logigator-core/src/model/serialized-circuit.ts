/**
 * The native, named-option serialized circuit body shared by every transport
 * and held in memory as a definition's own circuit.
 *
 * Pure data and pure helpers with no imports, so the component layer and the
 * persistence layer can both reference it without an import cycle.
 */

/** One placed component: its type id, grid position, and named option values. */
export interface SerializedComponentBody {
  /** Session type id in an in-memory circuit; file-local in a persisted
   * {@link SnapshotDefinition}. */
  type: number;
  pos: [number, number];
  /** Quarter-turns clockwise from East, 0–3. Omitted when East. */
  direction?: number;
  options: Record<string, unknown>;
  /** Negated input-port indices, sorted within the group; omitted if empty. */
  negInputs?: number[];
  /** Negated output-port indices, sorted within the group; omitted if empty. */
  negOutputs?: number[];
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
 * use file-local type ids, remapped to session ids on load.
 */
export interface SnapshotDefinition extends SerializedCircuitBody {
  /** File-/document-local type id; remapped to a session type id on load. */
  type: number;
  /**
   * Best-effort provenance back to the library master, absent for a
   * never-saved-to-library local. `origin` names that library and drives orphan
   * recovery: a lost cloud master while signed out is likely just unloaded, a
   * lost local one can be restored. Unknown on older documents.
   */
  source?: { id: string; version: number; origin?: 'server' | 'browser' };
  name: string;
  symbol: string;
  description: string;
  numInputs: number;
  numOutputs: number;
  labels: string[];
}

/** Deep-copies a component body: position, options and negation by value. */
export function cloneComponentBody(
  component: SerializedComponentBody
): SerializedComponentBody {
  return {
    type: component.type,
    pos: [component.pos[0], component.pos[1]],
    ...(component.direction ? { direction: component.direction } : {}),
    options: { ...component.options },
    ...(component.negInputs ? { negInputs: [...component.negInputs] } : {}),
    ...(component.negOutputs ? { negOutputs: [...component.negOutputs] } : {})
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
 * Copies `components` with each `type` translated through `map` (file-local ↔
 * session). Types absent from the map pass through, preserving built-in ids.
 */
export function remapComponentTypes(
  components: SerializedComponentBody[],
  map: ReadonlyMap<number, number>
): SerializedComponentBody[] {
  return components.map((c) => ({
    type: map.get(c.type) ?? c.type,
    pos: [c.pos[0], c.pos[1]],
    ...(c.direction ? { direction: c.direction } : {}),
    options: { ...c.options },
    ...(c.negInputs ? { negInputs: [...c.negInputs] } : {}),
    ...(c.negOutputs ? { negOutputs: [...c.negOutputs] } : {})
  }));
}
