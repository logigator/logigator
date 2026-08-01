export interface Theme {
  background: number;
  grid: number;
  wire: number;
  selectRect: number;
  /** Marquee fill while the commit would scissor wires at the rect edge. */
  scissorRect: number;
  selectTint: number;
  wireSelectColor: number;
  /** Tint for elements in an invalid state (e.g. colliding drag ghosts). */
  invalid: number;
  fontTint: number;
  ledOn: number;
  ledOff: number;
}
