import { ComponentCategory } from '../model/component-category.enum';
import { ComponentType } from '../model/component-type.enum';
import { Direction } from '../model/direction';
import { OptionSchema, OptionValues } from './option-schema';

/**
 * Everything about a built-in component type that is a pure function of its
 * option values: identity, option schemas, port arity, labels, body extent.
 * Custom components have no meta — their definition is this data.
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
 * Maps a built-in's named options onto the positional v0 slots
 * (`i`/`o`/`n`/`s`). The `r` slot needs no entry: it always carries the
 * first-class `direction`, handled generically.
 *
 * FROZEN. It describes the immutable v0 format and names v1-era option keys.
 * Renaming a live option does not change this — add a `v1→v2` migration
 * instead. The mapping is purely positional.
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
 * `TValues` names the option-value shape a type's own functions read. Metas are
 * stored under the base `ComponentMeta`, where bivariant method parameters let
 * a narrower shape through — sound because those functions only ever see values
 * already checked by {@link validateOptionValue} against `options`.
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
   * A body may be direction-dependent: the segment display keeps a fixed
   * upright width when rotated, or its readout would decide the extent along
   * the wrong axis.
   */
  body(options: TValues, direction: Direction): BodySize;
}

/**
 * Erases a meta's value shape so metas can be stored uniformly. Declaring each
 * built-in `as const` keeps its literal key types but makes
 * `ports`/`labels`/`body` plain properties — strictly contravariant, so a meta
 * reading a narrow value shape is not assignable to `ComponentMeta` on its own.
 * `ComponentMeta<never>` accepts them all, and this is the single widening.
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
