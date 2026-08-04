import { Component, computed, inject } from '@angular/core';
import { ComponentListComponent } from './component-list/component-list.component';
import { PortsPanelComponent } from '../ports-panel/ports-panel.component';
import { ProjectService } from '../../project/project.service';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';

@Component({
  selector: 'app-side-bar',
  imports: [ComponentListComponent, PortsPanelComponent],
  templateUrl: './side-bar.component.html'
})
export class SideBarComponent {
  private readonly projectService = inject(ProjectService);
  private readonly metadataStore = inject(ProjectMetadataStore);

  /** True while the active tab is a custom-component editor (`type: 'comp'`). */
  public readonly isEditingComponent = computed(() => {
    const active = this.projectService.activeProject();
    return !!active && this.metadataStore.getMetadata(active)?.type === 'comp';
  });
}
