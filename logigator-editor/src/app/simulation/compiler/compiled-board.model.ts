import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
import { CompileDiagnostic } from './compile-error';
import { WatchIndex } from './watch-index';

/** One simulator unit: link ids per pin, in the component's pin order. */
export interface BoardComponentDescriptor {
  type: number;
  inputs: number[];
  outputs: number[];
  /**
   * Per-type parameter blob (e.g. a ROM's bit-packed contents table). Opaque to
   * the compiler, invariant under pin remapping, omitted when the type takes
   * none. The engine arity-checks it against the type.
   */
  ops?: number[];
  /**
   * Negated input-pin indices (into `inputs[]`) the engine inverts before the
   * kernel runs; `negOutputs` into `outputs[]`, inverted after. Sparse index
   * arrays, not a bitmask. Omitted when empty.
   */
  negInputs?: number[];
  negOutputs?: number[];
}

/**
 * The WASM simulator's board format (JSON-ready). A link id indexes the
 * simulator's link state. The component order is the submission order that
 * defines `triggerInput` comp ids and the `getOutputs()` layout.
 */
export interface BoardDescriptor {
  links: number;
  components: BoardComponentDescriptor[];
}

export interface LinkPortRef {
  component: Component;
  /** Index in the component's `connectionPoints` order: inputs, then
   * outputs. */
  portIndex: number;
}

/** Render targets of one link: the wires and port stubs it powers. */
export interface LinkRenderTargets {
  wires: Wire[];
  ports: LinkPortRef[];
}

/** The {@link LinkMapping} key of the top-level circuit. */
export const TOP_LEVEL_PATH = '';

/**
 * Per-circuit render targets, indexed by link id, keyed by instance path
 * (custom-instance component ids joined by `/`; `''` = top level). Only the
 * top-level entry is materialized — inner circuits resolve through the
 * {@link WatchIndex} at watch-open time.
 */
export type LinkMapping = ReadonlyMap<string, LinkRenderTargets[]>;

/**
 * One compiled simulation board. Holds live rendering-side object references,
 * so it is valid for exactly one session (editing is locked while simulating).
 */
export interface CompiledBoard {
  descriptor: BoardDescriptor;
  mapping: LinkMapping;
  /** Top-level button/switch `Component.id` → board submission index. */
  userInputs: ReadonlyMap<number, number>;
  diagnostics: CompileDiagnostic[];
  /** Path-addressable watch data for live inner-circuit views. */
  watch: WatchIndex;
}
