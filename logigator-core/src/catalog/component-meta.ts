import { ComponentCategory } from '../model/component-category.enum';
import { ComponentType } from '../model/component-type.enum';
import { Direction } from '../model/direction';
import { OptionSchema, OptionValues } from './option-schema';

/**
 * Everything about a built-in component type that is a pure function of its
 * option values: its identity, its option schemas, its port arity, its port
 * labels and its body extent.
 *
 * This is the half both sides need. The editor composes a `ComponentConfig`
 * around it (adding the factory, the inspector actions, the palette shape and
 * the option renderers); the server reads it straight off a document to check
 * that a component's options are legal and that its ports line up. Custom
 * components have no meta — their definition *is* this data.
 */

/** Port counts of one instance. */
export interface Ports {
  readonly inputs: number;
  readonly outputs: number;
}

/** Port labels drawn inside the body, in port order within each group. */
export interface PortLabels {
  readonly inputs: string[];
  readonly outputs: string[];
}

/** Body extent in grid units, in the component's unrotated local frame. */
export interface BodySize {
  readonly width: number;
  readonly height: number;
}

/**
 * Declarative map from a built-in's named options to the legacy positional `v0`
 * wire slots (`i`/`o`/`n`/`s`). Single source of truth for the permanent
 * `v0ToV1` file migration (decode) and the temporary server encoder (encode).
 * The `r` slot needs no entry — it always carries the component's first-class
 * `direction`, handled generically by both sides.
 *
 * FROZEN: it describes the *immutable* legacy `ProjectElement` format and names
 * **v1-era option keys**. If a live option is later renamed, do NOT edit this to
 * match — add a `v1→v2` migration instead. The mapping is purely positional;
 * a type needing computed legacy decode would handle it separately.
 */
export interface LegacyV0Slots {
  /** Option populated from `element.i` (input count). */
  readonly i?: string;
  /** Option populated from `element.o` (output count). */
  readonly o?: string;
  /** Options consuming `element.n[0]`, `n[1]`, … in declaration order. */
  readonly n?: readonly string[];
  /** The single option consuming `element.s`. */
  readonly s?: string;
}

/**
 * `TValues` names the option-value shape a type's own functions read. The table
 * below stores every meta under the base `ComponentMeta`, where TypeScript's
 * bivariant method parameters let a narrower shape through — sound here because
 * a caller reaching the functions has already run the values through
 * {@link validateOptionValue} against the very schemas in `options`.
 */
export interface ComponentMeta<TValues extends object = OptionValues> {
  readonly type: ComponentType;
  readonly category: ComponentCategory;
  /** Short glyph shown in the palette and, for most types, on the body. */
  readonly symbol: string;
  /** Translation key. */
  readonly name: string;
  /** Translation key. */
  readonly description: string;
  readonly options: Readonly<Record<string, OptionSchema>>;
  /** Absent on types the legacy v0 format never carried. */
  readonly legacyV0Slots?: LegacyV0Slots;

  ports(options: TValues): Ports;
  labels(options: TValues): PortLabels;
  /**
   * `direction` is a parameter because a body may be direction-dependent: the
   * segment display keeps a fixed upright width when rotated, since its readout
   * would otherwise decide the extent along the wrong axis.
   */
  body(options: TValues, direction: Direction): BodySize;
}

/**
 * Erases a meta's value shape so it can be stored and passed around uniformly.
 *
 * Each built-in is declared `as const` so its literal key types survive for the
 * editor's translation-key gate. That also makes `ports`/`labels`/`body` plain
 * properties rather than methods — strictly contravariant, so a meta reading a
 * narrow value shape is not assignable to `ComponentMeta` on its own.
 * `ComponentMeta<never>` accepts every one of them soundly, and this is the
 * single place the remaining widening happens. It is safe because the functions
 * are only ever called with values already checked by
 * {@link validateOptionValue} against the schemas in that same meta.
 */
export function widenMeta(meta: ComponentMeta<never>): ComponentMeta {
  return meta as ComponentMeta;
}

/**
 * The default body height: one row per port, at least one row. Types that need
 * a taller minimum (or a square body) compute their own.
 */
export function defaultBodyHeight(ports: Ports): number {
  return Math.max(1, ports.inputs, ports.outputs);
}

/** No ports at all — the shape most option-less display types report. */
export const NO_PORTS: Ports = { inputs: 0, outputs: 0 };

/** No labels at all — the shape every unlabelled body reports. */
export const NO_LABELS: PortLabels = { inputs: [], outputs: [] };

/** `['0', '1', … 'count-1']` — the plain index labels several types use. */
export function indexLabels(count: number): string[] {
  return Array.from({ length: count }, (_, i) => String(i));
}

/** `['1', '2', '4', … ]` — bit-weight labels, used by the coders. */
export function bitWeightLabels(count: number): string[] {
  return Array.from({ length: count }, (_, i) => String(1 << i));
}

/** `['<prefix>0', '<prefix>1', … ]` — bus-line labels. */
export function busLabels(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}${i}`);
}
