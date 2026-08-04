import { Component, computed, inject } from '@angular/core';
import { LgButton, LgRipple } from '@logigator/ui';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { WorkMode } from '../../work-mode/work-mode.enum';
import { ProjectService } from '../../project/project.service';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';
import { SaveCoordinatorService } from '../save-coordinator.service';
import { SimulationService } from '../../simulation/simulation.service';
import { MobileUiService } from '../../layout/mobile-ui.service';
import { UserAvatarComponent } from '../user-settings/user-avatar.component';
import { OnboardTargetDirective } from '../../onboarding/onboard-target.directive';
import { TranslateDirective } from '../../translation/translate.directive';

/**
 * Compact top bar (`isCompact`): avatar → account/settings sheet, the
 * truncated project name → editor menu sheet, and the high-traffic actions
 * (undo/redo/save/run). In SIMULATION the run button becomes exit and the
 * edit actions disable, mirroring the tool bar.
 */
@Component({
  selector: 'app-mobile-top-bar',
  imports: [
    LgButton,
    LgRipple,
    TranslateDirective,
    UserAvatarComponent,
    OnboardTargetDirective
  ],
  template: `
    <div
      *appTranslate="let t"
      class="flex h-12 items-center gap-1 border-b border-border px-1"
    >
      <button
        type="button"
        lgRipple
        class="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-content-hover"
        [attr.aria-label]="t('mobile.account')"
        (click)="openMenu()"
      >
        <app-user-avatar />
      </button>
      <!-- The project name is the document's heading here, as it is in the
           desktop title bar; the compact shell has no other h1. -->
      <h1 class="flex min-w-0 grow">
        <button
          type="button"
          lgRipple
          class="flex min-w-0 grow cursor-pointer items-center justify-center gap-1 rounded px-1 py-2 text-base font-semibold hover:bg-content-hover"
          (click)="openProjectMenu()"
        >
          <span class="truncate">{{ projectName() }}</span>
          <i class="ph ph-caret-down text-sm text-muted" aria-hidden="true"></i>
        </button>
      </h1>
      @if (isSimulation()) {
        <lg-button
          icon="ph ph-sign-out"
          severity="secondary"
          text
          [ariaLabel]="t('toolBar.exitSim')"
          (onClick)="exitSimulation()"
        ></lg-button>
      } @else {
        <lg-button
          icon="ph ph-arrow-u-up-left"
          severity="secondary"
          text
          [ariaLabel]="t('toolBar.undo')"
          (onClick)="undo()"
        ></lg-button>
        <lg-button
          icon="ph ph-arrow-u-up-right"
          severity="secondary"
          text
          [ariaLabel]="t('toolBar.redo')"
          (onClick)="redo()"
        ></lg-button>
        <lg-button
          icon="ph ph-floppy-disk"
          severity="secondary"
          text
          [ariaLabel]="t('toolBar.save')"
          (onClick)="save()"
        ></lg-button>
        <lg-button
          appOnboardTarget="sim-start"
          icon="ph ph-play"
          severity="secondary"
          [ariaLabel]="t('toolBar.startSim')"
          (onClick)="startSimulation()"
        ></lg-button>
      }
    </div>
  `
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

  protected openProjectMenu(): void {
    this.mobileUi.open('project');
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
    void this.simulationService.enter();
  }

  protected exitSimulation(): void {
    this.simulationService.exit();
  }
}
