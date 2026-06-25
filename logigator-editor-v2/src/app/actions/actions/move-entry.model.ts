import { Point } from 'pixi.js';
import { SerializedMoveEntry } from '../serialized-action.model';

export interface MoveEntry {
  id: number;
  oldPos: Point;
  newPos: Point;
}

/** Flattens move entries' `Point`s to `[x, y]` pairs for the debug dump. */
export function serializeMoveEntries(
  entries: readonly MoveEntry[]
): SerializedMoveEntry[] {
  return entries.map((e) => ({
    id: e.id,
    oldPos: [e.oldPos.x, e.oldPos.y],
    newPos: [e.newPos.x, e.newPos.y]
  }));
}

/** Rebuilds move entries (with `Point`s) from their flattened dump form. */
export function deserializeMoveEntries(
  entries: readonly SerializedMoveEntry[]
): MoveEntry[] {
  return entries.map((e) => ({
    id: e.id,
    oldPos: new Point(e.oldPos[0], e.oldPos[1]),
    newPos: new Point(e.newPos[0], e.newPos[1])
  }));
}
