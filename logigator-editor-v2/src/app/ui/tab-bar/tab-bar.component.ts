import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LgTabReorder, LgTabStrip, LgTabStripItem } from '@logigator/ui';
import { ProjectService } from '../../project/project.service';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';
import { CustomComponentService } from '../../custom-component/custom-component.service';
import { WorkMode } from '../../work-mode/work-mode.enum';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { Project } from '../../project/project';

/**
 * The tab strip above the board: the pinned main project plus one tab per open
 * custom-component editor. Clicking a tab switches the canvas via
 * {@link ProjectService.setActiveProject}; the ✕ on a component tab closes its
 * editor through {@link CustomComponentService.closeComponent}. The board already
 * renders whatever `activeProject()` is, so no board change is needed.
 *
 * Presentation and reordering (closable, draggable, dirty/icon tabs) live in the
 * generic `LgTabStrip`; this component only maps projects onto its `tabs` model.
 * The main project stays pinned first (`fixed`) and out of the reorder set.
 * Switching and reordering are both inert during simulation, which binds to the
 * active project.
 */
@Component({
  selector: 'app-tab-bar',
  imports: [LgTabStrip, TranslocoDirective],
  templateUrl: './tab-bar.component.html'
})
export class TabBarComponent {
  private readonly projectService = inject(ProjectService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly customComponentService = inject(CustomComponentService);
  private readonly workModeService = inject(WorkModeService);
  private readonly transloco = inject(TranslocoService);

  // Re-derive tab labels when the active language changes.
  private readonly lang = toSignal(this.transloco.langChanges$);

  private readonly mainProject = this.projectService.mainProject;
  private readonly openComponents = this.projectService.openComponents;
  private readonly activeProject = this.projectService.activeProject;

  protected readonly isSimulation = computed(
    () => this.workModeService.mode() === WorkMode.SIMULATION
  );

  protected readonly tabs = computed<LgTabStripItem<Project>[]>(() => {
    this.lang();
    const active = this.activeProject();
    const tabs: LgTabStripItem<Project>[] = [];

    const main = this.mainProject();
    if (main) {
      tabs.push({
        data: main,
        label: this.name(main),
        icon: 'ph ph-house',
        active: main === active,
        dirty: this.metadataStore.isDirty(main),
        fixed: true,
        ariaLabel: `${this.transloco.translate('tabBar.mainProject')}: ${this.name(main)}`
      });
    }

    for (const comp of this.openComponents()) {
      tabs.push({
        data: comp,
        label: this.name(comp),
        icon: 'ph ph-circuitry',
        active: comp === active,
        dirty: this.metadataStore.isDirty(comp),
        closable: true
      });
    }

    return tabs;
  });

  private name(project: Project): string {
    return this.metadataStore.getMetadata(project)?.name ?? 'Untitled';
  }

  // Tab switching is disabled while simulating — the simulation binds to the
  // active project (a read-only variant comes with nested inspection later).
  protected activate(project: Project): void {
    if (this.isSimulation()) return;
    this.projectService.setActiveProject(project);
  }

  protected close(project: Project): void {
    if (this.isSimulation()) return;
    this.customComponentService.closeComponent(project);
  }

  protected drop(event: LgTabReorder): void {
    this.projectService.reorderOpenComponents(
      event.previousIndex,
      event.currentIndex
    );
  }
}
