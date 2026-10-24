export interface Theme {
  background: number;
  grid: number;
  wire: number;
  selectRect: number;
  /** Marquee fill while the commit would scissor wires at the rect edge. */
  scissorRect: number;
  selectTint: number;
  wireSelectColor: number;
  /**
   * Wires, port stubs and junction dots of a link in conflict during
   * simulation (drivers disagreeing). An orange, so it reads as a hint rather
   * than the placement-collision red of `invalid`.
   */
  wireConflict: number;
  /** Tint for elements in an invalid state (e.g. colliding drag ghosts). */
  invalid: number;
  fontTint: number;
  ledOn: number;
  ledOff: number;
}
