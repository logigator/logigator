import { Point, Rectangle } from 'pixi.js';
import { Project } from '../../../project/project';
import { Component, PortSide } from '../../../components/component';
import { acceptsPortNegation } from '../../../components/port-negation';
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
 * A drag draws wires; a press that never leaves its grid step is a tap, where
 * a port within tolerance toggles its negation bubble and otherwise the
 * nearest half-grid point toggles its wire connection. Hovering previews what
 * the next tap would do.
 */
export class WireTool implements BoardTool {
  public down(project: Project, input: PointerInput, host: ToolHost): void {
    // The tap fallback needs the unsnapped position for the port hit test.
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
   * Previews what a tap would do: the negation bubble for a port in reach
   * (which wins over a junction, as in {@link _tap}), else the
   * connection-toggle ghost, else nothing.
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
    // The toggle flipped what the next tap here would do (split ⇄ join).
    this._updateGhosts(project, gridPoint);
  }

  /**
   * Nearest negatable port to a grid-space point, within tolerance. A type
   * {@link acceptsPortNegation} refuses is skipped unless the port already
   * carries a bubble, which stays removable.
   *
   * Two tips coincide where an output stub meets an input head-on, so reach
   * alone cannot say which port a tap means. The pick is the port whose
   * bubble anchor is nearest — the side of the tip the pointer is on, which
   * is the bubble the hover ghost draws.
   */
  private _findPortAt(project: Project, localPoint: Point): PortHit | null {
    const queryRect = new Rectangle(
      localPoint.x - PORT_HIT_TOLERANCE,
      localPoint.y - PORT_HIT_TOLERANCE,
      PORT_HIT_TOLERANCE * 2,
      PORT_HIT_TOLERANCE * 2
    );
    let best: PortHit | null = null;
    let bestAnchorDist = Infinity;
    for (const comp of project.queryComponentsInRange(queryRect)) {
      const negatable = acceptsPortNegation(comp.config.type);
      const points = comp.connectionPoints;
      for (let i = 0; i < points.length; i++) {
        const dx = points[i].x - localPoint.x;
        const dy = points[i].y - localPoint.y;
        if (dx * dx + dy * dy > PORT_HIT_TOLERANCE * PORT_HIT_TOLERANCE) {
          continue;
        }
        const side: PortSide = i < comp.numInputs ? 'in' : 'out';
        const index = side === 'in' ? i : i - comp.numInputs;
        if (!negatable && !comp.isPortNegated(side, index)) continue;
        const anchor = comp.negationBubbleAnchor(side, index);
        const ax = anchor.x - localPoint.x;
        const ay = anchor.y - localPoint.y;
        const anchorDist = ax * ax + ay * ay;
        if (anchorDist < bestAnchorDist) {
          bestAnchorDist = anchorDist;
          best = { comp, side, index };
        }
      }
    }
    return best;
  }
}
