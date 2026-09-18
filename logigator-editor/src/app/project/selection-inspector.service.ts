import { computed, inject, Injectable } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, scan, startWith, switchMap } from 'rxjs';
import { Component } from '../components/component';
import { ProjectService } from './project.service';

/**
 * Bridges the active project's canvas selection into the Angular settings
 * panel, exposing the single selected placed component whose options the
 * inspector edits.
 *
 * Selection fires outside Angular, but folding `selectionChange$` into a signal
 * with {@link toSignal} means a write from any context notifies the change
 * detection scheduler. {@link switchMap} re-targets the stream when the active
 * project changes.
 */
@Injectable({ providedIn: 'root' })
export class SelectionInspectorService {
  private readonly projectService = inject(ProjectService);

  // `startWith` reflects the project's selection the moment it becomes active.
  // `scan` makes each void emission a distinct value, or toSignal's equality
  // check would dedupe the identical `undefined`s and stall the computed.
  private readonly selectionTick = toSignal(
    toObservable(this.projectService.activeProject).pipe(
      switchMap((project) =>
        project
          ? project.selectionManager.selectionChange$.pipe(startWith(void 0))
          : of(void 0)
      ),
      scan((n) => n + 1, 0)
    )
  );

  /** The single selected placed component, or null when zero/many are selected. */
  public readonly selectedComponent = computed<Component | null>(() => {
    this.selectionTick();
    const sm = this.projectService.activeProject()?.selectionManager;
    if (!sm) return null;
    return sm.selectedComponents.size === 1 && sm.selectedWires.size === 0
      ? [...sm.selectedComponents][0]
      : null;
  });

  /** Total selected elements (components + wires) in the active project. */
  public readonly selectionCount = computed<number>(() => {
    this.selectionTick();
    const sm = this.projectService.activeProject()?.selectionManager;
    if (!sm) return 0;
    return sm.selectedComponents.size + sm.selectedWires.size;
  });

  /** True when anything is selected. */
  public readonly hasSelection = computed<boolean>(
    () => this.selectionCount() > 0
  );
}
