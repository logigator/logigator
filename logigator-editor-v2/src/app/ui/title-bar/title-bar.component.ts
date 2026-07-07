import { Component, computed, inject } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import logoUrl from '@assets/logo.svg';
import { ProjectService } from '../../project/project.service';
import { LgMenubar } from '@logigator/ui';
import { TranslocoDirective } from '@jsverse/transloco';
import { UserSettingsComponent } from '../user-settings/user-settings.component';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';
import { EditorMenuService } from '../editor-menu.service';
import {
  SourceIndicatorComponent,
  SourceIndicatorState
} from '../source-indicator/source-indicator.component';

@Component({
  selector: 'app-title-bar',
  imports: [
    LgMenubar,
    NgOptimizedImage,
    UserSettingsComponent,
    SourceIndicatorComponent,
    TranslocoDirective
  ],
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

  /**
   * The provenance/state chip shown next to the project name: `server` (cloud),
   * `browser` (saved locally), `draft` (a browser circuit not yet written to
   * storage — empty id) or `share` (opened read-only from a share link). Covers
   * both projects and component editors shown as main; `null` only when there is
   * no project. The upload affordance lives in the File menu and Open dialog.
   */
  protected readonly sourceChip = computed<SourceIndicatorState | null>(() => {
    const metadata = this.projectMetadata();
    if (!metadata) return null;
    if (metadata.source === 'share') return 'share';
    if (metadata.source === 'server') return 'server';
    return metadata.id !== '' ? 'browser' : 'draft';
  });
}
