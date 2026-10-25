import { LinkRenderTargets } from '../compiler/compiled-board.model';

/**
 * The snapshot-consuming face of {@link LinkStateApplier}. One incoming
 * snapshot fans out to the board's applier and every registered watch applier.
 */
export interface SnapshotApplier {
  applyDelta(ids: Uint32Array, packedValues: Uint8Array): void;
  applyFull(packedBits: Uint8Array): void;
  /**
   * Every link in conflict (the engine's invalid links), ascending — the
   * whole set, with every snapshot. The view is only valid for the call.
   */
  applyConflicts(ids: Uint32Array): void;
}

/** No link in conflict: what a session that shows none applies. */
export const NO_CONFLICTS = new Uint32Array(0);

/**
 * Applies simulator link states to the canvas: powered links draw their wires
 * and port stubs thick, conflicting links tint them and their junction dots
 * with the conflict color.
 * Tracks current per-link state, so full snapshots and conflict sets only
 * touch changed links. Callers own frame scheduling.
 *
 * A watch applier is another instance over a sparse target array sized to the
 * full link count: only the watched circuit's links carry targets.
 */
export class LinkStateApplier implements SnapshotApplier {
  private readonly _powered: boolean[];
  /** The conflict set as last applied, ascending, for the next diff. */
  private _conflicts: readonly number[] = [];
  /** Conflicting links that have a wire or port stub to tint. */
  private _shownConflicts = 0;
  private _changed = false;
  private _switchedLinks = 0;

  constructor(private readonly targets: readonly LinkRenderTargets[]) {
    this._powered = targets.map(() => false);
  }

  public setLink(linkId: number, powered: boolean): void {
    const target = this.targets[linkId];
    if (!target || this._powered[linkId] === powered) {
      return;
    }
    if (target.wires.length > 0 || target.ports.length > 0) {
      this._changed = true;
      this._switchedLinks++;
    }
    this._powered[linkId] = powered;
    for (const wire of target.wires) {
      wire.setPowered(powered);
    }
    for (const { component, portIndex } of target.ports) {
      component.setPortPowered(portIndex, powered);
    }
  }

  private _setConflict(linkId: number, conflict: boolean): void {
    const target = this.targets[linkId];
    // A junction dot never stands alone: it sits on a wire end or a port.
    if (!target || (target.wires.length === 0 && target.ports.length === 0)) {
      return;
    }
    this._changed = true;
    this._shownConflicts += conflict ? 1 : -1;
    for (const wire of target.wires) {
      wire.setConflict(conflict);
    }
    for (const { component, portIndex } of target.ports) {
      component.setPortConflict(portIndex, conflict);
    }
    for (const junction of target.junctions) {
      junction.setConflict(conflict);
    }
  }

  /**
   * The full conflict set: a merge over it and the set last applied, both
   * ascending, so only links entering or leaving conflict are touched, and
   * the usual empty-after-empty costs nothing.
   */
  public applyConflicts(ids: Uint32Array): void {
    const previous = this._conflicts;
    if (ids.length === 0 && previous.length === 0) {
      return;
    }
    let moved = false;
    let i = 0;
    let j = 0;
    while (i < previous.length || j < ids.length) {
      const before = i < previous.length ? previous[i] : Infinity;
      const now = j < ids.length ? ids[j] : Infinity;
      if (before === now) {
        i++;
        j++;
        continue;
      }
      moved = true;
      if (before < now) {
        this._setConflict(before, false);
        i++;
      } else {
        this._setConflict(now, true);
        j++;
      }
    }
    // Copied: the view points into a buffer the bridge hands back.
    if (moved) {
      this._conflicts = Array.from(ids);
    }
  }

  /**
   * Whether some link in conflict has a wire or port stub this applier tints
   * — for the board's applier, a conflict visible on the board.
   */
  public get hasShownConflict(): boolean {
    return this._shownConflicts > 0;
  }

  /** Whether the given link is currently powered. */
  public isPowered(linkId: number): boolean {
    return this._powered[linkId] === true;
  }

  /** Whether any *targeted* link changed since the last call; consuming
   * resets the flag. Drives on-demand re-renders of watch canvases. */
  public consumeChanged(): boolean {
    const changed = this._changed;
    this._changed = false;
    return changed;
  }

  /** Debug count of flips on links that have a wire or port stub. */
  public get switchedLinks(): number {
    return this._switchedLinks;
  }

  /** Size of the dense link-id space. */
  public get totalLinks(): number {
    return this._powered.length;
  }

  /** Delta snapshot: bit `i` of `packedValues` is the new state of `ids[i]`. */
  public applyDelta(ids: Uint32Array, packedValues: Uint8Array): void {
    for (let i = 0; i < ids.length; i++) {
      this.setLink(ids[i], ((packedValues[i >> 3] >> (i & 7)) & 1) === 1);
    }
  }

  /** Full snapshot: link `l` is byte `l >> 3`, bit `l & 7` of `packedBits`. */
  public applyFull(packedBits: Uint8Array): void {
    for (let link = 0; link < this._powered.length; link++) {
      this.setLink(link, ((packedBits[link >> 3] >> (link & 7)) & 1) === 1);
    }
  }

  /** Everything unpowered and out of conflict. */
  public reset(): void {
    for (let link = 0; link < this._powered.length; link++) {
      this.setLink(link, false);
    }
    this.applyConflicts(NO_CONFLICTS);
  }
}
