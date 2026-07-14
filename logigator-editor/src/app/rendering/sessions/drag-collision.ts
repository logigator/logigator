import { Container, Rectangle } from 'pixi.js';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
import { ConnectionPoint } from '../../connection-points/connection-point';
import { getStaticDI } from '../../utils/get-di';
import { ThemingService } from '../../theming/theming.service';

/**
 * Shared collision detection for drag sessions that move components and wires
 * over a drag layer. Tints the dragged elements with the theme's invalid color
 * on collision and restores their own tints otherwise. The elements are tinted
 * directly rather than through the drag layer: a container tint multiplies
 * with the children's own tints (wires carry their color AS tint over a white
 * base), which would darken the invalid red toward black.
 *
 * Single-component placement keeps its own direct-tint variant inline, since
 * it differs enough not to share this.
 */
export class DragCollisionState {
  private readonly _themingService = getStaticDI(ThemingService);

  private _hasCollision = false;

  constructor(
    private readonly _project: Project,
    private readonly _dragLayer: Container<Component | Wire | ConnectionPoint>,
    private readonly _components: Component[],
    private readonly _wires: Wire[]
  ) {}

  get hasCollision(): boolean {
    return this._hasCollision;
  }

  update(): void {
    const collision =
      this._components.some(
        (c) =>
          this._project.hasComponentCollision(
            this._componentBoundsWorld(c),
            this._componentBodyBoundsWorld(c)
          ) ||
          this._project.hasComponentBodyWireCollision(
            this._componentBodyBoundsWorld(c),
            new Set(),
            c.ignoresWireCollision
          )
      ) ||
      this._wires.some((w) =>
        this._project.hasWireBodyCollision(this._wireBoundsWorld(w))
      );

    if (collision === this._hasCollision) return;
    this._hasCollision = collision;
    this._applyTint();
  }

  /**
   * Restores the elements' own tints if a collision tint is still applied.
   * Sessions call this before reattaching the elements to the project, so a
   * cancel mid-collision does not leak the invalid tint back onto the board.
   */
  reset(): void {
    if (!this._hasCollision) return;
    this._hasCollision = false;
    this._applyTint();
  }

  private _applyTint(): void {
    // Iterates the drag layer instead of _components/_wires so captured
    // junction dots riding along in the layer get the same treatment.
    const invalid = this._themingService.currentTheme().invalid;
    for (const child of this._dragLayer.children) {
      if (this._hasCollision) child.tint = invalid;
      else child.refreshTint();
    }
  }

  private _componentBoundsWorld(comp: Component): Rectangle {
    const b = comp.gridBounds;
    return new Rectangle(
      b.x + this._dragLayer.position.x,
      b.y + this._dragLayer.position.y,
      b.width,
      b.height
    );
  }

  private _componentBodyBoundsWorld(comp: Component): Rectangle {
    const b = comp.bodyGridBounds;
    return new Rectangle(
      b.x + this._dragLayer.position.x,
      b.y + this._dragLayer.position.y,
      b.width,
      b.height
    );
  }

  private _wireBoundsWorld(wire: Wire): Rectangle {
    const b = wire.gridBounds;
    return new Rectangle(
      b.x + this._dragLayer.position.x,
      b.y + this._dragLayer.position.y,
      b.width,
      b.height
    );
  }
}
