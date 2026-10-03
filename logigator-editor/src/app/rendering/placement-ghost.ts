import { Container, Point, PointData } from 'pixi.js';
import { NO_EXCLUDED_IDS, Project } from '../project/project';
import { Component } from '../components/component';
import { ComponentConfig } from '../components/component-config.model';
import { Wire } from '../wires/wire';
import { ConnectionPoint } from '../connection-points/connection-point';
import { applyInvalidTint } from './invalid-tint';
import { WorkModeService } from '../work-mode/work-mode.service';
import { getStaticDI } from '../utils/get-di';
import { Direction } from '@logigator/core';

/**
 * A single-component placement preview in the floating layer's drag layer: a
 * fresh instance from a config, wearing the selection look and the invalid
 * tint whenever its spot collides. The hover preview and the
 * `ComponentPlacementSession` share it, so the press-down handoff is seamless.
 *
 * The ghost follows a cursor rather than a position: the body's centre sits
 * under the pointer, snapped so the component's position stays on the grid.
 *
 * Zoom is the host's: the drag layer fans `applyScale` out to its children.
 */
export class PlacementGhost {
  private readonly _component: Component;
  private _hasCollision = false;
  // The last cursor the ghost was centred on, so a turn can re-centre.
  private readonly _cursor = new Point();

  constructor(
    private readonly project: Project,
    parent: Container<Component | Wire | ConnectionPoint>,
    config: ComponentConfig,
    cursor: PointData
  ) {
    const options = Object.fromEntries(
      Object.entries(config.options).map(([key, opt]) => [key, opt.clone()])
    );
    this._component = config.create(options);
    // The ghost starts facing the type's sticky placement direction (set by
    // the settings panel or a rotate request while placing; East until then).
    // Ghosts are always built from the palette config — the master, for a
    // custom — which is the key that map is written under.
    const direction = getStaticDI(WorkModeService).placementDirectionFor(
      config.type
    );
    if (direction !== Direction.E) {
      this._component.direction = direction;
    }
    this._component.selected = true;
    this._component.applyScale(project.scale.x);
    parent.addChild(this._component);
    this.moveTo(cursor);
  }

  /** The component a commit would add. */
  public get component(): Component {
    return this._component;
  }

  /**
   * Ends preview duty and hands the component over for committing: drops the
   * ghost's selection look so the instance is board-ready. Only a pass-through
   * commit (a built-in, which lands as the ghost itself) calls this; a frozen
   * replacement destroys the ghost instead.
   */
  public release(): Component {
    this._component.selected = false;
    return this._component;
  }

  /**
   * Turns the ghost to `direction` — the sticky placement direction its owner
   * just wrote (the settings panel's row, or a rotate request). A turn
   * reshapes the body, so the ghost re-centres on the cursor, which also
   * re-derives the collision tint.
   */
  public setDirection(direction: Direction): void {
    if (this._component.direction === direction) return;
    this._component.direction = direction;
    this.moveTo(this._cursor);
    // A turn is a visual change with no pointer move behind it (the rotate
    // shortcut), so it asks for its own frame rather than waiting for one.
    this.project.triggerTicker('single');
  }

  public get hasCollision(): boolean {
    return this._hasCollision;
  }

  /**
   * Centres the ghost's body on a grid-space cursor, snapped to the nearest
   * grid position, and re-derives its collision tint.
   */
  public moveTo(cursor: PointData): void {
    this._cursor.copyFrom(cursor);
    const position = this._component.position;
    const body = this._component.bodyGridBounds;
    // The body's centre relative to the position depends on the direction.
    position.set(
      Math.round(cursor.x - (body.x - position.x) - body.width / 2),
      Math.round(cursor.y - (body.y - position.y) - body.height / 2)
    );
    this._updateCollision();
  }

  public destroy(): void {
    this._component.destroy({ children: true });
  }

  private _updateCollision(): void {
    const collision =
      this.project.hasComponentCollision(
        this._component.gridBounds,
        this._component.bodyGridBounds
      ) ||
      this.project.hasComponentBodyWireCollision(
        this._component.bodyGridBounds,
        NO_EXCLUDED_IDS,
        this._component.ignoresWireCollision
      );
    if (collision === this._hasCollision) return;
    this._hasCollision = collision;
    applyInvalidTint(this._component, collision);
  }
}
