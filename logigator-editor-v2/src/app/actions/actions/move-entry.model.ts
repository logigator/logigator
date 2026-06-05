import { Point } from 'pixi.js';

export interface MoveEntry {
  id: number;
  oldPos: Point;
  newPos: Point;
}
