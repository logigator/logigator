import { Container } from 'pixi.js';
import { NO_EXCLUDED_IDS, Project } from '../../project/project';
import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
import { ConnectionPoint } from '../../connection-points/connection-point';
import { offsetRectInPlace } from '../../utils/grid';
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
    // The bounds getters hand back a fresh rect each call, so the offset goes
    // on in place: this runs over the whole dragged set on every pointer move.
    const collision =
      this._components.some((c) => {
        const bodyBounds = offsetRectInPlace(c.bodyGridBounds, offset);
        return (
          this._project.hasComponentCollision(
            offsetRectInPlace(c.gridBounds, offset),
            bodyBounds
          ) ||
          this._project.hasComponentBodyWireCollision(
            bodyBounds,
            NO_EXCLUDED_IDS,
            c.ignoresWireCollision
          )
        );
      }) ||
      this._wires.some((w) =>
        this._project.hasWireBodyCollision(
          offsetRectInPlace(w.gridBounds, offset)
        )
      );

    const changed = collision !== this._hasCollision;
    this._hasCollision = collision;
    // Re-applied on every update, not only on transitions: a mid-session
    // rotate rebuilds each component's children and its refreshTint restores
    // the selection tint over the invalid one. Tint writes are a
    // per-frame-safe fast path, so the redundant re-apply costs nothing.
    if (collision || changed) {
      this._applyTint();
    }
  }

  /**
   * Restores the elements' own tints. Sessions call this before reattaching,
   * so a cancel mid-collision does not leak the invalid tint onto the board.
   */
  reset(): void {
    if (!this._hasCollision) return;
    this._hasCollision = false;
    this._applyTint();
  }

  private _applyTint(): void {
    // The drag layer, not _components/_wires, so captured junction dots
    // riding along get the same treatment.
    for (const child of this._dragLayer.children) {
      applyInvalidTint(child, this._hasCollision);
    }
  }
}
