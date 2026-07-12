import { StaticGraphicsContext } from './static-graphics-context';

/** Thickness of a powered wire/stub during simulation (unpowered = 1). */
export const POWERED_WIRE_THICKNESS = 3;

/**
 * Cross-axis pivot that keeps the powered scale-up centred: the unit rect
 * spans y ∈ [0, 1], and scaling by t about pivot (t-1)/(2t) lands on
 * y ∈ [-(t-1)/2, 1+(t-1)/2] — the extra thickness extends symmetrically
 * around the unpowered pixel. Holds for mirrored (negative) scales too.
 */
export const POWERED_WIRE_PIVOT =
  (POWERED_WIRE_THICKNESS - 1) / (2 * POWERED_WIRE_THICKNESS);

export class WireGraphics extends StaticGraphicsContext {
  // White base: the wire's color (theme wire color, or the selection color)
  // lives entirely in the per-instance tint — white × tint = the tint exactly.
  // Keeps the context theme-independent, so a theme change retints instances
  // instead of swapping contexts.
  public static override readonly themeIndependent = true;

  constructor() {
    super();

    // A 1×1 rect hanging its thickness on the +y side of the centre-line.
    // Powered thickness is expressed by the owning Graphics' cross-axis scale
    // (with POWERED_WIRE_PIVOT keeping it centred), never by a context swap:
    // reassigning a Graphics context detaches/re-attaches listeners on the
    // shared context (a linear scan over every attached wire/stub) and flags
    // the render group for a full instruction rebuild, while transform
    // changes patch the batch in place.
    this.rect(0, 0, 1, 1);
    this.fill(0xffffff);
  }
}
