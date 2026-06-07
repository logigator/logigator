import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray
} from '@angular/cdk/drag-drop';
import { of, scan, startWith, switchMap } from 'rxjs';
import { ProjectService } from '../../project/project.service';
import { InputComponent } from '../../components/component-types/input/input.component';
import { OutputComponent } from '../../components/component-types/output/output.component';
import { ChangeOptionAction } from '../../actions/actions/change-option.action';
import {
  PlugReorderEntry,
  ReorderPlugsAction
} from '../../actions/actions/reorder-plugs.action';

type Plug = InputComponent | OutputComponent;

interface PlugRow {
  component: Plug;
  /** The plug's current label (empty until named). */
  label: string;
  /** Fallback shown when unlabeled, using the row's 1-based ordinal. */
  placeholder: string;
}

/**
 * The component-level Ports panel ([§E2]): two reorderable lists (inputs, then
 * outputs) that configure a custom component's port order and labels. Shown only
 * while editing a component.
 *
 * It is a **live view** of the open editor Project's INPUT/OUTPUT plugs (same
 * scan as `deriveSummary`): adding/removing a plug on the canvas adds/removes a
 * row. Two writes flow back, both through `ActionManager` (undo + dirty for
 * free): a drag rewrites every plug's `index` to a clean `0..n-1` via
 * {@link ReorderPlugsAction}; an inline edit writes the plug's `label` via
 * {@link ChangeOptionAction} — the same option surfaced when the plug is selected
 * on the canvas, so both views stay consistent.
 */
@Component({
  selector: 'app-ports-panel',
  imports: [DragDropModule],
  templateUrl: './ports-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PortsPanelComponent {
  private readonly projectService = inject(ProjectService);

  // Re-emits on every action in the active project so the derived plug lists
  // stay live; `startWith` seeds the first render when a project becomes
  // active, and switchMap re-targets the stream on project change. As a signal
  // it notifies change detection regardless of which context the action fired
  // from (e.g. PixiJS plug add/delete handlers). `scan` turns the void
  // emissions into a monotonic counter so each one is a distinct value that
  // survives toSignal's equality check (otherwise identical `undefined`s would
  // be deduped and the lists would not refresh).
  private readonly actionTick = toSignal(
    toObservable(this.projectService.activeProject).pipe(
      switchMap((project) =>
        project
          ? project.actionManager.actionChange$.pipe(startWith(void 0))
          : of(void 0)
      ),
      scan((n) => n + 1, 0)
    )
  );

  public readonly inputRows = computed(() =>
    this._rows(InputComponent, 'Input')
  );
  public readonly outputRows = computed(() =>
    this._rows(OutputComponent, 'Output')
  );

  public dropInput(event: CdkDragDrop<PlugRow[]>): void {
    this._applyReorder(
      this.inputRows(),
      event.previousIndex,
      event.currentIndex
    );
  }

  public dropOutput(event: CdkDragDrop<PlugRow[]>): void {
    this._applyReorder(
      this.outputRows(),
      event.previousIndex,
      event.currentIndex
    );
  }

  public setLabel(row: PlugRow, value: string): void {
    const project = this.projectService.activeProject();
    if (!project) return;
    const oldValue = row.component.options.label.value;
    if (oldValue === value) return;
    project.actionManager.push(
      new ChangeOptionAction(row.component.id, 'label', oldValue, value)
    );
  }

  private _applyReorder(
    rows: PlugRow[],
    previousIndex: number,
    currentIndex: number
  ): void {
    const project = this.projectService.activeProject();
    if (!project || previousIndex === currentIndex) return;

    const reordered = [...rows];
    moveItemInArray(reordered, previousIndex, currentIndex);
    const entries: PlugReorderEntry[] = reordered.map((row, i) => ({
      componentId: row.component.id,
      oldIndex: row.component.options.index.value,
      newIndex: i
    }));
    const action = new ReorderPlugsAction(entries);
    if (action.length > 0) project.actionManager.push(action);
  }

  private _rows(
    ctor: typeof InputComponent | typeof OutputComponent,
    prefix: string
  ): PlugRow[] {
    // Establish the dependency on action changes so the lists stay live.
    this.actionTick();
    const project = this.projectService.activeProject();
    if (!project) return [];

    const plugs = [...project.components].filter(
      (c): c is Plug => c instanceof ctor
    );
    // Same ordering as deriveSummary: index, then instance id as a defensive
    // tiebreaker against gappy/duplicate indices in externally-authored data.
    plugs.sort(
      (a, b) => a.options.index.value - b.options.index.value || a.id - b.id
    );
    return plugs.map((component, i) => ({
      component,
      label: component.options.label.value,
      placeholder: `${prefix} ${i + 1}`
    }));
  }
}
