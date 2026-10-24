import { computed, inject, Injectable, Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, scan, startWith, switchMap } from 'rxjs';
import { ProjectService } from '../project/project.service';
import { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import { CustomComponent } from '../components/custom/custom-component';
import { CUSTOM_TYPE_ID_BASE } from '@logigator/core';

/**
 * The one source of truth for "a placed instance is behind its master": the
 * predicate, which types the active project holds outdated instances of, and
 * which instances those are.
 *
 * The board is scanned once per change into a `masterTypeId → count` map, so
 * every consumer is a lookup. Freshness comes from the active project's
 * `actionChange$` folded into a counter — every board mutation is an action —
 * plus the registry revision a save bumps with the new version stamp.
 */
@Injectable({ providedIn: 'root' })
export class OutdatedInstancesService {
  private readonly projectService = inject(ProjectService);
  private readonly registry = inject(CustomComponentRegistry);

  private readonly historyTick = toSignal(
    toObservable(this.projectService.activeProject).pipe(
      switchMap((project) =>
        project
          ? project.actionManager.actionChange$.pipe(startWith(void 0))
          : of(void 0)
      ),
      scan((n) => n + 1, 0)
    )
  );

  /**
   * The single definition of "outdated": a snapshot type whose frozen `version`
   * is lower than its master's. False for built-ins, masters, unknown types, an
   * orphan whose master is gone, and either side missing a version stamp, which
   * leaves instances unflagged rather than always-stale. Resolution runs
   * through {@link CustomComponentRegistry.resolveMaster}, so a snapshot taken
   * before an upload still resolves through the promotion alias.
   */
  public isOutdated(typeId: number): boolean {
    if (typeId < CUSTOM_TYPE_ID_BASE) return false;
    const def = this.registry.getDefinition(typeId);
    if (!def || def.kind !== 'snapshot' || def.version === undefined) {
      return false;
    }
    const master = this.registry.resolveMaster(typeId)?.master;
    return master?.version !== undefined && master.version > def.version;
  }

  /**
   * Outdated instances per master type id in the active project; an absent key
   * means none. Memoized because the palette asks {@link countFor} once per
   * tile per render pass, and a board walk per tile would be tiles × elements.
   */
  private readonly _outdatedCounts: Signal<ReadonlyMap<number, number>> =
    computed(() => {
      this.historyTick();
      this.registry.revision();

      const counts = new Map<number, number>();
      const project = this.projectService.activeProject();
      if (!project) return counts;

      for (const component of project.components) {
        const typeId = component.config.type;
        if (!this.isOutdated(typeId)) continue;
        const masterTypeId = this.registry.resolveMaster(typeId)?.masterTypeId;
        if (masterTypeId === undefined) continue;
        counts.set(masterTypeId, (counts.get(masterTypeId) ?? 0) + 1);
      }
      return counts;
    });

  /**
   * Outdated instances of the master behind `typeId`, which may be a master's
   * own id or any of its snapshots'.
   */
  public countFor(typeId: number): number {
    const masterTypeId = this.registry.resolveMaster(typeId)?.masterTypeId;
    if (masterTypeId === undefined) return 0;
    return this._outdatedCounts().get(masterTypeId) ?? 0;
  }

  /** Read live from the active project: what the update-all action replaces. */
  public collectFor(typeId: number): CustomComponent[] {
    const masterTypeId = this.registry.resolveMaster(typeId)?.masterTypeId;
    const project = this.projectService.activeProject();
    if (masterTypeId === undefined || !project) return [];

    const instances: CustomComponent[] = [];
    for (const component of project.components) {
      if (!(component instanceof CustomComponent)) continue;
      if (!this.isOutdated(component.config.type)) continue;
      if (
        this.registry.resolveMaster(component.config.type)?.masterTypeId ===
        masterTypeId
      ) {
        instances.push(component);
      }
    }
    return instances;
  }
}
