import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
import { CompileDiagnostic } from './compile-error';

/** One simulator unit: link ids per pin, in the component's pin order. */
export interface BoardComponentDescriptor {
  type: number;
  inputs: number[];
  outputs: number[];
}

/**
 * The WASM simulator's board format (JSON-ready). `links` is the number of
 * nets; a link id is an index into the simulator's link state. The component
 * order is the submission order that defines `triggerInput` comp ids and the
 * `getOutputs()` layout.
 */
export interface BoardDescriptor {
  links: number;
  components: BoardComponentDescriptor[];
}

export interface LinkPortRef {
  component: Component;
  /** Index in the component's `connectionPoints` order (inputs, then outputs). */
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
 * top-level entry is materialized now — inner paths come with the
 * nested-inspection follow-up.
 */
export type LinkMapping = ReadonlyMap<string, LinkRenderTargets[]>;

/**
 * One compiled simulation board. Holds live object references on the
 * rendering side — valid for one simulation session (editing is locked while
 * simulating); rebuilt on every start and discarded on exit.
 */
export interface CompiledBoard {
  descriptor: BoardDescriptor;
  mapping: LinkMapping;
  /** Top-level button/lever `Component.id` → board submission index. */
  userInputs: ReadonlyMap<number, number>;
  diagnostics: CompileDiagnostic[];
}
