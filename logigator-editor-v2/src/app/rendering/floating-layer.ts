import { Container, Graphics, Point } from 'pixi.js';
import { Component } from '../components/component';
import { Wire } from '../wires/wire';
import { ConnectionPoint } from '../connection-points/connection-point';
import { getStaticDI } from '../utils/get-di';
import { GraphicsProviderService } from './graphics-provider.service';
import { NegationBubbleGraphics } from './graphics/negation-bubble.graphics';

/**
 * The transient overlay above the committed circuit: hosts drag-session
 * ghosts (placement previews, moved selections, paste ghosts) in its
 * `dragLayer` and the port-negation hover preview. Purely visual — input
 * routing and session lifecycle live in the `WorkModeRouter`.
 */
export class FloatingLayer extends Container {
  private readonly _dragLayer = new Container<
    Component | Wire | ConnectionPoint
  >();

  // Ghost bubble shown under the cursor while in PORT_NEGATION mode, previewing
  // the port the next click would toggle. Lazily created, hidden when no port
  // is in range.
  private _negationHoverGhost: Graphics | null = null;

  constructor() {
    super();
    this.addChild(this._dragLayer);
  }

  /** The container drag sessions parent their ghost elements into. */
  public get dragLayer(): Container<Component | Wire | ConnectionPoint> {
    return this._dragLayer;
  }

  public updateScale(scale: number) {
    for (const child of this._dragLayer.children) {
      child.applyScale(scale);
    }
  }

  /** Shows the negation preview bubble at a grid-space anchor. */
  public showNegationGhost(anchor: Point): void {
    const ghost = this._ensureNegationHoverGhost();
    ghost.position.copyFrom(anchor);
    ghost.visible = true;
  }

  public hideNegationGhost(): void {
    if (this._negationHoverGhost) {
      this._negationHoverGhost.visible = false;
    }
  }

  private _ensureNegationHoverGhost(): Graphics {
    if (!this._negationHoverGhost) {
      const ghost = new Graphics(
        getStaticDI(GraphicsProviderService).getGraphicsContext(
          NegationBubbleGraphics,
          false
        )
      );
      ghost.alpha = 0.5;
      // Above components/wires since the floating layer is the top child of
      // gridSpace; shares its grid-unit coordinate space.
      this.addChild(ghost);
      this._negationHoverGhost = ghost;
    }
    return this._negationHoverGhost;
  }
}
