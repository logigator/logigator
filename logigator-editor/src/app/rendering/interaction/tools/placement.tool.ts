import { Point } from 'pixi.js';
import { Project } from '../../../project/project';
import { ComponentConfig } from '../../../components/component-config.model';
import { CustomComponentService } from '../../../custom-component/custom-component.service';
import { WorkMode } from '../../../work-mode/work-mode.enum';
import { WorkModeService } from '../../../work-mode/work-mode.service';
import { getStaticDI } from '../../../utils/get-di';
import { roundToGrid } from '../../../utils/grid';
import { PlacementGhost } from '../../placement-ghost';
import { ComponentPlacementSession } from '../../sessions/component-placement.session';
import { PointerInput } from '../pointer-input';
import { BoardTool, ToolHost } from './board-tool';

/**
 * Hovers the component the next press would place and opens the placement
 * session when the press lands. The config comes from the palette via
 * {@link setConfig}.
 */
export class PlacementTool implements BoardTool {
  private readonly _customComponents = getStaticDI(CustomComponentService);

  private _config: ComponentConfig | null = null;

  // Torn down whenever its context changes (mode, project, palette
  // selection) or a session takes over.
  private _hoverGhost: PlacementGhost | null = null;
  private _hoverGhostConfig: ComponentConfig | null = null;
  private _hoverGhostProject: Project | null = null;

  public setConfig(value: ComponentConfig | null): void {
    if (value !== this._hoverGhostConfig) {
      // The next hover rebuilds the ghost from the new config.
      this._destroyHoverGhost();
    }
    this._config = value;
  }

  public down(project: Project, input: PointerInput, host: ToolHost): void {
    if (!this._config) return;
    void this._beginPlacement(
      project,
      this._config,
      roundToGrid(input.grid, true),
      host
    );
  }

  /**
   * Follows the cursor with the same ghost the placement session shows once
   * the press lands, so the handoff is seamless. Skipped while a session is
   * active, since its own ghosts own the preview.
   */
  public hover(project: Project, input: PointerInput, host: ToolHost): void {
    const config = this._config;
    if (host.hasActiveSession || !config) {
      this._destroyHoverGhost();
      return;
    }
    const snapped = roundToGrid(input.grid, true);
    if (this._hoverGhost) {
      // The settings panel may have written the sticky direction since this
      // ghost was built; it follows on the next move rather than waiting for
      // the pointer to leave and re-enter the board.
      this._hoverGhost.setDirection(
        getStaticDI(WorkModeService).placementDirectionFor(config.type)
      );
      this._hoverGhost.moveTo(snapped);
    } else {
      // A master previews from its own config; snapshotting stays a
      // commit-time effect of the placement session.
      this._hoverGhost = new PlacementGhost(
        project,
        project.floatingLayer.dragLayer,
        config,
        snapped
      );
      this._hoverGhostConfig = config;
      this._hoverGhostProject = project;
    }
    project.triggerTicker('single');
  }

  public deactivate(): void {
    this._destroyHoverGhost();
  }

  /**
   * A rotate request while the ghost is only hovering: steps the sticky
   * placement direction and turns the live preview. Without a preview (the
   * pointer is off the board) the step still sticks, so the ghost is already
   * turned when it next appears.
   */
  public rotate(steps: number): boolean {
    const config = this._config;
    if (!config) return false;
    const direction = getStaticDI(WorkModeService).rotatePlacementDirection(
      config.type,
      steps
    );
    this._hoverGhost?.setDirection(direction);
    return true;
  }

  /** The session's own ghost takes over the preview (a visually identical
   *  ghost at the same spot — a seamless handoff). */
  public onSessionStart(): void {
    this._destroyHoverGhost();
  }

  /**
   * Opens the placement session, loading a cloud custom master's circuit
   * first — deferred to place-time rather than palette-select. The ensure is
   * a microtask no-op for everything already cached, so only a first,
   * uncached cloud master awaits. The host's gesture stamp keeps a stale load
   * from opening a session with no pointer to drive it.
   */
  private async _beginPlacement(
    project: Project,
    config: ComponentConfig,
    startGrid: Point,
    host: ToolHost
  ): Promise<void> {
    const seq = host.bumpGestureSeq();
    const ready = await this._customComponents.ensureMasterCircuit(config.type);
    if (
      !ready ||
      seq !== host.gestureSeq ||
      host.hasActiveSession ||
      host.project !== project ||
      host.mode !== WorkMode.COMPONENT_PLACEMENT
    ) {
      return;
    }
    host.startSession(
      new ComponentPlacementSession(
        project,
        project.floatingLayer.dragLayer,
        startGrid,
        config
      )
    );
  }

  private _destroyHoverGhost(): void {
    if (!this._hoverGhost) return;
    this._hoverGhost.destroy();
    this._hoverGhost = null;
    this._hoverGhostConfig = null;
    this._hoverGhostProject?.triggerTicker('single');
    this._hoverGhostProject = null;
  }
}
