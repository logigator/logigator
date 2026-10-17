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
  /** Empty until named. */
  label: string;
  /**
   * Fallback shown when unlabeled, numbered by creation order. Deliberately
   * *not* the row's position: it names the plug, so a reorder moves it along
   * with the row rather than renumbering in place, which would leave a list of
   * unlabeled ports looking untouched after a drag.
   */
  placeholder: string;
  /** 1-based port position, i.e. the row's place in the list. */
  position: number;
}

/**
 * Two reorderable lists — inputs, then outputs — configuring a custom
 * component's port order and labels. Shown only while editing a component.
 *
 * A **live view** of the project's INPUT/OUTPUT plugs (the same scan as
 * `deriveSummary`), so adding or removing a plug on the canvas adds or removes
 * a row. Both writes back go through `ActionManager`, for undo and dirty
 * tracking: a drag rewrites every plug's `index` to a clean `0..n-1`, an
 * inline edit writes the plug's `label` — the same option the canvas surfaces
 * when the plug is selected, so the two views stay consistent.
 *
 * The two ordinals per row differ on purpose: the leading number is the live
 * port position, the placeholder identifies the plug by creation order. Only
 * the former renumbers on a drag.
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
  // stay live, whichever context the action fired from. `startWith` seeds the
  // first render, `switchMap` re-targets on project change, and `scan` turns
  // the void emissions into a counter so each survives toSignal's equality
  // check — identical `undefined`s would be deduped and the lists never
  // refresh.
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
    // Same ordering as deriveSummary: index, then instance id as a tiebreaker
    // against gappy or duplicate indices in externally-authored data.
    plugs.sort(
      (a, b) => a.options.index.value - b.options.index.value || a.id - b.id
    );
    // Creation order (ascending instance id), which no drag can change.
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
