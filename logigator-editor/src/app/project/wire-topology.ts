import { Point, Rectangle } from 'pixi.js';
import { Wire } from '../wires/wire';
import { WireDirection } from '../wires/wire-direction.enum';
import {
  IntegrationInput,
  IntegrationOutput,
  WireIntegrator
} from './wire-integrator';
import { ActionContainer } from '../actions/action-container';
import { AddWiresAction } from '../actions/actions/add-wires.action';
import { RemoveWiresAction } from '../actions/actions/remove-wires.action';
import { getStaticDI } from '../utils/get-di';
import { LoggingService } from '../logging/logging.service';
import type { Project } from './project';

/**
 * The project's wire-topology editor: owns the {@link WireIntegrator} (the
 * split/merge invariant restorer every structural mutation runs through) and
 * the wire tool's connection toggling — joining the wires that meet at a
 * junction dot, or splitting a pure crossing into four wires so a dot appears.
 */
export class WireTopology {
  private readonly _integrator = new WireIntegrator();
  private readonly _logging = getStaticDI(LoggingService);

  constructor(private readonly project: Project) {}

  /**
   * Restores the wire invariants around a structural change: splits wires
   * whose interiors gained a termination, merges collinear pairs that lost
   * one. Returns the wires the caller must add/remove; mutates nothing itself.
   */
  public integrate(input: IntegrationInput): IntegrationOutput {
    return this._integrator.integrate(
      input,
      (rect) => this.project.queryWiresInRange(rect),
      (rect) => this.project.queryComponentsInRange(rect),
      this.project.scale.x
    );
  }

  public toggleConnectionAt(p: Point): void {
    if (this.project.connectionPoints.hasCpAt(p)) {
      this._joinAt(p);
    } else {
      this._splitAt(p);
    }
  }

  /**
   * What {@link toggleConnectionAt} would do at a half-grid point: 'join'
   * merges the wires ending at an existing CP, 'split' cuts a pure crossing,
   * `null` means the tap would be a no-op. Non-mutating — the join case
   * dry-runs the full plan (including the blocked re-split check, so a
   * T-junction reports `null`) and discards it. Drives the wire tool's
   * hover ghost.
   */
  public connectionToggleKindAt(p: Point): 'join' | 'split' | null {
    if (this.project.connectionPoints.hasCpAt(p)) {
      const plan = this._planJoinAt(p);
      if (!plan) return null;
      plan.discard();
      return 'join';
    }
    return this._findCrossingAt(p) ? 'split' : null;
  }

  private _joinAt(p: Point): void {
    const plan = this._planJoinAt(p);
    if (!plan) {
      this._logging.debug(
        `join at (${p.x}, ${p.y}) is a no-op: no collinear pair to merge, or the merge would re-split at the same point`,
        'WireTopology'
      );
      return;
    }

    const action = new ActionContainer();
    if (plan.toRemove.length > 0)
      action.add(new RemoveWiresAction(...plan.toRemove));
    if (plan.toAdd.length > 0) action.add(new AddWiresAction(...plan.toAdd));
    plan.discard();
    this.project.actionManager.push(action);
  }

  /**
   * Builds the join plan for a CP point without mutating the project: merges
   * each collinear pair ending at `p` and integrates the result. Returns
   * `null` when there is nothing to merge or the integrator would re-split at
   * `p` (a third terminator blocks the merge — the T-junction case). The
   * caller must `discard()` the plan after using it (the actions snapshot the
   * wires in their constructors) — it destroys the temporary instances.
   */
  private _planJoinAt(
    p: Point
  ): { toAdd: Wire[]; toRemove: Wire[]; discard(): void } | null {
    const queryRect = new Rectangle(p.x - 1, p.y - 1, 2, 2);
    const hWires: Wire[] = [];
    const vWires: Wire[] = [];

    for (const w of this.project.queryWiresInRange(queryRect)) {
      const [s, e] = w.connectionPoints;
      if ((s.x === p.x && s.y === p.y) || (e.x === p.x && e.y === p.y)) {
        if (w.direction === WireDirection.HORIZONTAL) hWires.push(w);
        else vWires.push(w);
      }
    }

    const addedWires: Wire[] = [];
    const removedWires: Wire[] = [];

    if (hWires.length === 2) {
      removedWires.push(...hWires);
      addedWires.push(Wire.merge(hWires[0], hWires[1]));
    }

    if (vWires.length === 2) {
      removedWires.push(...vWires);
      addedWires.push(Wire.merge(vWires[0], vWires[1]));
    }

    if (addedWires.length === 0) return null;

    const { toAdd, toRemove } = this.integrate({
      addedWires,
      removedWires
    });

    const discard = () => {
      for (const w of addedWires) if (!w.destroyed) w.destroy();
      for (const w of toAdd) if (!w.destroyed) w.destroy();
    };

    const blocked = toAdd.some((w) => {
      const [s, e] = w.connectionPoints;
      return (s.x === p.x && s.y === p.y) || (e.x === p.x && e.y === p.y);
    });

    if (blocked) {
      discard();
      return null;
    }

    return { toAdd, toRemove, discard };
  }

  /** The pure 2-wire X crossing at `p` (neither wire ending there), if any. */
  private _findCrossingAt(p: Point): { hWire: Wire; vWire: Wire } | null {
    const queryRect = new Rectangle(p.x - 1, p.y - 1, 2, 2);
    let hWire: Wire | null = null;
    let vWire: Wire | null = null;

    for (const w of this.project.queryWiresInRange(queryRect)) {
      if (!w.contains(p)) continue;
      const [s, e] = w.connectionPoints;
      if ((s.x === p.x && s.y === p.y) || (e.x === p.x && e.y === p.y))
        continue;
      if (w.direction === WireDirection.HORIZONTAL) hWire = w;
      else vWire = w;
    }

    return hWire && vWire ? { hWire, vWire } : null;
  }

  private _splitAt(p: Point): void {
    const crossing = this._findCrossingAt(p);
    if (!crossing) {
      this._logging.debug(
        `split at (${p.x}, ${p.y}) is a no-op: needs both a horizontal and a vertical wire crossing the point`,
        'WireTopology'
      );
      return;
    }

    const [hLeft, hRight] = Wire.split(crossing.hWire, p);
    const [vTop, vBottom] = Wire.split(crossing.vWire, p);

    const addedWires = [hLeft, hRight, vTop, vBottom];
    const removedWires = [crossing.hWire, crossing.vWire];

    const { toAdd, toRemove } = this.integrate({
      addedWires,
      removedWires
    });

    const action = new ActionContainer();
    if (toRemove.length > 0) action.add(new RemoveWiresAction(...toRemove));
    if (toAdd.length > 0) action.add(new AddWiresAction(...toAdd));
    for (const w of addedWires) if (!w.destroyed) w.destroy();
    this.project.actionManager.push(action);
  }
}
