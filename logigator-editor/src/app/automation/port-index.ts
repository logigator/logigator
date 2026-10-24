/**
 * Reverse index from a top-level component to the link ids its ports sit on —
 * the read direction the compiler's link mapping does not provide. One scan per
 * compiled board, here rather than in the compiler because nothing else in the
 * editor needs it.
 *
 * Entries carry the component instance the mapping pointed at, so a port read
 * never re-resolves ids through a project: it reads exactly the components the
 * running session was compiled from.
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
