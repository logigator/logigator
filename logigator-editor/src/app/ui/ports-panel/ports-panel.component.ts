import { Component, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray
} from '@angular/cdk/drag-drop';
import { LgCard, LgInputText, LgTag } from '@logigator/ui';
import { of, scan, startWith, switchMap } from 'rxjs';
import { ProjectService } from '../../project/project.service';
import { InputComponent } from '../../components/component-types/input/input.component';
import { OutputComponent } from '../../components/component-types/output/output.component';
import { ChangeOptionAction } from '../../actions/actions/change-option.action';
import {
  PlugReorderEntry,
  ReorderPlugsAction
} from '../../actions/actions/reorder-plugs.action';
import { ComponentListCategoryComponent } from '../side-bar/component-list-category/component-list-category.component';
import { ComponentProviderService } from '../../components/component-provider.service';
import { TranslationService } from '../../translation/translation.service';
import { TranslateDirective } from '../../translation/translate.directive';

type Plug = InputComponent | OutputComponent;

interface PlugRow {
  component: Plug;
  /** The plug's current label (empty until named). */
  label: string;
  /**
   * Fallback shown when unlabeled, using the plug's creation-order ordinal.
   * Deliberately *not* the row's position: it names the plug, so a reorder
   * moves it along with the row instead of renumbering in place — which would
   * leave a list of unlabeled ports looking untouched after a drag.
   */
  placeholder: string;
  /** The plug's 1-based port position, i.e. the row's place in the list. */
  position: number;
}

/**
 * The component-level Ports panel: two reorderable lists (inputs, then
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
 *
 * Each row shows two ordinals, and the split matters: the leading number is the
 * live port position, while the name field's placeholder identifies the plug by
 * creation order. Only the former renumbers on a drag.
 */
@Component({
  selector: 'app-ports-panel',
  imports: [
    DragDropModule,
    LgCard,
    LgTag,
    LgInputText,
    TranslateDirective,
    ComponentListCategoryComponent
  ],
  templateUrl: './ports-panel.component.html',
  styleUrl: './ports-panel.component.scss'
})
export class PortsPanelComponent {
  private readonly projectService = inject(ProjectService);
  private readonly componentProviderService = inject(ComponentProviderService);
  private readonly translation = inject(TranslationService);

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

  protected readonly portComponents =
    this.componentProviderService.portComponents;

  protected readonly inputRows = computed(() =>
    this._rows(InputComponent, 'portsPanel.inputName')
  );
  protected readonly outputRows = computed(() =>
    this._rows(OutputComponent, 'portsPanel.outputName')
  );

  protected dropInput(event: CdkDragDrop<PlugRow[]>): void {
    this._applyReorder(
      this.inputRows(),
      event.previousIndex,
      event.currentIndex
    );
  }

  protected dropOutput(event: CdkDragDrop<PlugRow[]>): void {
    this._applyReorder(
      this.outputRows(),
      event.previousIndex,
      event.currentIndex
    );
  }

  protected setLabel(row: PlugRow, value: string): void {
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
    nameKey: 'portsPanel.inputName' | 'portsPanel.outputName'
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
    // Placeholder ordinals number the plugs by creation order (ascending
    // instance id), which no drag can change — see PlugRow.placeholder.
    const nameOrdinals = new Map<number, number>(
      [...plugs].sort((a, b) => a.id - b.id).map((c, i) => [c.id, i + 1])
    );
    return plugs.map((component, i) => ({
      component,
      label: component.options.label.value,
      placeholder: this.translation.translate(nameKey, {
        index: nameOrdinals.get(component.id)!
      }),
      position: i + 1
    }));
  }
}
