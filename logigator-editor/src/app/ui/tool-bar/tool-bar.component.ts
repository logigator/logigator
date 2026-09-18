import { Component, computed, inject } from '@angular/core';
import { DialogService, LgButton, LgDivider, LgTooltip } from '@logigator/ui';
import { DialogId } from '../../analytics/analytics.mapping';
import { TranslationService } from '../../translation/translation.service';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { WorkMode } from '../../work-mode/work-mode.enum';
import {
  createWorkModeTools,
  WorkModeToolDescriptor
} from '../../work-mode/work-mode-tools';
import { ClipboardService } from '../../clipboard/clipboard.service';
import { ProjectService } from '../../project/project.service';
import { EditorCommandStateService } from '../../project/editor-command-state.service';
import { SaveCoordinatorService } from '../save-coordinator.service';
import { OpenProjectDialogComponent } from '../dialogs/open-project-dialog/open-project-dialog.component';
import { NewComponentDialogComponent } from '../dialogs/new-component-dialog/new-component-dialog.component';
import { ShortcutService } from '../../shortcuts/shortcut.service';
import { ShortcutActionEnum } from '../../shortcuts/shortcut-action.enum';
import { ShortcutBinding } from '../../shortcuts/shortcut-binding.model';
import { SimulationService } from '../../simulation/simulation.service';
import { SimulationControlsComponent } from '../simulation-controls/simulation-controls.component';
import { OnboardTargetDirective } from '../../onboarding/onboard-target.directive';
import { TranslateDirective } from '../../translation/translate.directive';

@Component({
  selector: 'app-tool-bar',
  imports: [
    LgButton,
    LgDivider,
    LgTooltip,
    TranslateDirective,
    SimulationControlsComponent,
    OnboardTargetDirective
  ],
  templateUrl: './tool-bar.component.html'
})
export class ToolBarComponent {
  private readonly workModeService = inject(WorkModeService);
  private readonly projectService = inject(ProjectService);
  private readonly saveCoordinator = inject(SaveCoordinatorService);
  private readonly dialogService = inject(DialogService);
  private readonly translation = inject(TranslationService);
  private readonly clipboardService = inject(ClipboardService);
  private readonly shortcutService = inject(ShortcutService);
  private readonly simulationService = inject(SimulationService);

  /** Drives the disabled state of the buttons whose action can be a no-op. */
  protected readonly commandState = inject(EditorCommandStateService);

  protected readonly actions = ShortcutActionEnum;

  /** Shared editing tool set; the mobile HUD renders the same one. */
  protected readonly tools: WorkModeToolDescriptor[] = createWorkModeTools(
    this.workModeService
  );

  /** The current key binding shown in a button's tooltip. */
  protected shortcutBinding(
    action: ShortcutActionEnum
  ): ShortcutBinding | null {
    return this.shortcutService.binding(action)();
  }

  // Swaps the bar between the editing tool set and the simulation controls.
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

  protected rotate(steps: number): void {
    this.projectService.activeProject()?.requestSelectionRotation(steps);
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
      header: this.translation.translate('openProjectDialog.title'),
      width: '40rem',
      modal: true,
      closable: true,
      telemetryId: DialogId.OpenProject
    });
  }

  protected newComponent(): void {
    this.dialogService.open(NewComponentDialogComponent, {
      header: this.translation.translate(
        'titleBar.menuBar.file.items.newComponent.label'
      ),
      width: '28rem',
      modal: true,
      closable: true,
      telemetryId: DialogId.NewComponent
    });
  }

  protected startSimulation(): void {
    void this.simulationService.enter();
  }

  protected exitSimulation(): void {
    this.simulationService.exit();
  }

  protected zoomIn(): void {
    this.projectService.activeProject()?.viewport.zoomIn();
  }

  protected zoomOut(): void {
    this.projectService.activeProject()?.viewport.zoomOut();
  }
}
