import { Point, Rectangle } from 'pixi.js';
import { Project } from '../../../project/project';
import { Component, PortSide } from '../../../components/component';
import { CUSTOM_TYPE_ID_BASE } from '../../../components/component-type.enum';
import { TogglePortNegationAction } from '../../../actions/actions/toggle-port-negation.action';
import { roundToHalfGrid } from '../../../utils/grid';
import { WireToolSession } from '../../sessions/wire-tool.session';
import { PointerInput } from '../pointer-input';
import { BoardTool, ToolHost } from './board-tool';

/** Tap tolerance (grid units) for hitting a port with the wire tool. */
const PORT_HIT_TOLERANCE = 0.5;

interface PortHit {
  comp: Component;
  side: PortSide;
  index: number;
}

/**
 * The wire tool: a drag draws wires (via {@link WireToolSession}); a press
 * that never leaves its grid step is a tap — a port within tolerance toggles
 * its negation bubble, otherwise the nearest half-grid point toggles the wire
 * connection there (join/split). Hovering previews exactly what the next tap
 * would do.
 */
export class WireTool implements BoardTool {
  public down(project: Project, input: PointerInput, host: ToolHost): void {
    // Cloned before the inline rounding below: the tap fallback needs the
    // unsnapped position for the port hit test.
    const tapPoint = input.grid.clone();
    host.startSession(
      new WireToolSession(
        project,
        project.floatingLayer.dragLayer,
        roundToHalfGrid(input.grid, true),
        () => this._tap(project, tapPoint)
      )
    );
  }

  public hover(project: Project, input: PointerInput): void {
    this._updateGhosts(project, input.grid);
    project.triggerTicker('single');
  }

  public deactivate(project: Project): void {
    project.floatingLayer.hideWireToolGhosts();
    project.triggerTicker('single');
  }

  /**
   * Previews what a tap at the point would do: the negation bubble for a port
   * in reach (which wins over a junction — same precedence as {@link _tap}),
   * else the connection-toggle ghost, else nothing.
   */
  private _updateGhosts(project: Project, gridPoint: Point): void {
    const hit = this._findPortAt(project, gridPoint);
    if (hit) {
      project.floatingLayer.hideConnectionGhost();
      project.floatingLayer.showNegationGhost(
        hit.comp.negationBubbleAnchor(hit.side, hit.index),
        hit.side,
        hit.comp.rotation,
        hit.comp.isPortNegated(hit.side, hit.index)
      );
      return;
    }
    project.floatingLayer.hideNegationGhost();
    const p = roundToHalfGrid(gridPoint);
    const kind = project.topology.connectionToggleKindAt(p);
    if (kind) {
      project.floatingLayer.showConnectionGhost(p, kind);
    } else {
      project.floatingLayer.hideConnectionGhost();
    }
  }

  private _tap(project: Project, gridPoint: Point): void {
    const hit = this._findPortAt(project, gridPoint);
    if (hit) {
      project.actionManager.push(
        new TogglePortNegationAction(
          hit.comp.id,
          hit.side,
          hit.index,
          !hit.comp.isPortNegated(hit.side, hit.index)
        )
      );
    } else {
      project.topology.toggleConnectionAt(roundToHalfGrid(gridPoint));
    }
    // The toggle changed what the next tap here would do (split ⇄ join) —
    // re-derive the preview in place instead of leaving the stale ghost.
    this._updateGhosts(project, gridPoint);
  }

  /**
   * Nearest negatable port to a grid-space point, within tolerance. Uses the
   * quad-tree range query (never iterates every component) and rejects placed
   * custom instances — their external ports are not independently negatable.
   */
  private _findPortAt(project: Project, localPoint: Point): PortHit | null {
    const queryRect = new Rectangle(
      localPoint.x - PORT_HIT_TOLERANCE,
      localPoint.y - PORT_HIT_TOLERANCE,
      PORT_HIT_TOLERANCE * 2,
      PORT_HIT_TOLERANCE * 2
    );
    for (const comp of project.queryComponentsInRange(queryRect)) {
      if (comp.config.type >= CUSTOM_TYPE_ID_BASE) continue;
      const points = comp.connectionPoints;
      for (let i = 0; i < points.length; i++) {
        const dx = points[i].x - localPoint.x;
        const dy = points[i].y - localPoint.y;
        if (dx * dx + dy * dy <= PORT_HIT_TOLERANCE * PORT_HIT_TOLERANCE) {
          const side: PortSide = i < comp.numInputs ? 'in' : 'out';
          return {
            comp,
            side,
            index: side === 'in' ? i : i - comp.numInputs
          };
        }
      }
    }
    return null;
  }
}
