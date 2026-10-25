import { StateRead, StateWatchRequest } from './protocol';

/** The engine calls the reader makes. */
export interface StateEngine {
  stateVersions(compIds: Uint32Array, out: Uint32Array): void;
  readState(compId: number, offset: number, length: number): Uint8Array;
}

interface Watched {
  readonly request: StateWatchRequest;
  /** The unit's state version when the range was last read. */
  version: number;
  /** Started or moved and not read since, whatever the version says. */
  fresh: boolean;
}

/**
 * The engine state the main thread watches, read beside each snapshot. One
 * `stateVersions` call polls every watched unit into arrays kept until the
 * watch set changes, so a snapshot allocates nothing while no version moves,
 * and a range is read only when its unit's version moved since it was last
 * read — or when it was just started or moved, since nothing was read for it
 * yet. With nothing watched, the engine is not called at all.
 */
export class StateReader {
  private readonly watched = new Map<number, Watched>();
  /** The watches in polling order: `units[i]` is `order[i]`'s unit. */
  private order: Watched[] = [];
  private units = new Uint32Array(0);
  private versions = new Uint32Array(0);

  /** Starts a watch, or moves the range of the one under the same id. */
  public watch(request: StateWatchRequest): void {
    this.watched.set(request.id, {
      request,
      version: this.watched.get(request.id)?.version ?? 0,
      fresh: true
    });
    this.rebuild();
  }

  public unwatch(id: number): void {
    if (this.watched.delete(id)) {
      this.rebuild();
    }
  }

  /**
   * The ranges to send with the snapshot being taken, or `undefined` when no
   * watched unit's state moved. Call it between ticks, so every range belongs
   * to the tick the snapshot shows.
   */
  public read(engine: StateEngine): StateRead[] | undefined {
    if (this.order.length === 0) {
      return undefined;
    }
    engine.stateVersions(this.units, this.versions);
    let reads: StateRead[] | undefined;
    for (let i = 0; i < this.order.length; i++) {
      const watched = this.order[i];
      const version = this.versions[i];
      if (!watched.fresh && version === watched.version) {
        continue;
      }
      watched.fresh = false;
      watched.version = version;
      const { id, unit, offset, length } = watched.request;
      (reads ??= []).push({
        id,
        offset,
        bytes: engine.readState(unit, offset, length)
      });
    }
    return reads;
  }

  /**
   * For an engine rebuilt from the descriptor: its state is the board's
   * initial one, versions start over, and the main thread knows both, so a
   * range already sent is not read again until its unit is written. One
   * started or moved and not read yet still is.
   */
  public reset(): void {
    for (const watched of this.order) {
      watched.version = 0;
    }
  }

  private rebuild(): void {
    this.order = [...this.watched.values()];
    this.units = Uint32Array.from(this.order, ({ request }) => request.unit);
    this.versions = new Uint32Array(this.order.length);
  }
}
