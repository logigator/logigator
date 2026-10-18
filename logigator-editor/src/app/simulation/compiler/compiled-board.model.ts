import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
import { CompileDiagnostic } from './compile-error';
import { WatchIndex } from './watch-index';

/**
 * The engine's user-input type: a unit with no inputs whose outputs only
 * `submitInput` drives. Input `i` of the engine's input numbering is the
 * `i`-th unit of this type in the descriptor.
 */
export const ENGINE_USER_INPUT_TYPE = 200;

/** One simulator unit: link ids per pin, in the component's pin order. */
export interface BoardComponentDescriptor {
  type: number;
  inputs: number[];
  outputs: number[];
  /**
   * Negated input-pin indices (into `inputs[]`) the engine inverts before the
   * kernel runs; `negOutputs` into `outputs[]`, inverted after. Sparse index
   * arrays, not a bitmask. Omitted when empty.
   */
  negInputs?: number[];
  negOutputs?: number[];
  /** CLK: the ticks it stays low per cycle. */
  period?: number;
  /** CLK: high for `period` ticks (`square`) or for one (`pulse`). */
  mode?: 'pulse' | 'square';
  /** RAM: outputs follow the address (`async`) or change on a rising clock. */
  read?: 'async' | 'clocked';
  /** ROM: its contents, bit-packed to the address × word table. */
  data?: Uint8Array;
  /** LED matrix (the engine's addressable register): its data-bus width. */
  dataBus?: number;
}

/** The per-type parameters of a {@link BoardComponentDescriptor}. */
export type BoardComponentParams = Pick<
  BoardComponentDescriptor,
  'period' | 'mode' | 'read' | 'data' | 'dataBus'
>;

/**
 * The WASM simulator's board format. A link id indexes the simulator's link
 * state; the links are numbered from 0 to the highest id a pin names. The
 * component order is the submission order that defines `submitInput` comp
 * ids, the input numbering of `inputProgress` and the `getOutputs()` layout.
 */
export interface BoardDescriptor {
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
  /** Links the descriptor's pins name, every id below it used. */
  linkCount: number;
  mapping: LinkMapping;
  /**
   * Top-level user input `Component.id` → its unit's board submission index;
   * slot `i` is the unit's output `i`.
   */
  userInputs: ReadonlyMap<number, number>;
  /**
   * Top-level `Component.id` → its unit's board submission index, for every
   * component whose engine state the editor reads (a RAM's memory).
   */
  stateUnits: ReadonlyMap<number, number>;
  diagnostics: CompileDiagnostic[];
  /** Path-addressable watch data for live inner-circuit views. */
  watch: WatchIndex;
}
