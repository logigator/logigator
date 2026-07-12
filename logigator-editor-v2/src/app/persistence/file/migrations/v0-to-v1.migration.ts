import { Migration, MigrationContext } from './migration';
import {
  CircuitFileV0,
  CircuitFileV1,
  LegacyComponentDefinition
} from '../circuit-file.types';
import { InvalidFileError } from '../circuit-file.errors';
import {
  SerializedComponentBody,
  SerializedWireBody,
  SnapshotDefinition
} from '../../serialized-circuit';
import { ProjectElement } from '../../../api/models/project-element';
import { WireDirection } from '../../../wires/wire-direction.enum';
import { ComponentConfig } from '../../../components/component-config.model';
import {
  BuiltInComponentType,
  CUSTOM_TYPE_ID_BASE
} from '../../../components/component-type.enum';
import { Direction } from '../../../utils/direction';
import {
  legacyAnchorToPivot,
  legacyBodyHeight,
  legacyBodyWidth,
  legacyCustomBodySize
} from '../../legacy-anchor';
import { encodeWireChain, toPersistedDefinition } from '../../wire-chain.codec';

/** Old editor's ElementTypeId.WIRE — the canonical type ID for wires in the v0 format. */
const WIRE_TYPE_ID = 0;

/**
 * File-local custom type id → its definition's port counts, used to re-anchor a
 * rotated custom instance about its body extent. Keyed by the same id the body's
 * custom elements carry as `t` (`info.id` for a legacy file, `dep.model` for a
 * server response).
 */
type CustomDims = ReadonlyMap<
  number,
  { numInputs: number; numOutputs: number }
>;

function legacyWireToBody(el: ProjectElement): SerializedWireBody {
  const [px, py] = el.p;
  const [qx, qy] = el.q!;
  const horizontal = qy === py;
  return {
    pos: [px, py],
    direction: horizontal ? WireDirection.HORIZONTAL : WireDirection.VERTICAL,
    length: horizontal ? qx - px : qy - py
  };
}

/**
 * Decodes a v0 element's positional option slots into **named** option values,
 * driven by the config's {@link ComponentConfig.legacyV0Slots} descriptor. Every
 * option starts at its default; the descriptor then overrides those it maps to a
 * present `r`/`i`/`o`/`n`/`s` field. Pure: reads only config metadata, builds no
 * render objects.
 */
function decodeOptions(
  element: ProjectElement,
  config: ComponentConfig
): Record<string, unknown> {
  const slots = config.legacyV0Slots ?? {};
  const values: Record<string, unknown> = {};
  for (const [key, proto] of Object.entries(config.options)) {
    values[key] = proto.value;
  }

  if (slots.r && element.r !== undefined) values[slots.r] = element.r;
  if (slots.i && element.i !== undefined) values[slots.i] = element.i;
  if (slots.o && element.o !== undefined) values[slots.o] = element.o;
  if (slots.n && element.n) {
    slots.n.forEach((key, index) => {
      if (element.n && index < element.n.length) {
        values[key] = element.n[index];
      }
    });
  }
  if (slots.s && element.s !== undefined) values[slots.s] = element.s;

  return values;
}

/**
 * Decodes a positional element list into the native body (components + wires),
 * shared by the document body and every embedded snapshot's circuit. Wires
 * become {@link SerializedWireBody}; built-ins map their positional slots to
 * named options; custom-range elements (`t >= CUSTOM_TYPE_ID_BASE`, written by a
 * snapshot-bearing save) keep their file-local type id and round-trip only
 * `direction` — port counts/labels come from the resolved definition on load
 * (Invariant A). A rotated custom is still re-anchored from the legacy body
 * top-left to the v2 pivot like any other component; its body extent comes from
 * {@link CustomDims} (the definition's port counts), falling back to the
 * instance's own `i`/`o` when absent. Unknown built-in types are dropped with a
 * warning, consistent with the editor's silent-drop behaviour.
 */
function decodeElements(
  elements: ProjectElement[],
  ctx: MigrationContext,
  customDims: CustomDims
): { components: SerializedComponentBody[]; wires: SerializedWireBody[] } {
  const components: SerializedComponentBody[] = [];
  const wires: SerializedWireBody[] = [];

  for (const element of elements) {
    if (element.t === WIRE_TYPE_ID) {
      wires.push(legacyWireToBody(element));
      continue;
    }

    if (element.t >= CUSTOM_TYPE_ID_BASE) {
      const direction: Direction = element.r ?? Direction.E;
      const dim = customDims.get(element.t);
      const { w, h } = legacyCustomBodySize(
        dim?.numInputs ?? element.i ?? 0,
        dim?.numOutputs ?? element.o ?? 0
      );
      components.push({
        type: element.t,
        pos: legacyAnchorToPivot(element.p[0], element.p[1], direction, w, h),
        options: { direction }
      });
      continue;
    }

    const config = ctx.componentProvider.getComponent(element.t);
    if (!config || !config.legacyV0Slots) {
      ctx.logging.warn(
        `Unknown component type ID: ${element.t} — skipping element at [${element.p[0]}, ${element.p[1]}]`,
        'v0ToV1Migration'
      );
      continue;
    }

    const direction: Direction = element.r ?? Direction.E;
    const width = legacyBodyWidth(
      element.t,
      direction,
      element.i ?? 0,
      element.n
    );
    const height = legacyBodyHeight(
      element.t,
      element.i ?? 0,
      element.o ?? 0,
      element.n
    );

    const options = decodeOptions(element, config);
    if (
      element.t === BuiltInComponentType.TEXT &&
      typeof element.n?.[0] === 'number'
    ) {
      // v0 stored an abstract size the old editor rendered at
      // gridPixelWidth * size / 8 = size * (16 / 8) px; v2's fontSize is
      // already a pixel value, so scale by that same 16/8 = 2 factor.
      options['fontSize'] = element.n[0] * 2;
    }
    if (element.t === BuiltInComponentType.TUNNEL) {
      // Tunnel labels have no positional slot of their own: a v2 save carries
      // the label additively in `s`, a legacy save only its numeric id in
      // `n[0]` — which becomes the label so equal ids stay joined.
      options['label'] =
        typeof element.s === 'string' ? element.s : String(element.n?.[0] ?? 0);
    }

    components.push({
      type: element.t,
      pos: legacyAnchorToPivot(
        element.p[0],
        element.p[1],
        direction,
        width,
        height
      ),
      options,
      ...decodeNegation(element)
    });
  }

  return { components, wires };
}

/**
 * Copies a v0 element's negation arrays into the native body, omitting empty or
 * non-array fields. Defensive against the array shape so a stray value can't
 * crash the later `Component.deserialize` iteration (the backend DTO already
 * validates them, this just keeps the permanent decode path robust).
 */
function decodeNegation(element: ProjectElement): {
  negInputs?: number[];
  negOutputs?: number[];
} {
  return {
    ...(Array.isArray(element.negInputs) && element.negInputs.length
      ? { negInputs: [...element.negInputs] }
      : {}),
    ...(Array.isArray(element.negOutputs) && element.negOutputs.length
      ? { negOutputs: [...element.negOutputs] }
      : {})
  };
}

/**
 * Revives the additive embedded snapshots carried by a server response's
 * `dependencies` into native {@link SnapshotDefinition}s. Each entry's `model`
 * is the file-local type id (kept verbatim so the body's custom `t`s match);
 * the summary travels frozen inside the `snapshot` (so a stale instance renders
 * at its own ports, not the master's current ones); `source` provenance comes
 * from the dependency id + the snapshot version. Reference-only dependencies (no
 * embedded `snapshot`, i.e. the old always-latest model) are skipped here — their
 * body elements then surface as unresolved customs and are dropped with a warning
 * on load (see `CircuitFileService.deserialize`).
 */
function decodeDependencies(
  input: CircuitFileV0,
  ctx: MigrationContext,
  customDims: CustomDims
): SnapshotDefinition[] {
  const definitions: SnapshotDefinition[] = [];
  for (const dep of input.dependencies ?? []) {
    if (!dep.snapshot) continue;
    const { components, wires } = decodeElements(
      dep.snapshot.elements,
      ctx,
      customDims
    );
    // A server dependency carries an owned cloud-component mapping id; the
    // current model allows only cloud dependencies in a cloud document, so a
    // present id is always cloud-origin. A missing id (`''`, e.g. a legacy
    // reference-only or a bypass) leaves no provenance — the instance loads as an
    // embedded orphan, recoverable via restore.
    const id = dep.id || dep.dependency?.id;
    definitions.push({
      type: dep.model,
      source: id
        ? { id, version: dep.snapshot.version, origin: 'server' }
        : undefined,
      name: dep.snapshot.name,
      symbol: dep.snapshot.symbol,
      description: dep.snapshot.description,
      numInputs: dep.snapshot.numInputs,
      numOutputs: dep.snapshot.numOutputs,
      labels: [...dep.snapshot.labels],
      components,
      wires
    });
  }
  return definitions;
}

/**
 * Revives the old-editor *file* sub-circuit definitions (the top-level
 * `components` array) into native {@link SnapshotDefinition}s. Each entry's
 * `info.id` is the custom-range type id its instances reference in the body, so
 * it becomes the definition's file-local `type` (kept verbatim, remapped to a
 * session id on load). The inner circuit decodes through the same
 * {@link decodeElements} as everything else, so nested customs stay file-local
 * and resolve via the load-time two-pass remap. Entries without a numeric
 * `info.id` can't be referenced and are skipped. `source` is left absent — a
 * legacy file carries no library provenance, so these load as never-saved-to-
 * library snapshots. Types already produced by {@link decodeDependencies} are
 * skipped so the two sources never collide (in practice a document has one or
 * the other).
 */
function decodeLegacyComponents(
  components: LegacyComponentDefinition[] | undefined,
  ctx: MigrationContext,
  taken: ReadonlySet<number>,
  customDims: CustomDims
): SnapshotDefinition[] {
  const definitions: SnapshotDefinition[] = [];
  for (const component of components ?? []) {
    const info = component.info ?? {};
    if (typeof info.id !== 'number' || info.id < CUSTOM_TYPE_ID_BASE) continue;
    if (taken.has(info.id)) continue;
    const { components: innerComponents, wires } = decodeElements(
      component.elements ?? [],
      ctx,
      customDims
    );
    definitions.push({
      type: info.id,
      name: info.name ?? '',
      symbol: info.symbol ?? '',
      description: info.description ?? '',
      numInputs: info.numInputs ?? 0,
      numOutputs: info.numOutputs ?? 0,
      labels: Array.isArray(info.labels) ? [...info.labels] : [],
      components: innerComponents,
      wires
    });
  }
  return definitions;
}

/**
 * Indexes every custom definition's port counts by its file-local type id, so a
 * custom instance in any body can be re-anchored about its true body extent.
 * Pulls from both definition sources (legacy-file `components`, server
 * `dependencies`); the two never share a type id in a real document.
 */
function collectCustomDims(input: CircuitFileV0): CustomDims {
  const dims = new Map<number, { numInputs: number; numOutputs: number }>();
  for (const dep of input.dependencies ?? []) {
    if (!dep.snapshot) continue;
    dims.set(dep.model, {
      numInputs: dep.snapshot.numInputs,
      numOutputs: dep.snapshot.numOutputs
    });
  }
  for (const component of input.components ?? []) {
    const info = component.info ?? {};
    if (typeof info.id !== 'number') continue;
    dims.set(info.id, {
      numInputs: info.numInputs ?? 0,
      numOutputs: info.numOutputs ?? 0
    });
  }
  return dims;
}

/**
 * Converts the legacy `logigator-editor` file format (v0: no `version` field,
 * options packed positionally into the `t/p/q/r/i/o/n/s` wire format) into the
 * native v1 format with named options. This is a single v0→v1 step — the next
 * version in the chain, not a jump to newest.
 *
 * Registry-backed (needs the component configs and their `legacyV0Slots`
 * descriptors to map positional slots to named options) but instantiates no
 * render objects. Both sub-circuit-definition sources are revived into
 * `definitions[]`: the old-editor *file*'s inline `components` array (via
 * {@link decodeLegacyComponents}) and the server transport's additive embedded
 * snapshots (via {@link decodeDependencies}). Either way the migrated document
 * is self-contained and indistinguishable from a native file load downstream.
 */
export const v0ToV1Migration: Migration<CircuitFileV0, CircuitFileV1> = {
  from: 0,
  to: 1,
  migrate(input, ctx: MigrationContext): CircuitFileV1 {
    if (!input?.project || !Array.isArray(input.project.elements)) {
      throw new InvalidFileError('Legacy file is missing project elements');
    }

    const customDims = collectCustomDims(input);

    const { components, wires } = decodeElements(
      input.project.elements,
      ctx,
      customDims
    );

    const dependencyDefinitions = decodeDependencies(input, ctx, customDims);
    const legacyDefinitions = decodeLegacyComponents(
      input.components,
      ctx,
      new Set(dependencyDefinitions.map((d) => d.type)),
      customDims
    );

    return {
      version: 1,
      name: input.project.name ?? 'Untitled',
      components,
      wires: encodeWireChain(wires).text,
      definitions: [...dependencyDefinitions, ...legacyDefinitions].map(
        toPersistedDefinition
      )
    };
  }
};
