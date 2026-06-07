import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { WorkMode } from '../../work-mode/work-mode.enum';
import { ClipboardService } from '../../clipboard/clipboard.service';
import { BuiltInComponentType } from '../../components/component-type.enum';
import { ProjectService } from '../../project/project.service';
import { PersistenceService } from '../../persistence/persistence.service';
import { ToastService } from '../../logging/toast.service';
import { LoggingService } from '../../logging/logging.service';
import { DialogService } from 'primeng/dynamicdialog';
import { OpenProjectDialogComponent } from '../open-project-dialog/open-project-dialog.component';
import { ShortcutService } from '../../shortcuts/shortcut.service';
import { ShortcutActionEnum } from '../../shortcuts/shortcut-action.enum';
import { formatShortcutLabel } from '../../shortcuts/shortcut-binding.model';

@Component({
  selector: 'app-tool-bar',
  imports: [ButtonModule, DividerModule, TooltipModule, TranslocoDirective],
  templateUrl: './tool-bar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToolBarComponent {
  private readonly workModeService = inject(WorkModeService);
  private readonly projectService = inject(ProjectService);
  private readonly persistenceService = inject(PersistenceService);
  private readonly toastService = inject(ToastService);
  private readonly loggingService = inject(LoggingService);
  private readonly dialogService = inject(DialogService);
  private readonly translocoService = inject(TranslocoService);
  private readonly clipboardService = inject(ClipboardService);
  private readonly shortcutService = inject(ShortcutService);

  private _fmt(action: ShortcutActionEnum): string {
    const binding = this.shortcutService.binding(action)();
    return binding
      ? formatShortcutLabel(binding, this.shortcutService.isMac)
      : '';
  }

  protected saveTooltip = computed(
    () =>
      `${this.translocoService.translate('toolBar.save')} (${this._fmt(ShortcutActionEnum.SAVE)})`
  );
  protected openTooltip = computed(
    () =>
      `${this.translocoService.translate('toolBar.open')} (${this._fmt(ShortcutActionEnum.OPEN)})`
  );
  protected copyTooltip = computed(
    () =>
      `${this.translocoService.translate('toolBar.copy')} (${this._fmt(ShortcutActionEnum.COPY)})`
  );
  protected cutTooltip = computed(
    () =>
      `${this.translocoService.translate('toolBar.cut')} (${this._fmt(ShortcutActionEnum.CUT)})`
  );
  protected pasteTooltip = computed(
    () =>
      `${this.translocoService.translate('toolBar.paste')} (${this._fmt(ShortcutActionEnum.PASTE)})`
  );
  protected deleteTooltip = computed(
    () =>
      `${this.translocoService.translate('toolBar.delete')} (${this._fmt(ShortcutActionEnum.DELETE)})`
  );
  protected undoTooltip = computed(
    () =>
      `${this.translocoService.translate('toolBar.undo')} (${this._fmt(ShortcutActionEnum.UNDO)})`
  );
  protected redoTooltip = computed(
    () =>
      `${this.translocoService.translate('toolBar.redo')} (${this._fmt(ShortcutActionEnum.REDO)})`
  );
  protected zoomOutTooltip = computed(
    () =>
      `${this.translocoService.translate('toolBar.zoomOut')} (${this._fmt(ShortcutActionEnum.ZOOM_OUT)})`
  );
  protected zoomInTooltip = computed(
    () =>
      `${this.translocoService.translate('toolBar.zoomIn')} (${this._fmt(ShortcutActionEnum.ZOOM_IN)})`
  );
  protected placeWiresTooltip = computed(
    () =>
      `${this.translocoService.translate('toolBar.placeWires')} (${this._fmt(ShortcutActionEnum.TOOL_WIRE_DRAWING)})`
  );
  protected connWiresTooltip = computed(
    () =>
      `${this.translocoService.translate('toolBar.connWires')} (${this._fmt(ShortcutActionEnum.TOOL_WIRE_CONNECTION)})`
  );
  protected selectTooltip = computed(
    () =>
      `${this.translocoService.translate('toolBar.select')} (${this._fmt(ShortcutActionEnum.TOOL_SELECT)})`
  );
  protected selExactTooltip = computed(
    () =>
      `${this.translocoService.translate('toolBar.selExact')} (${this._fmt(ShortcutActionEnum.TOOL_SELECT_EXACT)})`
  );
  protected eraserTooltip = computed(
    () =>
      `${this.translocoService.translate('toolBar.eraser')} (${this._fmt(ShortcutActionEnum.TOOL_ERASE)})`
  );
  protected textTooltip = computed(
    () =>
      `${this.translocoService.translate('toolBar.text')} (${this._fmt(ShortcutActionEnum.TOOL_PLACE_TEXT)})`
  );

  protected isWireDrawMode = computed(
    () => this.workModeService.mode() === WorkMode.WIRE_DRAWING
  );
  protected isWireConnMode = computed(
    () => this.workModeService.mode() === WorkMode.WIRE_CONNECTION
  );
  protected isSelectMode = computed(
    () => this.workModeService.mode() === WorkMode.SELECT
  );
  protected isSelectExactMode = computed(
    () => this.workModeService.mode() === WorkMode.SELECT_EXACT
  );
  protected isEraseMode = computed(
    () => this.workModeService.mode() === WorkMode.ERASE
  );
  protected isPlaceTextMode = computed(
    () =>
      this.workModeService.mode() === WorkMode.COMPONENT_PLACEMENT &&
      this.workModeService.selectedComponentType() === BuiltInComponentType.TEXT
  );

  protected setWireDrawMode(): void {
    this.workModeService.setMode(WorkMode.WIRE_DRAWING);
  }

  protected setWireConnMode(): void {
    this.workModeService.setMode(WorkMode.WIRE_CONNECTION);
  }

  protected setSelectMode(): void {
    this.workModeService.setMode(WorkMode.SELECT);
  }

  protected setSelectExactMode(): void {
    this.workModeService.setMode(WorkMode.SELECT_EXACT);
  }

  protected setEraseMode(): void {
    this.workModeService.setMode(WorkMode.ERASE);
  }

  protected setPlaceTextMode(): void {
    this.workModeService.setMode(WorkMode.COMPONENT_PLACEMENT);
    this.workModeService.setSelectedComponentType(BuiltInComponentType.TEXT);
  }

  protected copy(): void {
    const project = this.projectService.activeProject();
    if (project) this.clipboardService.copy(project);
  }

  protected cut(): void {
    const project = this.projectService.activeProject();
    if (project) this.clipboardService.cut(project);
  }

  protected paste(): void {
    const project = this.projectService.activeProject();
    if (project) this.clipboardService.paste(project);
  }

  protected delete(): void {
    const project = this.projectService.activeProject();
    if (project) this.clipboardService.delete(project);
  }

  protected undo(): void {
    this.projectService.activeProject()?.actionManager.undo();
  }

  protected redo(): void {
    this.projectService.activeProject()?.actionManager.redo();
  }

  protected save(): void {
    const project = this.projectService.activeProject();
    if (project) {
      this.persistenceService.saveProject(project).catch(() => {
        this.loggingService.error('Failed to save project', 'ToolBarComponent');
        this.toastService.error('Failed to save project');
      });
    }
  }

  protected open(): void {
    this.dialogService.open(OpenProjectDialogComponent, {
      header: this.translocoService.translate('openProjectDialog.title'),
      width: '40rem',
      modal: true,
      closable: true
    });
  }

  protected zoomIn(): void {
    this.projectService.activeProject()?.zoomIn();
  }

  protected zoomOut(): void {
    this.projectService.activeProject()?.zoomOut();
  }
}
