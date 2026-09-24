import { LinkRenderTargets } from '../compiler/compiled-board.model';

/**
 * The snapshot-consuming face of {@link LinkStateApplier}. One incoming
 * snapshot fans out to the board's applier and every registered watch applier.
 */
export interface SnapshotApplier {
  applyDelta(ids: Uint32Array, packedValues: Uint8Array): void;
  applyFull(packedBits: Uint8Array): void;
}

/**
 * Applies simulator link states to the canvas: powered links draw their wires
 * and port stubs thick. Tracks current per-link state, so full snapshots only
 * touch changed links. Callers own frame scheduling.
 *
 * A watch applier is another instance over a sparse target array sized to the
 * full link count: only the watched circuit's links carry targets.
 */
export class LinkStateApplier implements SnapshotApplier {
  private readonly _powered: boolean[];
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

  /** Everything unpowered. */
  public reset(): void {
    for (let link = 0; link < this._powered.length; link++) {
      this.setLink(link, false);
    }
  }
}
