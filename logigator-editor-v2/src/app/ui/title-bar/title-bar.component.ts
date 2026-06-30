import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import logoUrl from '@assets/logo.svg';
import { ProjectService } from '../../project/project.service';
import { LgMenubar, LgRipple } from '@logigator/ui';
import { ShortcutDisplayComponent } from '../../shortcuts/shortcut-display/shortcut-display.component';
import { UserSettingsComponent } from '../user-settings/user-settings.component';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';
import { EditorMenuService } from '../editor-menu.service';

@Component({
  selector: 'app-title-bar',
  imports: [
    LgMenubar,
    NgOptimizedImage,
    LgRipple,
    ShortcutDisplayComponent,
    UserSettingsComponent
  ],
  templateUrl: './title-bar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
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
