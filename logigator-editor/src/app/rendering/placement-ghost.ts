import { Container, PointData } from 'pixi.js';
import { Project } from '../project/project';
import { Component } from '../components/component';
import { ComponentConfig } from '../components/component-config.model';
import { Wire } from '../wires/wire';
import { ConnectionPoint } from '../connection-points/connection-point';
import { applyInvalidTint } from './invalid-tint';
import { WorkModeService } from '../work-mode/work-mode.service';
import { getStaticDI } from '../utils/get-di';
import { Direction } from '../utils/direction';

/**
 * A single-component placement preview living in the floating layer's drag
 * layer: a fresh instance built from a config, wearing the selection look,
 * tinted with the theme's invalid color whenever the spot it sits on
 * collides. Shared by the hover preview (the ghost under the cursor before
 * any press) and the `ComponentPlacementSession` (the same ghost while the
 * placing press is held), so the press-down handoff is seamless.
 *
 * Zoom is handled by the host: the drag layer fans `applyScale` out to its
 * children on every zoom change.
 */
export class PlacementGhost {
  private readonly _component: Component;
  private _hasCollision = false;

  constructor(
    private readonly project: Project,
    parent: Container<Component | Wire | ConnectionPoint>,
    config: ComponentConfig,
    startPos: PointData
  ) {
    const options = Object.fromEntries(
      Object.entries(config.options).map(([key, opt]) => [key, opt.clone()])
    );
    this._component = config.create(options);
    // The ghost starts facing the type's sticky placement direction (set by
    // the settings panel while placing; East until then).
    const direction = getStaticDI(WorkModeService).placementDirectionFor(
      config.type
    );
    if (direction !== Direction.E) {
      this._component.direction = direction;
    }
    // The ghost wears the selection look (theme-keyed tint).
    this._component.selected = true;
    this._component.applyScale(project.scale.x);
    parent.addChild(this._component);
    this.moveTo(startPos);
  }

  /** The ghost instance itself — the component a commit would add. */
  public get component(): Component {
    return this._component;
  }

  /**
   * Ends preview duty and hands the component over for committing: drops the
   * ghost's selection look so the instance is board-ready. The caller adds it
   * to the project (re-parenting it out of the drag layer) and must not call
   * {@link destroy} afterwards.
   */
  public release(): Component {
    this._component.selected = false;
    return this._component;
  }

  public get hasCollision(): boolean {
    return this._hasCollision;
  }

  /** Moves the ghost to a grid position and re-derives its collision tint. */
  public moveTo(gridPos: PointData): void {
    this._component.position.copyFrom(gridPos);
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
        new Set(),
        this._component.ignoresWireCollision
      );
    if (collision === this._hasCollision) return;
    this._hasCollision = collision;
    applyInvalidTint(this._component, collision);
  }
}
