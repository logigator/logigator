// Clockwise from East. The numeric values are load-bearing:
//   - `rotation = value * π/2`              (Component direction → PixiJS rotation)
//   - `oppositeDir = (value + 2) % 4`       (input stub ↔ output stub flip)
// Do not reorder.
export const enum Direction {
  E = 0,
  S = 1,
  W = 2,
  N = 3
}
