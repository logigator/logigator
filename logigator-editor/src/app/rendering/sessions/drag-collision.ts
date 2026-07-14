import { Container } from 'pixi.js';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
import { ConnectionPoint } from '../../connection-points/connection-point';
import { offsetRect } from '../../utils/grid';
import { applyInvalidTint } from '../invalid-tint';

/**
 * Shared collision detection for drag sessions that move components and wires
 * over a drag layer. Tints the dragged elements with the theme's invalid color
 * on collision and restores their own tints otherwise (see applyInvalidTint
 * for why the elements are tinted directly, not through the layer).
 */
export class DragCollisionState {
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
    const offset = this._dragLayer.position;
    const collision =
      this._components.some(
        (c) =>
          this._project.hasComponentCollision(
            offsetRect(c.gridBounds, offset),
            offsetRect(c.bodyGridBounds, offset)
          ) ||
          this._project.hasComponentBodyWireCollision(
            offsetRect(c.bodyGridBounds, offset),
            new Set(),
            c.ignoresWireCollision
          )
      ) ||
      this._wires.some((w) =>
        this._project.hasWireBodyCollision(offsetRect(w.gridBounds, offset))
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
    for (const child of this._dragLayer.children) {
      applyInvalidTint(child, this._hasCollision);
    }
  }
}
