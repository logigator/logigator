import type { Project } from '../project/project';
import { Component } from '../components/component';
import type { Wire } from '../wires/wire';
import type { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import { CUSTOM_TYPE_ID_BASE } from '../components/component-type.enum';
import {
  SerializedCircuitBody,
  SerializedComponentBody,
  SerializedWireBody,
  SnapshotDefinition
} from './serialized-circuit';

/**
 * The universal snapshot codec, shared by every transport (local file, browser
 * store, and — folded into the legacy positional body — the server). It owns
 * *which* custom definitions a document embeds, their provenance, and the
 * session ↔ file-local type-id remap; it does **not** own a byte layout (each
 * target encodes the body its own way).
 *
 * - {@link serializeProjectBody} / {@link serializeComponentBody} /
 *   {@link serializeWireBody} turn live editor instances into the native body.
 * - {@link collectSnapshots} walks the customs a project transitively places and
 *   emits a deterministic, self-contained `SnapshotDefinition[]`.
 * - Ingesting them (registering snapshots + remapping) is
 *   `CustomComponentRegistry.ingestSnapshots`, since it mutates the registry.
 */

/** Serializes one component to the native body (type, grid position, options). */
export function serializeComponentBody(
  component: Component
): SerializedComponentBody {
  return {
    type: component.config.type,
    pos: [component.position.x, component.position.y],
    ...(component.direction ? { direction: component.direction } : {}),
    options: Object.fromEntries(
      Object.entries(component.options).map(([key, opt]) => [key, opt.value])
    ),
    ...Component.serializeNegations(component)
  };
}

/** Serializes one wire to the native body (start position, direction, length). */
export function serializeWireBody(wire: Wire): SerializedWireBody {
  return {
    pos: [Math.floor(wire.position.x), Math.floor(wire.position.y)],
    direction: wire.direction,
    length: wire.length
  };
}

/** Serializes a project's components and wires to the native body. */
export function serializeProjectBody(project: Project): SerializedCircuitBody {
  const components: SerializedComponentBody[] = [];
  for (const component of project.components) {
    components.push(serializeComponentBody(component));
  }
  const wires: SerializedWireBody[] = [];
  for (const wire of project.wires) {
    wires.push(serializeWireBody(wire));
  }
  return { components, wires };
}

export interface CollectedSnapshots {
  definitions: SnapshotDefinition[];
  /**
   * `sessionType → fileLocalType` for every embedded custom, including those
   * placed directly in the document body. The caller applies it to the document
   * body (`remapComponentTypes`); it is the inverse of the map
   * {@link CustomComponentRegistry.ingestSnapshots} returns.
   */
  sessionToLocal: ReadonlyMap<number, number>;
}

/**
 * Walks every custom component a project transitively places — the snapshots in
 * its body, then recursively the snapshots inside those snapshots' circuits —
 * and emits one {@link SnapshotDefinition} per distinct definition, plus the
 * `sessionType → fileLocalType` map for the document body.
 *
 * Output is deterministic and session-order-independent: definitions are
 * file-local-numbered in first-encounter (depth-first, body order) order from
 * {@link CUSTOM_TYPE_ID_BASE}, and every nested type reference inside a
 * definition's own body is rewritten to those file-local ids. Built-in types
 * (below the custom range) pass through.
 */
export function collectSnapshots(
  project: Project,
  registry: CustomComponentRegistry
): CollectedSnapshots {
  // session type id -> file-local id, also the visited set.
  const sessionToLocal = new Map<number, number>();
  // Collected session type ids in first-encounter order.
  const ordered: number[] = [];
  let nextLocal = CUSTOM_TYPE_ID_BASE;

  const visit = (sessionType: number): void => {
    if (sessionToLocal.has(sessionType)) return;
    const def = registry.getDefinition(sessionType);
    if (!def) return; // built-in or unknown — not embedded
    sessionToLocal.set(sessionType, nextLocal++);
    ordered.push(sessionType);
    // Recurse into the definition's circuit so nested customs are embedded
    // even when never placed directly in the document body.
    for (const c of def.circuit?.components ?? []) {
      visit(c.type);
    }
  };

  for (const component of project.components) {
    visit(component.config.type);
  }

  const definitions = ordered.map((sessionType): SnapshotDefinition => {
    const def = registry.getDefinition(sessionType)!;
    const circuit = def.circuit ?? { components: [], wires: [] };
    return {
      type: sessionToLocal.get(sessionType)!,
      // Provenance id resolved through the promotion alias map: a snapshot
      // frozen before its master's upload-to-cloud captured the browser id, but
      // the written document must reference the master's *current* (server) id —
      // the alias table is device-local, so a stale id would be stranded
      // everywhere else. The frozen version is kept as-is (it identifies which
      // state the snapshot froze, not where the master lives), defaulting to 1
      // when absent: an id with no version must still emit provenance, else the
      // server codec sends an empty mapping id and the instance re-orphans on
      // reload. `origin` records which library the master *currently* lives in
      // (so a later orphan recovers correctly) — resolved live so a promoted
      // master reads 'server', falling back to the snapshot's own frozen kind
      // when the master is already gone.
      source:
        def.id !== undefined
          ? {
              id: registry.currentIdForId(def.id),
              version: def.version ?? 1,
              origin:
                registry.resolveMaster(sessionType)?.master.source ?? def.source
            }
          : undefined,
      name: def.name,
      symbol: def.symbol,
      description: def.description,
      numInputs: def.numInputs,
      numOutputs: def.numOutputs,
      labels: [...def.labels],
      components: circuit.components.map((c) => ({
        type: sessionToLocal.get(c.type) ?? c.type,
        pos: [c.pos[0], c.pos[1]],
        ...(c.direction ? { direction: c.direction } : {}),
        options: { ...c.options },
        ...(c.negInputs ? { negInputs: [...c.negInputs] } : {}),
        ...(c.negOutputs ? { negOutputs: [...c.negOutputs] } : {})
      })),
      wires: circuit.wires.map((w) => ({
        pos: [w.pos[0], w.pos[1]],
        direction: w.direction,
        length: w.length
      }))
    };
  });

  return { definitions, sessionToLocal };
}
