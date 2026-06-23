import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TranslocoDirective } from '@jsverse/transloco';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { WorkMode } from '../../work-mode/work-mode.enum';
import { ProjectService } from '../../project/project.service';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';
import { SaveCoordinatorService } from '../save-coordinator.service';
import { SimulationService } from '../../simulation/simulation.service';
import { MobileUiService } from '../../layout/mobile-ui.service';

/**
 * Compact top bar (`isCompact`): hamburger → menu Drawer, truncated project
 * name, and the high-traffic actions (undo/redo/save/run). In SIMULATION the
 * run button becomes exit and the edit actions disable, mirroring the tool bar.
 */
@Component({
  selector: 'app-mobile-top-bar',
  imports: [ButtonModule, TranslocoDirective],
  template: `
    <div
      *transloco="let t"
      class="flex h-12 items-center gap-1 border-b border-border px-1"
    >
      <p-button
        icon="ph ph-list"
        severity="secondary"
        text
        [ariaLabel]="t('mobile.menu')"
        (onClick)="openMenu()"
      ></p-button>
      <span class="grow truncate px-1 text-center font-semibold">{{
        projectName()
      }}</span>
      @if (isSimulation()) {
        <p-button
          icon="ph ph-sign-out"
          severity="secondary"
          text
          [ariaLabel]="t('toolBar.exitSim')"
          (onClick)="exitSimulation()"
        ></p-button>
      } @else {
        <p-button
          icon="ph ph-arrow-u-up-left"
          severity="secondary"
          text
          [ariaLabel]="t('toolBar.undo')"
          (onClick)="undo()"
        ></p-button>
        <p-button
          icon="ph ph-arrow-u-up-right"
          severity="secondary"
          text
          [ariaLabel]="t('toolBar.redo')"
          (onClick)="redo()"
        ></p-button>
        <p-button
          icon="ph ph-floppy-disk"
          severity="secondary"
          text
          [ariaLabel]="t('toolBar.save')"
          (onClick)="save()"
        ></p-button>
        <p-button
          icon="ph ph-play"
          severity="secondary"
          [ariaLabel]="t('toolBar.startSim')"
          (onClick)="startSimulation()"
        ></p-button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MobileTopBarComponent {
  private readonly workModeService = inject(WorkModeService);
  private readonly projectService = inject(ProjectService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly saveCoordinator = inject(SaveCoordinatorService);
  private readonly simulationService = inject(SimulationService);
  private readonly mobileUi = inject(MobileUiService);

  protected readonly isSimulation = computed(
    () => this.workModeService.mode() === WorkMode.SIMULATION
  );

  protected readonly projectName = computed(() => {
    const project = this.projectService.mainProject();
    if (!project) return '';
    return this.metadataStore.getMetadata(project)?.name ?? '';
  });

  protected openMenu(): void {
    this.mobileUi.open('menu');
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

  protected startSimulation(): void {
    this.simulationService.enter();
  }

  protected exitSimulation(): void {
    this.simulationService.exit();
  }
}
