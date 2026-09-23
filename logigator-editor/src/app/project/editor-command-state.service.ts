import { computed, inject, Injectable } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  distinctUntilChanged,
  map,
  of,
  scan,
  startWith,
  switchMap
} from 'rxjs';
import { ProjectService } from './project.service';
import { SelectionInspectorService } from './selection-inspector.service';
import { ClipboardService } from '../clipboard/clipboard.service';
import { WorkModeService } from '../work-mode/work-mode.service';

/**
 * Whether each editing command is currently a no-op, so a surface can disable
 * the matching buttons. The predicates are plain getters on the active
 * project's `ActionManager`/`ViewportController`, folded into signals through
 * the same {@link switchMap} + {@link toSignal} bridge as
 * {@link SelectionInspectorService}.
 */
@Injectable({ providedIn: 'root' })
export class EditorCommandStateService {
  private readonly projectService = inject(ProjectService);
  private readonly selectionInspector = inject(SelectionInspectorService);
  private readonly clipboardService = inject(ClipboardService);
  private readonly workModeService = inject(WorkModeService);

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

  // The active viewport's zoom scale, which is all the zoom predicates depend
  // on. Deduplicated so a pan — a viewport change on every pointer move —
  // never reaches change detection.
  private readonly viewportScale = toSignal(
    toObservable(this.projectService.activeProject).pipe(
      switchMap((project) =>
        project
          ? project.viewport.viewportChange$.pipe(
              startWith(project.viewport.viewportState),
              map((state) => state.scale),
              distinctUntilChanged()
            )
          : of(null)
      )
    )
  );

  /** True when there is an action to undo. */
  public readonly canUndo = computed<boolean>(() => {
    this.historyTick();
    return (
      this.projectService.activeProject()?.actionManager.undoAvailable ?? false
    );
  });

  /** True when there is an undone action to redo. */
  public readonly canRedo = computed<boolean>(() => {
    this.historyTick();
    return (
      this.projectService.activeProject()?.actionManager.redoAvailable ?? false
    );
  });

  /** True until the viewport is at its closest zoom step. */
  public readonly canZoomIn = computed<boolean>(() => {
    this.viewportScale();
    return (
      this.projectService.activeProject()?.viewport.zoomInPossible ?? false
    );
  });

  /** True until the viewport is at its farthest zoom step. */
  public readonly canZoomOut = computed<boolean>(() => {
    this.viewportScale();
    return (
      this.projectService.activeProject()?.viewport.zoomOutPossible ?? false
    );
  });

  /** True when anything is selected — gates copy/cut/delete. */
  public readonly hasSelection = this.selectionInspector.hasSelection;

  /**
   * True when a rotate request has a target: the selection, or an armed
   * placement (the pending component turns instead — see
   * `BoardTool.rotate`). Placement is armed exactly while a component type is
   * selected for placing, which the mode switch clears.
   */
  public readonly canRotate = computed<boolean>(
    () =>
      this.hasSelection() ||
      this.workModeService.selectedComponentType() !== null
  );

  /** True when a project is open and the clipboard holds a copied snapshot. */
  public readonly canPaste = computed<boolean>(
    () =>
      this.projectService.activeProject() !== null &&
      this.clipboardService.hasClipboard()
  );
}
