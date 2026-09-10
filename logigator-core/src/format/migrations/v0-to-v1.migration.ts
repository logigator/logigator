import { Migration, MigrationContext } from './migration';
import {
  BuiltInComponentType,
  CUSTOM_TYPE_ID_BASE
} from '../../model/component-type.enum';
import { Direction } from '../../model/direction';
import { WireDirection } from '../../model/wire-direction.enum';
import { ProjectElement } from '../../model/project-element';
import {
  SerializedComponentBody,
  SerializedWireBody,
  SnapshotDefinition
} from '../../model/serialized-circuit';
import {
  legacyAnchorToPivot,
  legacyBodyHeight,
  legacyBodyWidth,
  legacyCustomBodySize
} from '../../model/legacy-anchor';
import { encodeComponentPositions } from '../../codecs/position-delta.codec';
import { encodeWireChain } from '../../codecs/wire-chain.codec';
import { toPersistedDefinition } from '../../codecs/persisted-definition.codec';
import {
  CircuitFileV0,
  CircuitFileV1,
  LegacyComponentDefinition
} from '../circuit-file.types';
import { InvalidFileError } from '../circuit-file.errors';
import { ComponentMeta } from '../../catalog/component-meta';
import { defaultOptionValues } from '../../catalog/option-schema';

/** v0's ElementTypeId.WIRE. */
const WIRE_TYPE_ID = 0;

/**
 * File-local custom type id → its definition's port counts, used to re-anchor a
 * rotated custom instance about its body extent. Keyed by the same id the
 * body's custom elements carry as `t`.
 */
type CustomDims = ReadonlyMap<
  number,
  { numInputs: number; numOutputs: number }
>;

/**
 * A coordinate pair out of a v0 element. v0 has no schema, so a malformed
 * position is rejected rather than read past.
 */
function legacyPoint(value: unknown, what: string): [number, number] {
  if (
    !Array.isArray(value) ||
    !Number.isFinite(value[0]) ||
    !Number.isFinite(value[1])
  ) {
    throw new InvalidFileError(`Legacy element has no readable ${what}`);
  }
  return [value[0] as number, value[1] as number];
}

function legacyWireToBody(el: ProjectElement): SerializedWireBody {
  const [px, py] = legacyPoint(el.p, 'position');
  const [qx, qy] = legacyPoint(el.q, 'wire end');
  const horizontal = qy === py;
  return {
    pos: [px, py],
    direction: horizontal ? WireDirection.HORIZONTAL : WireDirection.VERTICAL,
    length: horizontal ? qx - px : qy - py
  };
}

/**
 * Decodes a v0 element's positional slots into named option values through the
 * type's {@link ComponentMeta.legacyV0Slots} descriptor: every option starts at
 * its default, overridden where the descriptor maps a present `i`/`o`/`n`/`s`.
 * `r` becomes the body's first-class `direction`, not an option.
 */
function decodeOptions(
  element: ProjectElement,
  meta: ComponentMeta
): Record<string, unknown> {
  const slots = meta.legacyV0Slots ?? {};
  const values = defaultOptionValues(meta.options);

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
 * Decodes a positional element list into the native body. Custom-range elements
 * keep their file-local type id and round-trip only `direction`; their ports
 * come from the resolved definition. Every component is re-anchored from the
 * legacy top-left to the pivot, a custom's extent from {@link CustomDims} with
 * its own `i`/`o` as fallback. Unknown built-ins are dropped with a warning.
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
        pos: legacyAnchorToPivot(
          ...legacyPoint(element.p, 'position'),
          direction,
          w,
          h
        ),
        ...(direction ? { direction } : {}),
        options: {}
      });
      continue;
    }

    const [px, py] = legacyPoint(element.p, 'position');

    const meta = ctx.catalog(element.t);
    if (!meta || !meta.legacyV0Slots) {
      ctx.log.warn(
        `Unknown component type ID: ${element.t} — skipping element at [${px}, ${py}]`
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

    const options = decodeOptions(element, meta);
    if (
      element.t === BuiltInComponentType.TEXT &&
      typeof element.n?.[0] === 'number'
    ) {
      // v0's `n[0]` is an abstract size rendered at gridPixelWidth * size / 8
      // = size * 2 px; `fontSize` is already pixels, so scale by 2.
      options['fontSize'] = element.n[0] * 2;
    }
    if (element.t === BuiltInComponentType.TUNNEL) {
      // Tunnel labels have no positional slot: `s` carries the label when
      // present, otherwise the numeric id in `n[0]` becomes it so equal ids
      // stay joined.
      options['label'] =
        typeof element.s === 'string' ? element.s : String(element.n?.[0] ?? 0);
    }

    components.push({
      type: element.t,
      pos: legacyAnchorToPivot(px, py, direction, width, height),
      ...(direction ? { direction } : {}),
      options,
      ...decodeNegation(element)
    });
  }

  return { components, wires };
}

/**
 * Copies a v0 element's negation arrays into the native body, omitting empty or
 * non-array fields so a stray value cannot crash a later iteration over them.
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
 * Revives a v0 `dependencies` array's embedded snapshots into native
 * {@link SnapshotDefinition}s. `model` is the file-local type id, kept verbatim
 * so the body's custom `t`s match, and the summary stays frozen inside the
 * snapshot so a stale instance renders at its own ports. A dependency carrying
 * no snapshot is skipped and its instances drop on load.
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
    // Only cloud dependencies are allowed in a cloud document, so a present id
    // is always cloud-origin. A missing id leaves no provenance and the
    // instance loads as an embedded orphan.
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
 * Revives a v0 file's top-level `components` definitions into native
 * {@link SnapshotDefinition}s, `info.id` becoming the file-local `type` its
 * instances reference. Skips entries with no numeric `info.id` and types
 * {@link decodeDependencies} already produced, so the two sources never
 * collide. `source` stays absent: a v0 file carries no provenance.
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
 * Indexes every custom definition's port counts by file-local type id, so an
 * instance can be re-anchored about its true body extent. Both definition
 * sources feed it and never share a type id in a real document.
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
 * Converts v0 (no `version` field, options packed positionally into
 * `t/p/q/r/i/o/n/s`) into v1 with named options — one step in the chain, not a
 * jump to newest. Both definition sources are revived into `definitions[]`, so
 * the result is self-contained and indistinguishable from a native load.
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
      components: encodeComponentPositions(components).components,
      wires: encodeWireChain(wires).text,
      definitions: [...dependencyDefinitions, ...legacyDefinitions].map(
        toPersistedDefinition
      )
    };
  }
};
