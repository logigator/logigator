import type { Records } from '@logigator/sim/wasm';
import { RecordRead, RecordWatchRequest } from './protocol';

/** The engine calls the reader makes. */
export interface RecordEngine {
  stateVersions(compIds: Uint32Array, out: Uint32Array): void;
  readRecords(compId: number, since: number): Records;
}

interface Watched {
  readonly id: number;
  readonly unit: number;
  /** The index of the next record to read. */
  since: number;
  /** The recorder's state version, its record count, when last read. */
  version: number;
  /** Started and not read since, whatever the version says. */
  fresh: boolean;
}

/**
 * The recorders the main thread watches, read beside each snapshot. A
 * recorder's state version is its record count, so one `stateVersions` call
 * polls every watched unit into arrays kept until the watch set changes, and
 * a recorder is read only when its count moved since it was last read, or
 * when its watch was just started. Each read starts where the last one ended,
 * so every record is sent once; with nothing watched, the engine is not
 * called at all.
 */
export class RecordReader {
  private readonly watched = new Map<number, Watched>();
  /** The watches in polling order: `units[i]` is `order[i]`'s unit. */
  private order: Watched[] = [];
  private units = new Uint32Array(0);
  private versions = new Uint32Array(0);

  /** Starts a watch, or restarts the one under the same id at `since`. */
  public watch(request: RecordWatchRequest): void {
    this.watched.set(request.id, {
      id: request.id,
      unit: request.unit,
      since: request.since,
      version: 0,
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
   * The records to send with the snapshot being taken, or `undefined` when no
   * watched recorder holds one not sent yet. Call it between ticks, so every
   * record belongs to the tick the snapshot shows or an earlier one.
   */
  public read(engine: RecordEngine): RecordRead[] | undefined {
    if (this.order.length === 0) {
      return undefined;
    }
    engine.stateVersions(this.units, this.versions);
    let reads: RecordRead[] | undefined;
    for (let i = 0; i < this.order.length; i++) {
      const watched = this.order[i];
      const version = this.versions[i];
      if (!watched.fresh && version === watched.version) {
        continue;
      }
      if (watched.fresh) {
        // A `since` past the count throws; the version is the count, short of
        // it only once the count has wrapped past 2³².
        watched.since = Math.min(watched.since, version);
        watched.fresh = false;
      }
      watched.version = version;
      const { first, values } = engine.readRecords(watched.unit, watched.since);
      watched.since = first + values.length;
      if (values.length > 0) {
        (reads ??= []).push({ id: watched.id, first, values });
      }
    }
    return reads;
  }

  /**
   * For an engine rebuilt from the descriptor: its recorders hold nothing and
   * count from 0 again, so every watch reads from the first record.
   */
  public reset(): void {
    for (const watched of this.order) {
      watched.since = 0;
      watched.version = 0;
    }
  }

  private rebuild(): void {
    this.order = [...this.watched.values()];
    this.units = Uint32Array.from(this.order, ({ unit }) => unit);
    this.versions = new Uint32Array(this.order.length);
  }
}
