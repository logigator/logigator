import { Container, PointData } from 'pixi.js';
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
 * Zoom is the host's: the drag layer fans `applyScale` out to its children.
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
    // Faces the type's sticky placement direction; East until one is set.
    const direction = getStaticDI(WorkModeService).placementDirectionFor(
      config.type
    );
    if (direction !== Direction.E) {
      this._component.direction = direction;
    }
    this._component.selected = true;
    this._component.applyScale(project.scale.x);
    parent.addChild(this._component);
    this.moveTo(startPos);
  }

  /** The component a commit would add. */
  public get component(): Component {
    return this._component;
  }

  /**
   * Ends preview duty and hands the component over board-ready, dropping the
   * ghost's selection look. The caller adds it
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
        NO_EXCLUDED_IDS,
        this._component.ignoresWireCollision
      );
    if (collision === this._hasCollision) return;
    this._hasCollision = collision;
    applyInvalidTint(this._component, collision);
  }
}
