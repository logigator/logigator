import { LoggingService } from '../../logging/logging.service';
import { getStaticDI } from '../../utils/get-di';

/**
 * Watch data the compiler retains so a live view of a custom instance's inner
 * circuit can open mid-simulation without recompiling. Integer tables only —
 * render targets need live objects, created at watch-open time from a fresh
 * `instantiateBody` run of the same body.
 *
 * All per-template tables are keyed by **element position in the instantiated
 * body arrays**, never by live component id: two `instantiateBody` runs of one
 * body must line up, and ids are session-assigned while positions are not.
 */

/** Bridge from a directly nested custom instance into its parent template. */
export interface WatchChildBridge {
  typeId: number;
  /** Child-template-local net id → parent-template-local net id. */
  netMap: Int32Array;
  /** Offset of the child's units inside the parent template's unit list. */
  unitBase: number;
}

/** Per-template watch tables, cached with the compiled template. */
export interface WatchTemplateTables {
  /** Body wire index → template-local net id. */
  wireNets: Int32Array;
  /** Body component index → per-portIndex template-local net id. */
  portNets: Int32Array[];
  /** Body index of a direct switch/button → template-local unit index. */
  userInputs: ReadonlyMap<number, number>;
  /** Body component index of a direct nested custom → its bridge. */
  children: ReadonlyMap<number, WatchChildBridge>;
}

/** One top-level custom instance's resolution into the global board. */
export interface WatchInstanceRecord {
  typeId: number;
  /** Template-local net id → global link id (`-1` = no link, never powered). */
  linkOfLocalNet: Int32Array;
  /** Offset of the instance's units inside the board's component list. */
  unitBase: number;
}

/** A resolved watch level: everything needed to wire up one inner circuit. */
export interface WatchLevelInfo {
  typeId: number;
  /** Template-local net id → global link id (`-1` = no link, never powered). */
  linkOfLocalNet: Int32Array;
  tables: WatchTemplateTables;
  /** Global unit index of a direct switch/button, by body component index. */
  unitIndexFor(bodyComponentIndex: number): number | undefined;
}

/**
 * Path-addressable watch data for one compiled board. A watch path starts with
 * the placed top-level instance's component id and descends by body component
 * index: `"<componentId>"`, `"<componentId>/<bodyIndex>"`, … Resolution is pure
 * integer composition over the retained tables, memoized per path.
 */
export class WatchIndex {
  private readonly _resolved = new Map<string, WatchLevelInfo | null>();

  constructor(
    private readonly instances: ReadonlyMap<string, WatchInstanceRecord>,
    private readonly templates: ReadonlyMap<number, WatchTemplateTables>
  ) {}

  /**
   * Resolves a watch path to its level info, or `null` when it addresses no
   * watchable instance (unknown id/index, or a template that failed to
   * compile).
   */
  public infoFor(path: string): WatchLevelInfo | null {
    const cached = this._resolved.get(path);
    if (cached !== undefined) {
      return cached;
    }
    const info = this._resolve(path);
    this._resolved.set(path, info);
    return info;
  }

  private _resolve(path: string): WatchLevelInfo | null {
    const segments = path.split('/');
    const top = this.instances.get(segments[0]);
    if (!top) {
      getStaticDI(LoggingService).debug(
        `watch path "${path}" resolves to no top-level instance "${segments[0]}"`,
        'WatchIndex'
      );
      return null;
    }

    let typeId = top.typeId;
    let linkOfLocalNet = top.linkOfLocalNet;
    let unitBase = top.unitBase;
    for (const segment of segments.slice(1)) {
      const tables = this.templates.get(typeId);
      const bridge = tables?.children.get(Number(segment));
      if (!bridge) {
        getStaticDI(LoggingService).debug(
          `watch path "${path}" has no child "${segment}" under type ${typeId}`,
          'WatchIndex'
        );
        return null;
      }
      const parentLinks = linkOfLocalNet;
      linkOfLocalNet = Int32Array.from(bridge.netMap, (parentNet) =>
        parentNet === -1 ? -1 : parentLinks[parentNet]
      );
      unitBase += bridge.unitBase;
      typeId = bridge.typeId;
    }

    const tables = this.templates.get(typeId);
    if (!tables) {
      getStaticDI(LoggingService).debug(
        `watch path "${path}" targets type ${typeId} with no compiled template`,
        'WatchIndex'
      );
      return null;
    }
    const base = unitBase;
    return {
      typeId,
      linkOfLocalNet,
      tables,
      unitIndexFor: (bodyComponentIndex) => {
        const local = tables.userInputs.get(bodyComponentIndex);
        return local === undefined ? undefined : base + local;
      }
    };
  }
}
