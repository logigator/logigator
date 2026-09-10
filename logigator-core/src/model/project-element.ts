/** A single v0 element: a component instance or a wire. */
export interface ProjectElement {
  /** Type id. */
  t: number;
  /** Number of outputs. */
  o?: number;
  /** Number of inputs. */
  i?: number;
  /** Position [x, y] in grid units. */
  p: [number, number];
  /** End position of a wire, in grid units. */
  q?: [number, number];
  /** Rotation. */
  r?: number;
  /** Numerical option slots, up to 64. */
  n?: number[];
  /** String option slot, up to 32768 chars. */
  s?: string;
  /** Negated input-port indices, 0-based within the group. */
  negInputs?: number[];
  /** Negated output-port indices, 0-based within the group. */
  negOutputs?: number[];
}
