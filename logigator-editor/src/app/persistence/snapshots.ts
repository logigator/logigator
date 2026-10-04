import type { Project } from '../project/project';
import { Component } from '../components/component';
import type { Wire } from '../wires/wire';
import type { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import {
  CUSTOM_TYPE_ID_BASE,
  SerializedCircuitBody,
  SerializedComponentBody,
  SerializedWireBody,
  SnapshotDefinition
} from '@logigator/core';

/**
 * The snapshot codec shared by every transport. It owns which custom
 * definitions a document embeds, their provenance and the session ↔ file-local
 * type-id remap, but no byte layout. Ingesting the definitions back is
 * `CustomComponentRegistry.ingestSnapshots`, since that mutates the registry.
 */

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

export function serializeWireBody(wire: Wire): SerializedWireBody {
  return {
    pos: [Math.floor(wire.position.x), Math.floor(wire.position.y)],
    direction: wire.direction,
    length: wire.length
  };
}

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
   * `sessionType → fileLocalType` for every embedded custom, applied to the
   * document body by the caller. The inverse of the map
   * {@link CustomComponentRegistry.ingestSnapshots} returns.
   */
  sessionToLocal: ReadonlyMap<number, number>;
}

/**
 * Emits one {@link SnapshotDefinition} per custom a project transitively
 * places, plus the `sessionType → fileLocalType` map for the document body.
 *
 * Output is deterministic and session-order-independent: definitions are
 * numbered from {@link CUSTOM_TYPE_ID_BASE} in first-encounter order, and every
 * nested type reference is rewritten to those file-local ids. Built-in types
 * pass through.
 */
export function collectSnapshots(
  project: Project,
  registry: CustomComponentRegistry
): CollectedSnapshots {
  // Doubles as the visited set.
  const sessionToLocal = new Map<number, number>();
  const ordered: number[] = [];
  let nextLocal = CUSTOM_TYPE_ID_BASE;

  const visit = (sessionType: number): void => {
    if (sessionToLocal.has(sessionType)) return;
    const def = registry.getDefinition(sessionType);
    if (!def) return; // built-in or unknown — not embedded
    sessionToLocal.set(sessionType, nextLocal++);
    ordered.push(sessionType);
    // Nested customs are embedded even when never placed in the body.
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
      // The provenance id goes through the promotion alias map: a snapshot
      // frozen before its master's upload holds the browser id, and the alias
      // table is device-local, so a document must carry the current id. The
      // frozen version stays as it is — it says which state froze, not where
      // the master lives — defaulting to 1, since an id with no version emits
      // no usable provenance and the instance re-orphans on reload. `origin`
      // is resolved live, so a promoted master reads 'server', and falls back
      // to the frozen kind once the master is gone.
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
