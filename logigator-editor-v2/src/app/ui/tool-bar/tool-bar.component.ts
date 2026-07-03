import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';
import {
  DialogService,
  formatShortcutLabel,
  LgButton,
  LgDivider,
  LgTooltip
} from '@logigator/ui';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { WorkMode } from '../../work-mode/work-mode.enum';
import {
  createWorkModeTools,
  WorkModeToolDescriptor
} from '../../work-mode/work-mode-tools';
import { ClipboardService } from '../../clipboard/clipboard.service';
import { ProjectService } from '../../project/project.service';
import { SaveCoordinatorService } from '../save-coordinator.service';
import { OpenProjectDialogComponent } from '../open-project-dialog/open-project-dialog.component';
import { ShortcutService } from '../../shortcuts/shortcut.service';
import { ShortcutActionEnum } from '../../shortcuts/shortcut-action.enum';
import { SimulationService } from '../../simulation/simulation.service';
import { SimulationControlsComponent } from '../simulation-controls/simulation-controls.component';

@Component({
  selector: 'app-tool-bar',
  imports: [
    LgButton,
    LgDivider,
    LgTooltip,
    TranslocoDirective,
    SimulationControlsComponent
  ],
  templateUrl: './tool-bar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToolBarComponent {
  private readonly workModeService = inject(WorkModeService);
  private readonly projectService = inject(ProjectService);
  private readonly saveCoordinator = inject(SaveCoordinatorService);
  private readonly dialogService = inject(DialogService);
  private readonly translocoService = inject(TranslocoService);
  private readonly clipboardService = inject(ClipboardService);
  private readonly shortcutService = inject(ShortcutService);
  private readonly simulationService = inject(SimulationService);

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
  protected startSimTooltip = computed(
    () =>
      `${this.translocoService.translate('toolBar.startSim')} (${this._fmt(ShortcutActionEnum.TOGGLE_SIMULATION)})`
  );
  protected exitSimTooltip = computed(
    () =>
      `${this.translocoService.translate('toolBar.exitSim')} (${this._fmt(ShortcutActionEnum.TOGGLE_SIMULATION)})`
  );
  /** Shared editing tool set; the desktop bar and mobile HUD both render it. */
  protected readonly tools: WorkModeToolDescriptor[] = createWorkModeTools(
    this.workModeService
  );

  /** Formats the keybinding hint shown in a tool's tooltip. */
  protected shortcutLabel(action: ShortcutActionEnum): string {
    return this._fmt(action);
  }

  // Swaps the toolbar between the editing tool set and the simulation
  // controls.
  protected isSimulationMode = computed(
    () => this.workModeService.mode() === WorkMode.SIMULATION
  );

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
    if (project) void this.saveCoordinator.requestSave(project);
  }

  protected open(): void {
    this.dialogService.open(OpenProjectDialogComponent, {
      header: this.translocoService.translate('openProjectDialog.title'),
      width: '40rem',
      modal: true,
      closable: true
    });
  }

  protected startSimulation(): void {
    this.simulationService.enter();
  }

  protected exitSimulation(): void {
    this.simulationService.exit();
  }

  protected zoomIn(): void {
    this.projectService.activeProject()?.zoomIn();
  }

  protected zoomOut(): void {
    this.projectService.activeProject()?.zoomOut();
  }
}
