import { Component, computed, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import logoUrl from '@assets/logo.svg';
import { ProjectService } from '../../project/project.service';
import { LgMenubar } from '@logigator/ui';
import { UserSettingsComponent } from '../user-settings/user-settings.component';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';
import { EditorMenuService } from '../editor-menu.service';

@Component({
  selector: 'app-title-bar',
  imports: [LgMenubar, NgOptimizedImage, UserSettingsComponent],
  templateUrl: './title-bar.component.html'
})
export class TitleBarComponent {
  private readonly projectService = inject(ProjectService);
  private readonly projectMetadataStore = inject(ProjectMetadataStore);

  protected readonly logoUrl = logoUrl;

  protected readonly items = inject(EditorMenuService).items;

  protected readonly projectMetadata = computed(() => {
    const project = this.projectService.mainProject();
    if (!project) {
      return null;
    }

    return this.projectMetadataStore.getMetadata(project) ?? null;
  });

  protected readonly projectName = computed(
    () => this.projectMetadata()?.name ?? ''
  );
}
