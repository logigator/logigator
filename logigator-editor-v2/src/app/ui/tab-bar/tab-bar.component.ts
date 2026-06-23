import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { TranslocoDirective } from '@jsverse/transloco';
import { ProjectService } from '../../project/project.service';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';
import { CustomComponentService } from '../../custom-component/custom-component.service';
import { WorkMode } from '../../work-mode/work-mode.enum';
import { WorkModeService } from '../../work-mode/work-mode.service';
import { Project } from '../../project/project';
import { LayoutService } from '../../layout/layout.service';

/**
 * The tab strip above the board: the pinned main project plus one tab per open
 * custom-component editor. Clicking a tab switches the canvas via
 * {@link ProjectService.setActiveProject}; the ✕ on a component tab closes its
 * editor through {@link CustomComponentService.closeComponent}. The board already
 * renders whatever `activeProject()` is, so no board change is needed.
 *
 * The component tabs are reorderable via CDK drag-drop (horizontal, x-axis
 * locked); the main project stays pinned first and is not part of the drop
 * list. Reordering is session-only state held by {@link ProjectService}.
 * Switching and reordering are both inert during simulation, which binds to the
 * active project.
 */
@Component({
  selector: 'app-tab-bar',
  imports: [DragDropModule, TranslocoDirective],
  templateUrl: './tab-bar.component.html',
  styleUrl: './tab-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TabBarComponent {
  private readonly projectService = inject(ProjectService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly customComponentService = inject(CustomComponentService);
  private readonly workModeService = inject(WorkModeService);
  private readonly layout = inject(LayoutService);

  /** A finger can't hover, so the tab close button can't hide behind hover. */
  protected readonly isTouch = this.layout.isTouch;

  protected readonly mainProject = this.projectService.mainProject;
  protected readonly openComponents = this.projectService.openComponents;
  protected readonly activeProject = this.projectService.activeProject;

  protected readonly isSimulation = computed(
    () => this.workModeService.mode() === WorkMode.SIMULATION
  );

  protected isActive(project: Project): boolean {
    return this.activeProject() === project;
  }

  protected name(project: Project): string {
    return this.metadataStore.getMetadata(project)?.name ?? 'Untitled';
  }

  protected isDirty(project: Project): boolean {
    return this.metadataStore.isDirty(project);
  }

  // Tab switching is disabled while simulating — the simulation binds to the
  // active project (a read-only variant comes with nested inspection later).
  protected activate(project: Project): void {
    if (this.isSimulation()) return;
    this.projectService.setActiveProject(project);
  }

  protected close(event: Event, project: Project): void {
    event.stopPropagation();
    if (this.isSimulation()) return;
    this.customComponentService.closeComponent(project);
  }

  protected drop(event: CdkDragDrop<Project[]>): void {
    this.projectService.reorderOpenComponents(
      event.previousIndex,
      event.currentIndex
    );
  }
}
