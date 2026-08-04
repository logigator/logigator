import { Point } from 'pixi.js';
import { Action } from '../action';
import type { Project } from '../../project/project';
import { WireDirection } from '../../wires/wire-direction.enum';
import {
  SerializedAction,
  SerializedRotateWireEntry
} from '../serialized-action.model';

/**
 * One wire's share of a group rotation: the orbited start position plus the
 * axis it lands on (a quarter-turn swaps HORIZONTAL/VERTICAL; the length is
 * rotation-invariant and stays untouched).
 */
export interface RotateWireEntry {
  id: number;
  oldPos: Point;
  newPos: Point;
  oldDirection: WireDirection;
  newDirection: WireDirection;
}

export class RotateWiresAction extends Action {
  private readonly _entries: RotateWireEntry[];

  constructor(...entries: RotateWireEntry[]) {
    super();
    this._entries = entries.map((e) => ({
      ...e,
      oldPos: e.oldPos.clone(),
      newPos: e.newPos.clone()
    }));
  }

  serialize(): SerializedAction {
    return {
      type: 'rotateWires',
      entries: this._entries.map((e): SerializedRotateWireEntry => ({
        id: e.id,
        oldPos: [e.oldPos.x, e.oldPos.y],
        newPos: [e.newPos.x, e.newPos.y],
        oldDirection: e.oldDirection,
        newDirection: e.newDirection
      }))
    };
  }

  do(project: Project): void {
    for (const e of this._entries) {
      project.setWireGeometry(e.id, e.newPos, e.newDirection);
    }
  }

  undo(project: Project): void {
    for (const e of this._entries) {
      project.setWireGeometry(e.id, e.oldPos, e.oldDirection);
    }
  }
}

/** Rebuilds rotate entries (with `Point`s) from their flattened dump form. */
export function deserializeRotateWireEntries(
  entries: readonly SerializedRotateWireEntry[]
): RotateWireEntry[] {
  return entries.map((e) => ({
    id: e.id,
    oldPos: new Point(e.oldPos[0], e.oldPos[1]),
    newPos: new Point(e.newPos[0], e.newPos[1]),
    oldDirection: e.oldDirection,
    newDirection: e.newDirection
  }));
}
