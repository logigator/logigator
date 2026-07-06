import { Component, computed, inject } from '@angular/core';
import { DialogService, LgButton, LgDivider, LgTooltip } from '@logigator/ui';
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
import { ShortcutBinding } from '../../shortcuts/shortcut-binding.model';
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
  templateUrl: './tool-bar.component.html'
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

  protected readonly actions = ShortcutActionEnum;

  /** Shared editing tool set; the desktop bar and mobile HUD both render it. */
  protected readonly tools: WorkModeToolDescriptor[] = createWorkModeTools(
    this.workModeService
  );

  /** The current key binding shown in a button's tooltip. */
  protected shortcutBinding(
    action: ShortcutActionEnum
  ): ShortcutBinding | null {
    return this.shortcutService.binding(action)();
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
