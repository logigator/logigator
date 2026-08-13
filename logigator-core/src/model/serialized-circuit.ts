/**
 * The native, named-option serialized circuit body shared by every snapshot
 * transport (local file, browser store) and held in memory as a definition's
 * own circuit. Distinct from the legacy positional `ProjectElement` wire format
 * the old server API speaks.
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
  /** Facing direction (quarter-turns clockwise from East, 0–3). Omitted when East. */
  direction?: number;
  options: Record<string, unknown>;
  /** Negated input-port indices (sorted, within-group). Omitted when empty. */
  negInputs?: number[];
  /** Negated output-port indices (sorted, within-group). Omitted when empty. */
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
 * use **file-local** type ids (stable within the document; remapped to session
 * type ids on load). `source` is best-effort provenance back to the library
 * master, absent for a never-saved-to-library local.
 */
export interface SnapshotDefinition extends SerializedCircuitBody {
  /** File-/document-local type id; remapped to a session type id on load. */
  type: number;
  /**
   * Provenance back to the library master. `origin` records which library that
   * master lived in — `'server'` for a cloud dependency (a server mapping id),
   * `'browser'` for a local dependency in a native/browser document;
   * absent/`undefined` when unknown (older documents). In a document the viewer
   * owns it drives the orphan recovery affordance: a lost cloud master while
   * signed out is likely just unloaded (offer sign-in), a lost local master can
   * be restored to the browser library. In a borrowed share the origin is moot —
   * the master is the publisher's, and the orphan is offered a read-only view.
   */
  source?: { id: string; version: number; origin?: 'server' | 'browser' };
  name: string;
  symbol: string;
  description: string;
  numInputs: number;
  numOutputs: number;
  labels: string[];
}

/** Deep-copies a component body (positions, option values, and negation copied by value). */
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
    ...(c.direction ? { direction: c.direction } : {}),
    options: { ...c.options },
    ...(c.negInputs ? { negInputs: [...c.negInputs] } : {}),
    ...(c.negOutputs ? { negOutputs: [...c.negOutputs] } : {})
  }));
}
