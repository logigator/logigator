import { Container, Rectangle } from 'pixi.js';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';

/**
 * Shared collision detection for drag sessions that move components and wires
 * over a drag layer. Tints the drag layer red on collision, white otherwise.
 *
 * Used by PastePlacementSession and SelectionMoveSession.
 * ComponentPlacementSession has a single-component, direct-tint variant
 * that is different enough to keep inline.
 */
export class DragCollisionState {
  private _hasCollision = false;

  constructor(
    private readonly _project: Project,
    private readonly _dragLayer: Container,
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
    this._dragLayer.tint = collision ? 0xff4444 : 0xffffff;
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
