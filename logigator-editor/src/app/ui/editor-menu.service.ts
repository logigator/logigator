import { computed, inject, Injectable, Signal } from '@angular/core';
import {
  ConfirmationService,
  DialogService,
  type MenuItem
} from '@logigator/ui';
import { TranslationService } from '../translation/translation.service';
import { PersistenceService } from '../persistence/persistence.service';
import { ProjectService } from '../project/project.service';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { ClipboardService } from '../clipboard/clipboard.service';
import { ShortcutService } from '../shortcuts/shortcut.service';
import { ShortcutActionEnum } from '../shortcuts/shortcut-action.enum';
import { SaveCoordinatorService } from './save-coordinator.service';
import { UploadCoordinatorService } from './upload/upload-coordinator.service';
import { OpenProjectDialogComponent } from './dialogs/open-project-dialog/open-project-dialog.component';
import { NewComponentDialogComponent } from './dialogs/new-component-dialog/new-component-dialog.component';
import { ShortcutManagerComponent } from '../shortcuts/shortcut-manager/shortcut-manager.component';
import { ExportImageDialogComponent } from './dialogs/export-image-dialog/export-image-dialog.component';
import { ShareDialogComponent } from './dialogs/share-dialog/share-dialog.component';
import { AboutDialogComponent } from './dialogs/about-dialog/about-dialog.component';
import { DebugMenuService } from './debug-menu.service';
import { ToastService } from '../logging/toast.service';

/**
 * Builds the menu models and owns the commands behind them: the desktop
 * File/Edit/View/Help menubar tree (`items`) and the curated flat list for the
 * compact menu sheet (`compactItems`). Both compose the same per-item builders,
 * so every action is defined exactly once.
 */
@Injectable({ providedIn: 'root' })
export class EditorMenuService {
  private readonly translation = inject(TranslationService);
  private readonly persistenceService = inject(PersistenceService);
  private readonly projectService = inject(ProjectService);
  private readonly projectMetadataStore = inject(ProjectMetadataStore);
  private readonly dialogService = inject(DialogService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly clipboardService = inject(ClipboardService);
  private readonly shortcutService = inject(ShortcutService);
  private readonly saveCoordinator = inject(SaveCoordinatorService);
  private readonly uploadCoordinator = inject(UploadCoordinatorService);
  private readonly debugMenuService = inject(DebugMenuService);
  private readonly toastService = inject(ToastService);

  /**
   * Rebuilt whenever the active language changes so labels stay translated.
   * Driven by `selectTranslation()` rather than `events$`: that source replays
   * the current language to late subscribers (this service is instantiated only
   * once the title bar renders, after the initial load event has fired), so the
   * menu is built immediately instead of waiting for the next language change.
   */
  public readonly items: Signal<MenuItem[]> = computed(() =>
    this.generateMenuItems()
  );

  /**
   * Flat, curated model for the compact editor sheet behind the top bar's
   * project title — every editor action from the desktop menubar that has no
   * dedicated compact surface (undo/redo/save/run live in the top bar,
   * cut/copy/paste/delete in the selection action bar, zoom in the FAB and
   * the pinch gesture, and keyboard shortcuts don't apply to touch). The
   * burger sheet stays editor-agnostic: it holds only the account/settings
   * panel.
   */
  public readonly compactItems: Signal<MenuItem[]> = computed(() =>
    this.generateCompactItems()
  );

  private generateMenuItems(): MenuItem[] {
    const items: MenuItem[] = [
      {
        label: this.translation.translate('titleBar.menuBar.file.label'),
        items: [
          this.newProjectItem(),
          this.newComponentItem(),
          {
            separator: true
          },
          this.openItem(),
          this.saveItem(),
          ...this.cloudItems(),
          ...this.exportFileItems(),
          {
            separator: true
          },
          this.generateImageItem()
        ]
      },
      {
        label: this.translation.translate('titleBar.menuBar.edit.label'),
        items: [
          {
            label: this.translation.translate(
              'titleBar.menuBar.edit.items.undo.label'
            ),
            shortcut: this.shortcutService.binding(ShortcutActionEnum.UNDO)(),
            command: () =>
              this.projectService.mainProject()?.actionManager.undo()
          },
          {
            label: this.translation.translate(
              'titleBar.menuBar.edit.items.redo.label'
            ),
            shortcut: this.shortcutService.binding(ShortcutActionEnum.REDO)(),
            command: () =>
              this.projectService.mainProject()?.actionManager.redo()
          },
          {
            separator: true
          },
          {
            label: this.translation.translate(
              'titleBar.menuBar.edit.items.cut.label'
            ),
            shortcut: this.shortcutService.binding(ShortcutActionEnum.CUT)(),
            command: () => this.cut()
          },
          {
            label: this.translation.translate(
              'titleBar.menuBar.edit.items.copy.label'
            ),
            shortcut: this.shortcutService.binding(ShortcutActionEnum.COPY)(),
            command: () => this.copy()
          },
          {
            label: this.translation.translate(
              'titleBar.menuBar.edit.items.paste.label'
            ),
            shortcut: this.shortcutService.binding(ShortcutActionEnum.PASTE)(),
            command: () => this.paste()
          },
          {
            separator: true
          },
          {
            label: this.translation.translate(
              'titleBar.menuBar.edit.items.delete.label'
            ),
            shortcut: this.shortcutService.binding(ShortcutActionEnum.DELETE)(),
            command: () => this.delete()
          },
          {
            separator: true
          },
          {
            label: this.translation.translate('shortcuts.title'),
            command: () => this.openShortcutManager()
          }
        ]
      },
      {
        label: this.translation.translate('titleBar.menuBar.view.label'),
        items: [
          {
            label: this.translation.translate(
              'titleBar.menuBar.view.items.zoomOut.label'
            ),
            shortcut: this.shortcutService.binding(
              ShortcutActionEnum.ZOOM_OUT
            )(),
            command: () => this.projectService.mainProject()?.zoomOut()
          },
          {
            label: this.translation.translate(
              'titleBar.menuBar.view.items.zoomIn.label'
            ),
            shortcut: this.shortcutService.binding(
              ShortcutActionEnum.ZOOM_IN
            )(),
            command: () => this.projectService.mainProject()?.zoomIn()
          },
          {
            label: this.translation.translate(
              'titleBar.menuBar.view.items.zoom100.label'
            ),
            shortcut: this.shortcutService.binding(
              ShortcutActionEnum.ZOOM_100
            )(),
            command: () => this.projectService.mainProject()?.zoom100()
          }
        ]
      },
      {
        label: this.translation.translate('titleBar.menuBar.help.label'),
        items: [this.aboutItem()]
      }
    ];

    const debugMenu = this.debugMenuService.buildMenuItem();
    if (debugMenu) items.push(debugMenu);

    return items;
  }

  private generateCompactItems(): MenuItem[] {
    const items: MenuItem[] = [
      this.newProjectItem(),
      this.newComponentItem(),
      this.openItem(),
      {
        separator: true
      },
      ...this.cloudItems(),
      ...this.exportFileItems(),
      this.generateImageItem(),
      { separator: true },
      this.aboutItem()
    ];

    const debugMenu = this.debugMenuService.buildMenuItem();
    if (debugMenu) items.push({ separator: true }, debugMenu);

    return items;
  }

  private newProjectItem(): MenuItem {
    return {
      label: this.translation.translate(
        'titleBar.menuBar.file.items.newProject.label'
      ),
      icon: 'ph ph-file-plus',
      command: () => this.newProject()
    };
  }

  private newComponentItem(): MenuItem {
    return {
      label: this.translation.translate(
        'titleBar.menuBar.file.items.newComponent.label'
      ),
      icon: 'ph ph-circuitry',
      shortcut: this.shortcutService.binding(
        ShortcutActionEnum.NEW_COMPONENT
      )(),
      command: () => this.newComponent()
    };
  }

  private openItem(): MenuItem {
    return {
      label: this.translation.translate(
        'titleBar.menuBar.file.items.open.label'
      ),
      icon: 'ph ph-folder-open',
      shortcut: this.shortcutService.binding(ShortcutActionEnum.OPEN)(),
      command: () => this.openProject()
    };
  }

  private saveItem(): MenuItem {
    return {
      label: this.translation.translate(
        'titleBar.menuBar.file.items.save.label'
      ),
      icon: 'ph ph-floppy-disk',
      shortcut: this.shortcutService.binding(ShortcutActionEnum.SAVE)(),
      command: () => this.saveProject()
    };
  }

  /** Upload/share follow the open project's source; empty when neither applies. */
  private cloudItems(): MenuItem[] {
    const items: MenuItem[] = [];
    if (this.canUploadMainProject()) {
      items.push({
        label: this.translation.translate(
          'titleBar.menuBar.file.items.uploadCloud.label'
        ),
        icon: 'ph ph-cloud-arrow-up',
        command: () => this.uploadProject()
      });
    }
    if (this.canShareMainProject()) {
      items.push({
        label: this.translation.translate(
          'titleBar.menuBar.file.items.share.label'
        ),
        icon: 'ph ph-share-network',
        command: () => this.shareProject()
      });
    }
    return items;
  }

  /** Export-to-file, omitted for read-only shares. */
  private exportFileItems(): MenuItem[] {
    if (!this.canExportMainProject()) return [];
    return [
      {
        label: this.translation.translate(
          'titleBar.menuBar.file.items.exportFile.label'
        ),
        icon: 'ph ph-download-simple',
        command: () => void this.exportFile()
      }
    ];
  }

  /**
   * Whether the open project may be exported to a file. Every source except a
   * borrowed `share` can: exporting a read-only share would let it be
   * re-imported as the user's own.
   */
  private canExportMainProject(): boolean {
    const project = this.projectService.mainProject();
    const metadata = project
      ? this.projectMetadataStore.getMetadata(project)
      : null;
    return !!metadata && metadata.source !== 'share';
  }

  private generateImageItem(): MenuItem {
    return {
      label: this.translation.translate(
        'titleBar.menuBar.file.items.generateImage.label'
      ),
      icon: 'ph ph-image',
      command: () => this.generateImage()
    };
  }

  private openShortcutManager(): void {
    this.dialogService.open(ShortcutManagerComponent, {
      header: this.translation.translate('shortcuts.title'),
      width: '40rem',
      modal: true,
      closable: true
    });
  }

  private aboutItem(): MenuItem {
    return {
      label: this.translation.translate(
        'titleBar.menuBar.help.items.about.label'
      ),
      icon: 'ph ph-info',
      command: () => this.openAbout()
    };
  }

  private openAbout(): void {
    this.dialogService.open(AboutDialogComponent, {
      header: this.translation.translate('aboutDialog.header'),
      width: '28rem',
      modal: true,
      closable: true
    });
  }

  /**
   * Creates a fresh blank board. No name/destination is asked up front — that
   * prompt is deferred to the first save (see {@link SaveCoordinatorService}).
   * If the current project has unsaved changes, confirms the discard first since
   * replacing the main project throws them away.
   */
  private newProject(): void {
    const project = this.projectService.mainProject();
    if (project && this.projectMetadataStore.isDirty(project)) {
      this.confirmationService.confirm({
        header: this.translation.translate('titleBar.discardChanges.header'),
        message: this.translation.translate('titleBar.discardChanges.message'),
        acceptButtonProps: { severity: 'danger' },
        acceptLabel: this.translation.translate(
          'titleBar.discardChanges.accept'
        ),
        rejectButtonProps: { severity: 'secondary', outlined: true },
        rejectLabel: this.translation.translate(
          'titleBar.discardChanges.reject'
        ),
        accept: () => this.persistenceService.createAndSetEmptyProject()
      });
    } else {
      this.persistenceService.createAndSetEmptyProject();
    }
  }

  private saveProject(): void {
    const project = this.projectService.activeProject();
    if (project) void this.saveCoordinator.requestSave(project);
  }

  /**
   * Whether the open project is a stored **local** project — the only case that
   * can be moved to the cloud. Reads the metadata signal so the menu item toggles
   * as the source flips (e.g. right after an upload).
   */
  private canUploadMainProject(): boolean {
    const project = this.projectService.mainProject();
    const metadata = project
      ? this.projectMetadataStore.getMetadata(project)
      : null;
    return (
      metadata?.type === 'project' &&
      metadata.source === 'browser' &&
      metadata.id !== ''
    );
  }

  private uploadProject(): void {
    const project = this.projectService.mainProject();
    if (project) {
      void this.uploadCoordinator.requestUpload({ kind: 'project', project });
    }
  }

  /**
   * Whether the open project is a stored **cloud** project — the only case that
   * has a share link to manage. Reads the metadata signal so the menu item
   * toggles as the source flips (e.g. right after an upload to the cloud).
   */
  private canShareMainProject(): boolean {
    const project = this.projectService.mainProject();
    const metadata = project
      ? this.projectMetadataStore.getMetadata(project)
      : null;
    return metadata?.type === 'project' && metadata.source === 'server';
  }

  private shareProject(): void {
    const project = this.projectService.mainProject();
    if (!project) return;
    const metadata = this.projectMetadataStore.getMetadata(project);
    if (!metadata?.id) return;
    this.dialogService.open(ShareDialogComponent, {
      header: this.translation.translate('shareDialog.header'),
      width: '32rem',
      modal: true,
      closable: true,
      data: {
        kind: 'project',
        projectId: metadata.id,
        name: metadata.name,
        link: metadata.link ?? '',
        isPublic: metadata.isPublic ?? false
      }
    });
  }

  private async exportFile(): Promise<void> {
    const project = this.projectService.mainProject();
    if (!project) return;
    try {
      await this.persistenceService.exportProjectToFile(project);
      this.toastService.success(
        this.translation.translate('persistence.projectExported'),
        'EditorMenuService'
      );
    } catch (err) {
      this.toastService.error(
        this.translation.translate('persistence.exportFailed'),
        'EditorMenuService',
        err
      );
    }
  }

  private generateImage(): void {
    this.dialogService.open(ExportImageDialogComponent, {
      header: this.translation.translate('imageExport.title'),
      width: '28rem',
      modal: true,
      closable: true
    });
  }

  private newComponent(): void {
    this.dialogService.open(NewComponentDialogComponent, {
      header: this.translation.translate(
        'titleBar.menuBar.file.items.newComponent.label'
      ),
      width: '28rem',
      modal: true,
      closable: true
    });
  }

  private openProject(): void {
    this.dialogService.open(OpenProjectDialogComponent, {
      header: this.translation.translate('openProjectDialog.title'),
      width: '40rem',
      modal: true,
      closable: true
    });
  }

  private cut(): void {
    const project = this.projectService.activeProject();
    if (project) this.clipboardService.cut(project);
  }

  private copy(): void {
    const project = this.projectService.activeProject();
    if (project) this.clipboardService.copy(project);
  }

  private paste(): void {
    const project = this.projectService.activeProject();
    if (project) this.clipboardService.paste(project);
  }

  private delete(): void {
    const project = this.projectService.activeProject();
    if (project) this.clipboardService.delete(project);
  }
}
