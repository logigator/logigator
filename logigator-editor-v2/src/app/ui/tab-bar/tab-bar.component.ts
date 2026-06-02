import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ProjectService } from '../../project/project.service';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';
import { CustomComponentService } from '../../custom-component/custom-component.service';
import { Project } from '../../project/project';

/**
 * The tab strip above the board: the main project plus one tab per open custom-
 * component editor. Clicking a tab switches the canvas via
 * {@link ProjectService.setActiveProject}; the ✕ on a component tab closes its
 * editor through {@link CustomComponentService.closeComponent}. The board already
 * renders whatever `activeProject()` is, so no board change is needed.
 */
@Component({
	selector: 'app-tab-bar',
	imports: [],
	templateUrl: './tab-bar.component.html',
	styleUrl: './tab-bar.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TabBarComponent {
	private readonly projectService = inject(ProjectService);
	private readonly metadataStore = inject(ProjectMetadataStore);
	private readonly customComponentService = inject(CustomComponentService);

	protected readonly mainProject = this.projectService.mainProject;
	protected readonly openComponents = this.projectService.openComponents;
	protected readonly activeProject = this.projectService.activeProject;

	protected name(project: Project): string {
		return this.metadataStore.getMetadata(project)?.name ?? 'Untitled';
	}

	protected activate(project: Project): void {
		this.projectService.setActiveProject(project);
	}

	protected close(event: Event, project: Project): void {
		event.stopPropagation();
		this.customComponentService.closeComponent(project);
	}
}
