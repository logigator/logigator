import { Point } from 'pixi.js';
import { Action } from '../action';
import type { Project } from '../../project/project';
import { Direction } from '../../utils/direction';
import {
  SerializedAction,
  SerializedRotateComponentEntry
} from '../serialized-action.model';

/**
 * One component's share of a group rotation: the direction step plus the
 * pivot-orbited position. Carried together because neither move nor
 * change-option alone round-trips a rotation — the direction setter re-anchors
 * the position on its own.
 */
export interface RotateComponentEntry {
  id: number;
  oldPos: Point;
  newPos: Point;
  oldDirection: Direction;
  newDirection: Direction;
}

export class RotateComponentsAction extends Action {
  private readonly _entries: RotateComponentEntry[];

  constructor(...entries: RotateComponentEntry[]) {
    super();
    this._entries = entries.map((e) => ({
      ...e,
      oldPos: e.oldPos.clone(),
      newPos: e.newPos.clone()
    }));
  }

  serialize(): SerializedAction {
    return {
      type: 'rotateComponents',
      entries: this._entries.map((e): SerializedRotateComponentEntry => ({
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
      project.rotateComponent(e.id, e.newDirection, e.newPos);
    }
  }

  undo(project: Project): void {
    for (const e of this._entries) {
      project.rotateComponent(e.id, e.oldDirection, e.oldPos);
    }
  }
}

/** Rebuilds rotate entries (with `Point`s) from their flattened dump form. */
export function deserializeRotateComponentEntries(
  entries: readonly SerializedRotateComponentEntry[]
): RotateComponentEntry[] {
  return entries.map((e) => ({
    id: e.id,
    oldPos: new Point(e.oldPos[0], e.oldPos[1]),
    newPos: new Point(e.newPos[0], e.newPos[1]),
    oldDirection: e.oldDirection,
    newDirection: e.newDirection
  }));
}
