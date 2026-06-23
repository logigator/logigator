import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';
import { MenubarModule } from 'primeng/menubar';
import { NgOptimizedImage } from '@angular/common';
import logoUrl from '@assets/logo.svg';
import { ProjectService } from '../../project/project.service';
import { Ripple } from 'primeng/ripple';
import { ShortcutDisplayComponent } from '../../shortcuts/shortcut-display/shortcut-display.component';
import { UserSettingsComponent } from '../user-settings/user-settings.component';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';
import { EditorMenuService } from '../editor-menu.service';

@Component({
  selector: 'app-title-bar',
  imports: [
    MenubarModule,
    NgOptimizedImage,
    Ripple,
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

  protected readonly menuTheme = {
    background: '{primary.400}',
    borderRadius: '0',
    color: '{surface.900}',
    itemColor: '',
    // Popup submenu sits on the themed content surface, so its text/icon track
    // the active theme instead of a fixed light-grey that washes out in light.
    submenuColor: '{text.color}',
    submenuIconColor: '{text.muted.color}',
    padding: '0.25rem'
  };
}
