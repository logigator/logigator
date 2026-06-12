import { Point, Rectangle } from 'pixi.js';
import { WireDirection } from './wire-direction.enum';

// Geometry-only DTO independent of the live Wire object's lifetime.
// Used by mutation paths that need to compare pre/post wire state without
// keeping the original Graphics instance alive.
export interface WireSnapshot {
  start: Point;
  end: Point;
  direction: WireDirection;
  gridBounds: Rectangle;
}
