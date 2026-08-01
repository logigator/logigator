/**
 * Reverse index from a top-level component to the link ids its ports sit on —
 * the read direction the compiler's {@link LinkMapping} does not provide (it
 * maps link id → render targets).
 *
 * Built with one scan per compiled board in the automation layer rather than in
 * the compiler: nothing in the editor itself needs it. If a second consumer ever
 * wants the same lookup (verilog-llm's truth-table stage is the candidate),
 * promote it onto `CompiledBoard` then.
 */

import {
  CompiledBoard,
  TOP_LEVEL_PATH
} from '../simulation/compiler/compiled-board.model';

/** `componentId → linkId` per port, in `connectionPoints` order. */
export type PortLinkIndex = ReadonlyMap<number, readonly number[]>;

export function buildPortLinkIndex(board: CompiledBoard): PortLinkIndex {
  const index = new Map<number, number[]>();
  const targets = board.mapping.get(TOP_LEVEL_PATH) ?? [];
  targets.forEach((target, linkId) => {
    for (const { component, portIndex } of target.ports) {
      const links = index.get(component.id) ?? [];
      links[portIndex] = linkId;
      index.set(component.id, links);
    }
  });
  return index;
}
