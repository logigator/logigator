/**
 * @deprecated TEMPORARY — delete when the native-model API ships.
 *
 * The server API is legacy: it transports the positional `ProjectElement[]`
 * format, which is conceptually **file-format version 0 over HTTP**. This module
 * is the throwaway half of handling it — the **encoder** that packs a live
 * `Project` back into the v0 wire shape ({@link ServerCircuitV0}) for PUT/save,
 * plus the {@link toCircuitFileV0} read adapter that wraps a server response as a
 * {@link CircuitFileV0} so reads route through the permanent `v0ToV1` migration.
 *
 * Decode is NOT here — it lives in the permanent migration chain. When the
 * native-model API replaces this transport, this entire folder is deleted; the
 * `v0ToV1` migration and the file format stay.
 *
 * Encode reads each config's {@link ComponentConfig.legacyV0Slots} descriptor in
 * reverse (the same descriptor the `v0ToV1` migration uses to decode); the
 * `i`/`o`/`r` slots come straight from the component's first-class
 * `numInputs`/`numOutputs`/`direction` fields, so fixed-arity types still emit
 * them without a descriptor entry.
 *
 * Custom components are folded in via the universal snapshot codec
 * (`persistence/snapshots.ts`): every custom the project transitively places
 * becomes a `dependencies[]` entry carrying the legacy `{ id, model }` (for
 * old-client compat) **plus** the additive frozen `snapshot` (the embedded
 * circuit, named per R14). The document body and the snapshot bodies all use
 * file-local type ids (≥ {@link CUSTOM_TYPE_ID_BASE}) so the decode's
 * `ingestSnapshots` can remap them to session ids in one pass.
 */
import type { ProjectElement } from '../../api/models/project-element';
import type { DependencyMapping } from '../../api/models/dependencies';
import type { ComponentConfig } from '../../components/component-config.model';
import type { Project } from '../../project/project';
import { Component } from '../../components/component';
import type { Wire } from '../../wires/wire';
import type { ComponentProviderService } from '../../components/component-provider.service';
import type { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import type {
  SerializedComponentBody,
  SerializedWireBody,
  SnapshotDefinition
} from '../serialized-circuit';
import { WireDirection } from '../../wires/wire-direction.enum';
import {
  BuiltInComponentType,
  CUSTOM_TYPE_ID_BASE
} from '../../components/component-type.enum';
import {
  legacyBodyHeight,
  legacyBodyWidth,
  legacyCustomBodySize,
  pivotToLegacyAnchor
} from '../legacy-anchor';
import { ledMatrixShape } from '../../components/component-types/led-matrix/led-matrix.config';
import { PersistedCircuitV0 } from '../persisted-circuit.types';
import { CircuitFileV0 } from '../file/circuit-file.types';
import { collectSnapshots } from '../snapshots';

/** Old editor's ElementTypeId.WIRE — the canonical type ID for wires in ProjectElement[]. */
export const WIRE_TYPE_ID = 0;

/** The old API transport: a v0 circuit plus its dependency mappings. */
export interface ServerCircuitV0 extends PersistedCircuitV0 {
  elements: ProjectElement[];
  dependencies: DependencyMapping[];
}

/**
 * Wraps a server response as a {@link CircuitFileV0} envelope. The `dependencies`
 * (carrying the additive embedded snapshots) are threaded through so the
 * `v0ToV1` migration can revive them into `definitions[]`.
 */
export function toCircuitFileV0(detail: {
  name: string;
  elements: ProjectElement[];
  dependencies?: CircuitFileV0['dependencies'];
}): CircuitFileV0 {
  return {
    project: { name: detail.name, elements: detail.elements },
    dependencies: detail.dependencies
  };
}

/**
 * Encodes a live project into the v0 server transport shape, embedding a frozen
 * snapshot of every custom it transitively places. The body's custom `t`s and
 * each `dependencies[].model` use the file-local ids from
 * {@link collectSnapshots}, so they match the embedded snapshots' `type`s.
 */
export function serializeProject(
  project: Project,
  registry: CustomComponentRegistry,
  provider: ComponentProviderService
): ServerCircuitV0 {
  const { definitions, sessionToLocal } = collectSnapshots(project, registry);

  const tunnelIds = legacyTunnelIds(
    [...project.components]
      .filter((c) => c.config.type === BuiltInComponentType.TUNNEL)
      .map((c) => c.options['label'].value as string)
  );

  const elements: ProjectElement[] = [];
  for (const component of project.components) {
    const el = serializeComponent(component, tunnelIds);
    const local = sessionToLocal.get(el.t);
    if (local !== undefined) el.t = local; // custom: session id -> file-local id
    elements.push(el);
  }
  for (const wire of project.wires) {
    elements.push(serializeWire(wire));
  }

  // A nested custom inside a definition body carries no port counts of its own
  // (Invariant A), so re-anchoring it needs the counts from its own definition,
  // keyed by the file-local type id it references.
  const customDims = new Map(
    definitions.map((def) => [
      def.type,
      { numInputs: def.numInputs, numOutputs: def.numOutputs }
    ])
  );

  const dependencies: DependencyMapping[] = definitions.map((def) => {
    // The mapping id links to a server library component, which the backend
    // validates as one the user owns. Only a dependency that resolves to a
    // registered **server** master qualifies; anything else is sent as '' so it
    // rides along solely via the embedded snapshot (no dependency row). Under the
    // one-directional rule a cloud save has no local dependencies (they are
    // promoted first), so this normally yields a real id for every dependency;
    // the '' path is a defensive fallback that degrades to an orphan on reload
    // rather than failing the save. `def.source.id` is already the current id
    // (collectSnapshots rewrites it through the promotion alias), so a dependency
    // promoted earlier in this same upload resolves to its server master here.
    return {
      id: serverDependencyId(def.source?.id, registry),
      model: def.type, // file-local id, matches the body `t` and the snapshot
      snapshot: {
        version: def.source?.version ?? 1,
        name: def.name,
        symbol: def.symbol,
        description: def.description,
        numInputs: def.numInputs,
        numOutputs: def.numOutputs,
        labels: [...def.labels],
        elements: encodeDefinitionElements(def, provider, customDims)
      }
    };
  });

  return { elements, dependencies };
}

/**
 * The mapping id to send for a dependency: its own id when it resolves to a
 * registered **server** master (a cloud library component the user owns), or ''
 * otherwise (local/browser custom, or an id with no owned server master) so the
 * backend skips the dependency row and relies on the embedded snapshot. Mirrors
 * the backend's `getOwnedComponentOrThrow` contract — sending a browser id (or a
 * non-owned server id) is what triggers "Component for mapping not found".
 */
function serverDependencyId(
  id: string | undefined,
  registry: CustomComponentRegistry
): string {
  if (id === undefined) return '';
  const masterTypeId = registry.masterTypeIdForId(id);
  const master =
    masterTypeId !== undefined
      ? registry.getDefinition(masterTypeId)
      : undefined;
  return master?.source === 'server' ? id : '';
}

/**
 * Maps each distinct tunnel label to a legacy numeric id. Digit-only labels
 * keep their numeric value (a legacy-saved id round-trips unchanged); all
 * other labels get generated ids above the highest numeric one, in sorted
 * order for determinism. Grouping — the only tunnel semantics the positional
 * format carries — is thereby preserved for legacy clients; the label text
 * itself rides in the additive `s` slot.
 */
function legacyTunnelIds(labels: Iterable<string>): Map<string, number> {
  const ids = new Map<string, number>();
  const textual: string[] = [];
  let next = 0;
  for (const label of new Set(labels)) {
    if (/^\d+$/.test(label)) {
      const value = Number(label);
      ids.set(label, value);
      next = Math.max(next, value + 1);
    } else {
      textual.push(label);
    }
  }
  for (const label of textual.sort()) {
    ids.set(label, next++);
  }
  return ids;
}

function serializeComponent(
  component: Component,
  tunnelIds: Map<string, number>
): ProjectElement {
  // Every real config is a full ComponentConfig; the base only narrows it to
  // the view. The descriptor lives on the config, so widen back.
  const config = component.config as ComponentConfig;
  // v0 anchors by the body's top-left, not the rotation pivot; that corner *is*
  // `bodyGridBounds` for any live component — built-in or custom (the custom's
  // fixed width 3 / port-span height flow through the same generic bounds). The
  // migration reverses it via legacyAnchorToPivot on decode.
  const anchor = component.bodyGridBounds;
  const el: ProjectElement = {
    t: config.type,
    p: [anchor.x, anchor.y]
  };

  if (component.numInputs > 0) {
    el.i = component.numInputs;
  }
  if (component.numOutputs > 0) {
    el.o = component.numOutputs;
  }
  if (component.direction !== 0) {
    el.r = component.direction;
  }

  const slots = config.legacyV0Slots;
  if (slots?.n && slots.n.length > 0) {
    el.n = slots.n.map((key) => component.options[key].value as number);
  }
  if (slots?.s) {
    el.s = component.options[slots.s].value as string;
  }

  // Tunnel labels have no positional slot: legacy clients read the grouped
  // numeric id from n[0], our own decode prefers the label in `s`.
  if (config.type === BuiltInComponentType.TUNNEL) {
    const label = component.options['label'].value as string;
    el.n = [tunnelIds.get(label) ?? 0];
    el.s = label;
  }

  // The matrix's LED cells are engine-only in v2 (numOutputs is 0), but the
  // legacy format records them as outputs — old clients rebuild their
  // simulation unit from `o`.
  if (config.type === BuiltInComponentType.LED_MATRIX) {
    const { size } = ledMatrixShape(component.options['size'].value as number);
    el.o = size * size;
  }

  // Negation has no positional v0 slot — it rides as additive arrays (sorted,
  // in-range, omitted when empty), shared shape with the native body.
  Object.assign(el, Component.serializeNegations(component));

  return el;
}

function serializeWire(wire: Wire): ProjectElement {
  const gridX = Math.floor(wire.position.x);
  const gridY = Math.floor(wire.position.y);

  let endX: number;
  let endY: number;

  if (wire.direction === WireDirection.HORIZONTAL) {
    endX = gridX + wire.length;
    endY = gridY;
  } else {
    endX = gridX;
    endY = gridY + wire.length;
  }

  return {
    t: WIRE_TYPE_ID,
    p: [gridX, gridY],
    q: [endX, endY]
  };
}

/**
 * Encodes one snapshot definition's circuit (already file-local-numbered by
 * {@link collectSnapshots}) into positional elements. No instantiation: the
 * named-option body is mapped straight to the wire slots. Snapshot bodies are
 * read only by *our* decode (old clients ignore the `snapshot` field), so
 * fixed-/derived-arity `i`/`o` are reconstructed from the type on decode and are
 * intentionally not emitted here.
 */
function encodeDefinitionElements(
  def: SnapshotDefinition,
  provider: ComponentProviderService,
  customDims: ReadonlyMap<number, { numInputs: number; numOutputs: number }>
): ProjectElement[] {
  const tunnelIds = legacyTunnelIds(
    def.components
      .filter((c) => c.type === BuiltInComponentType.TUNNEL)
      .map((c) => c.options['label'] as string)
  );
  const elements: ProjectElement[] = [];
  for (const component of def.components) {
    elements.push(
      encodeBodyComponent(component, provider, tunnelIds, customDims)
    );
  }
  for (const wire of def.wires) {
    elements.push(encodeBodyWire(wire));
  }
  return elements;
}

function encodeBodyComponent(
  component: SerializedComponentBody,
  provider: ComponentProviderService,
  tunnelIds: Map<string, number>,
  customDims: ReadonlyMap<number, { numInputs: number; numOutputs: number }>
): ProjectElement {
  const el: ProjectElement = {
    t: component.type,
    p: [component.pos[0], component.pos[1]]
  };

  if (component.type >= CUSTOM_TYPE_ID_BASE) {
    // Nested custom: no legacy slots — only the direction round-trips; the
    // instance's counts/labels come from its own definition on load (Inv. A).
    const dir = component.options['direction'];
    if (typeof dir === 'number' && dir !== 0) el.r = dir;
    // Re-anchor pivot -> legacy top-left about the definition's body extent,
    // the inverse of the migration's custom re-anchor.
    const dim = customDims.get(component.type);
    const { w, h } = legacyCustomBodySize(
      dim?.numInputs ?? 0,
      dim?.numOutputs ?? 0
    );
    el.p = pivotToLegacyAnchor(
      component.pos[0],
      component.pos[1],
      el.r ?? 0,
      w,
      h
    );
    return el;
  }

  const config = provider.getComponent(component.type);
  const slots = (config as ComponentConfig | undefined)?.legacyV0Slots;
  if (!slots) return el;

  if (slots.r) {
    const v = component.options[slots.r];
    if (typeof v === 'number' && v !== 0) el.r = v;
  }
  if (slots.i) {
    const v = component.options[slots.i];
    if (typeof v === 'number') el.i = v;
  }
  if (slots.o) {
    const v = component.options[slots.o];
    if (typeof v === 'number') el.o = v;
  }
  if (slots.n && slots.n.length > 0) {
    el.n = slots.n.map((key) => component.options[key] as number);
  }
  if (slots.s) {
    const v = component.options[slots.s];
    if (v !== undefined) el.s = v as string;
  }

  // Tunnel labels have no positional slot — same mapping as the document body.
  if (component.type === BuiltInComponentType.TUNNEL) {
    const label = component.options['label'] as string;
    el.n = [tunnelIds.get(label) ?? 0];
    el.s = label;
  }

  // Built-ins inside a custom definition keep their negation (already sorted,
  // in-range from serializeComponentBody); copy it onto the v0 element.
  if (component.negInputs?.length) el.negInputs = [...component.negInputs];
  if (component.negOutputs?.length) el.negOutputs = [...component.negOutputs];

  // Reverse the v0→v1 pivot re-anchor (the snapshot body was decoded through
  // the same migration), so built-ins round-trip to their legacy top-left.
  const width = legacyBodyWidth(component.type, el.r ?? 0, el.i ?? 0, el.n);
  const height = legacyBodyHeight(component.type, el.i ?? 0, el.o ?? 0, el.n);
  el.p = pivotToLegacyAnchor(
    component.pos[0],
    component.pos[1],
    el.r ?? 0,
    width,
    height
  );

  return el;
}

function encodeBodyWire(wire: SerializedWireBody): ProjectElement {
  const [x, y] = wire.pos;
  const end: [number, number] =
    wire.direction === WireDirection.HORIZONTAL
      ? [x + wire.length, y]
      : [x, y + wire.length];
  return { t: WIRE_TYPE_ID, p: [x, y], q: end };
}
