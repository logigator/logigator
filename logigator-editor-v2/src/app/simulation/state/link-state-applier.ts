import { LinkRenderTargets } from '../compiler/compiled-board.model';

/**
 * Applies simulator link states to the canvas: powered links draw their wires
 * and port stubs thick. Constructed per simulation session with the top-level
 * {@link LinkRenderTargets}; tracks current per-link state so full snapshots
 * only touch changed links. Callers own frame scheduling — while running, the
 * ticker is already `'on'`; a manual step triggers `'single'`.
 */
export class LinkStateApplier {
  private readonly _powered: boolean[];

  constructor(private readonly targets: readonly LinkRenderTargets[]) {
    this._powered = targets.map(() => false);
  }

  public setLink(linkId: number, powered: boolean): void {
    const target = this.targets[linkId];
    if (!target || this._powered[linkId] === powered) {
      return;
    }
    this._powered[linkId] = powered;
    for (const wire of target.wires) {
      wire.setPowered(powered);
    }
    for (const { component, portIndex } of target.ports) {
      component.setPortPowered(portIndex, powered);
    }
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
