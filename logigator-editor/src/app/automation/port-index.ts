/**
 * Reverse index from a top-level component to the link ids its ports sit on —
 * the read direction the compiler's {@link LinkMapping} does not provide (it
 * maps link id → render targets).
 *
 * Built with one scan per compiled board in the automation layer rather than in
 * the compiler: nothing in the editor itself needs it. If a second consumer ever
 * wants the same lookup (verilog-llm's truth-table stage is the candidate),
 * promote it onto `CompiledBoard` then.
 *
 * The entries carry the component instance the mapping pointed at, so a port
 * read never has to re-resolve ids through a project — it reads exactly the
 * components the running session was compiled from.
 */

import { Component } from '../components/component';
import {
  CompiledBoard,
  TOP_LEVEL_PATH
} from '../simulation/compiler/compiled-board.model';

export interface PortLinkEntry {
  component: Component;
  /** Link id per port, in the component's `connectionPoints` order. */
  links: number[];
}

/** `componentId → ports`, for every component with at least one mapped port. */
export type PortLinkIndex = ReadonlyMap<number, PortLinkEntry>;

export function buildPortLinkIndex(board: CompiledBoard): PortLinkIndex {
  const index = new Map<number, PortLinkEntry>();
  const targets = board.mapping.get(TOP_LEVEL_PATH) ?? [];
  targets.forEach((target, linkId) => {
    for (const { component, portIndex } of target.ports) {
      const entry = index.get(component.id) ?? { component, links: [] };
      entry.links[portIndex] = linkId;
      index.set(component.id, entry);
    }
  });
  return index;
}
