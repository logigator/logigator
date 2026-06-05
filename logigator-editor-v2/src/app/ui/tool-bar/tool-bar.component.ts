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
import { BuiltInComponentType } from '../../components/component-type.enum';
import { ProjectService } from '../../project/project.service';
import { PersistenceService } from '../../persistence/persistence.service';
import { ToastService } from '../../logging/toast.service';
import { LoggingService } from '../../logging/logging.service';
import { DialogService } from 'primeng/dynamicdialog';
import { OpenProjectDialogComponent } from '../open-project-dialog/open-project-dialog.component';

@Component({
  selector: 'app-tool-bar',
  imports: [ButtonModule, DividerModule, TooltipModule, TranslocoDirective],
  providers: [DialogService],
  templateUrl: './tool-bar.component.html',
  styleUrl: './tool-bar.component.scss',
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

  protected undo(): void {
    this.projectService.activeProject()?.actionManager.undo();
  }

  protected redo(): void {
    this.projectService.activeProject()?.actionManager.redo();
  }

  protected save(): void {
    const project = this.projectService.mainProject();
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
    this.projectService.activeProject()?.triggerTicker('single');
  }

  protected zoomOut(): void {
    this.projectService.activeProject()?.zoomOut();
    this.projectService.activeProject()?.triggerTicker('single');
  }
}
