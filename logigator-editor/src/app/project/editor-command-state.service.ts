import { computed, inject, Injectable } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of, scan, startWith, switchMap } from 'rxjs';
import { ProjectService } from './project.service';
import { SelectionInspectorService } from './selection-inspector.service';
import { ClipboardService } from '../clipboard/clipboard.service';

/**
 * Exposes whether each editing command is currently a no-op, so the tool bar
 * (and any other surface) can disable the matching buttons.
 *
 * The predicates live on the active project's `ActionManager`/`ViewportController`
 * as plain getters. Their change streams are folded into signals with the same
 * {@link switchMap} + {@link toSignal} bridge as {@link SelectionInspectorService}:
 * `startWith` reflects the project's current state the moment it becomes active,
 * and `scan` turns the void emissions into a monotonic counter so `toSignal`
 * doesn't dedupe identical `undefined`s and stall the computed.
 */
@Injectable({ providedIn: 'root' })
export class EditorCommandStateService {
  private readonly projectService = inject(ProjectService);
  private readonly selectionInspector = inject(SelectionInspectorService);
  private readonly clipboardService = inject(ClipboardService);

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

  private readonly viewportTick = toSignal(
    toObservable(this.projectService.activeProject).pipe(
      switchMap((project) =>
        project
          ? project.viewport.viewportChange$.pipe(startWith(void 0))
          : of(void 0)
      ),
      scan((n) => n + 1, 0)
    )
  );

  /** True when there is an action to undo. */
  public readonly canUndo = computed<boolean>(() => {
    this.historyTick();
    return this.projectService.activeProject()?.actionManager.undoAvailable ?? false;
  });

  /** True when there is an undone action to redo. */
  public readonly canRedo = computed<boolean>(() => {
    this.historyTick();
    return this.projectService.activeProject()?.actionManager.redoAvailable ?? false;
  });

  /** True until the viewport is at its closest zoom step. */
  public readonly canZoomIn = computed<boolean>(() => {
    this.viewportTick();
    return this.projectService.activeProject()?.viewport.zoomInPossible ?? false;
  });

  /** True until the viewport is at its farthest zoom step. */
  public readonly canZoomOut = computed<boolean>(() => {
    this.viewportTick();
    return this.projectService.activeProject()?.viewport.zoomOutPossible ?? false;
  });

  /** True when anything is selected — gates copy/cut/delete/rotate. */
  public readonly hasSelection = this.selectionInspector.hasSelection;

  /** True when a project is open and the clipboard holds a copied snapshot. */
  public readonly canPaste = computed<boolean>(
    () =>
      this.projectService.activeProject() !== null &&
      this.clipboardService.hasClipboard()
  );
}
