import { computed, inject, Injectable, Injector, Signal } from '@angular/core';
import { DialogService, type MenuItem } from '@logigator/ui';
import { DialogId } from '../analytics/analytics.mapping';
import { TranslationService } from '../translation/translation.service';
import { PersistenceService } from '../persistence/persistence.service';
import { ProjectService } from '../project/project.service';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { ClipboardService } from '../clipboard/clipboard.service';
import { ShortcutService } from '../shortcuts/shortcut.service';
import { ShortcutActionEnum } from '../shortcuts/shortcut-action.enum';
import { SaveCoordinatorService } from './save-coordinator.service';
import { DiscardChangesService } from './discard-changes.service';
import { UploadCoordinatorService } from './upload/upload-coordinator.service';
import { OpenProjectDialogComponent } from './dialogs/open-project-dialog/open-project-dialog.component';
import { NewComponentDialogComponent } from './dialogs/new-component-dialog/new-component-dialog.component';
import { ShortcutManagerComponent } from '../shortcuts/shortcut-manager/shortcut-manager.component';
import { ExportImageDialogComponent } from './dialogs/export-image-dialog/export-image-dialog.component';
import { ShareDialogComponent } from './dialogs/share-dialog/share-dialog.component';
import { AboutDialogComponent } from './dialogs/about-dialog/about-dialog.component';
import { ChangelogService } from '../changelog/changelog.service';
import { DocumentationService } from '../documentation/documentation.service';
import { OnboardingService } from '../onboarding/onboarding.service';
import { DebugMenuService } from './debug-menu.service';
import { DebugMenuToggleService } from './debug-menu-toggle.service';
import { ConsentService } from '../consent/consent.service';
import { WireRepairService } from '../project/wire-repair.service';
import { ToastService } from '../logging/toast.service';
import { isHandledSaveError } from '../persistence/persistence-errors';
import { LegacyEditorService } from './legacy-editor.service';

/**
 * Builds the menu models and owns the commands behind them: the desktop menubar
 * tree (`items`) and the flat compact list (`compactItems`). Both compose the
 * same per-item builders, so every action is defined exactly once.
 */
@Injectable({ providedIn: 'root' })
export class EditorMenuService {
  private readonly translation = inject(TranslationService);
  private readonly persistenceService = inject(PersistenceService);
  private readonly projectService = inject(ProjectService);
  private readonly projectMetadataStore = inject(ProjectMetadataStore);
  private readonly dialogService = inject(DialogService);
  private readonly changelogService = inject(ChangelogService);
  private readonly documentationService = inject(DocumentationService);
  private readonly onboardingService = inject(OnboardingService);
  private readonly discardChanges = inject(DiscardChangesService);
  private readonly clipboardService = inject(ClipboardService);
  private readonly shortcutService = inject(ShortcutService);
  private readonly saveCoordinator = inject(SaveCoordinatorService);
  private readonly uploadCoordinator = inject(UploadCoordinatorService);
  private readonly injector = inject(Injector);
  private readonly toastService = inject(ToastService);
  private readonly consentService = inject(ConsentService);
  private readonly wireRepairService = inject(WireRepairService);
  private readonly legacyEditorService = inject(LegacyEditorService);
  private readonly debugMenuToggle = inject(DebugMenuToggleService);

  /** Rebuilt whenever the active language changes so labels stay translated. */
  public readonly items: Signal<MenuItem[]> = computed(() =>
    this.generateMenuItems()
  );

  /**
   * Flat model for the compact editor sheet: every menubar action that has no
   * dedicated compact surface of its own. Undo/redo/save/run live in the top
   * bar, cut/copy/paste/delete in the selection action bar, zoom in the FAB,
   * and keyboard shortcuts don't apply to touch.
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
          ...this.saveItems(),
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
          this.repairWiresItem(),
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
            command: () => this.projectService.mainProject()?.viewport.zoomOut()
          },
          {
            label: this.translation.translate(
              'titleBar.menuBar.view.items.zoomIn.label'
            ),
            shortcut: this.shortcutService.binding(
              ShortcutActionEnum.ZOOM_IN
            )(),
            command: () => this.projectService.mainProject()?.viewport.zoomIn()
          },
          {
            label: this.translation.translate(
              'titleBar.menuBar.view.items.zoom100.label'
            ),
            shortcut: this.shortcutService.binding(
              ShortcutActionEnum.ZOOM_100
            )(),
            command: () => this.projectService.mainProject()?.viewport.zoom100()
          }
        ]
      },
      {
        label: this.translation.translate('titleBar.menuBar.help.label'),
        items: [
          this.documentationItem(),
          this.changelogItem(),
          this.showTipsAgainItem(),
          this.legacyEditorItem(),
          ...this.cookieSettingsItems(),
          this.aboutItem()
        ]
      }
    ];

    // Resolved inside the guard rather than through an `inject()` field: the
    // debug menu reaches half a dozen services, none of which should be
    // constructed in a session that never turns the menu on.
    if (this.debugMenuToggle.enabled())
      items.push(this.injector.get(DebugMenuService).buildMenuItem());

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
      this.repairWiresItem(),
      { separator: true },
      this.documentationItem(),
      this.changelogItem(),
      this.showTipsAgainItem(),
      this.legacyEditorItem(),
      ...this.cookieSettingsItems(),
      this.aboutItem()
    ];

    if (this.debugMenuToggle.enabled())
      items.push(
        { separator: true },
        this.injector.get(DebugMenuService).buildMenuItem()
      );

    return items;
  }

  private newProjectItem(): MenuItem {
    return {
      label: this.translation.translate(
        'titleBar.menuBar.file.items.newProject.label'
      ),
      icon: 'ph ph-file-plus',
      command: () => void this.newProject()
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

  /**
   * Save, omitted for read-only shares, where cloning is the way to keep one.
   * Gated on the *active* project, so a component tab stays savable while a
   * share sits in the main slot.
   */
  private saveItems(): MenuItem[] {
    const project = this.projectService.activeProject();
    const metadata = project
      ? this.projectMetadataStore.getMetadata(project)
      : null;
    if (metadata?.source === 'share') return [];
    return [
      {
        label: this.translation.translate(
          'titleBar.menuBar.file.items.save.label'
        ),
        icon: 'ph ph-floppy-disk',
        shortcut: this.shortcutService.binding(ShortcutActionEnum.SAVE)(),
        command: () => this.saveProject()
      }
    ];
  }

  /** Upload/share/clone follow the open project's source. */
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
    const shareKind = this.cloneableShareKind();
    if (shareKind) {
      items.push({
        label: this.translation.translate(
          shareKind === 'comp'
            ? 'titleBar.menuBar.file.items.cloneShareComponent.label'
            : 'titleBar.menuBar.file.items.cloneShare.label'
        ),
        icon: 'ph ph-git-fork',
        command: () => void this.cloneShare()
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
   * Every source except a borrowed `share` may be exported: exporting a
   * read-only share would let it be re-imported as the user's own.
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
      closable: true,
      telemetryId: DialogId.ShortcutManager
    });
  }

  private cookieSettingsItems(): MenuItem[] {
    // The consent banner comes from the backend-served bundle; without it
    // (bare ng serve) there are no preferences to manage. It loads
    // asynchronously, so the signal read recomputes the menus once it arrives.
    if (!this.consentService.available()) return [];
    return [
      {
        label: this.translation.translate(
          'titleBar.menuBar.help.items.cookieSettings.label'
        ),
        icon: 'ph ph-cookie',
        command: () => this.consentService.showPreferences()
      }
    ];
  }

  /**
   * Escape hatch to the previous editor. Opens a new tab, so anything unsaved
   * survives here and no dirty guard is needed.
   */
  private legacyEditorItem(): MenuItem {
    return {
      label: this.translation.translate(
        'titleBar.menuBar.help.items.legacyEditor.label'
      ),
      icon: 'ph ph-clock-counter-clockwise',
      command: () => this.legacyEditorService.open('menu')
    };
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
      closable: true,
      telemetryId: DialogId.About
    });
  }

  private documentationItem(): MenuItem {
    return {
      label: this.translation.translate(
        'titleBar.menuBar.help.items.documentation.label'
      ),
      icon: 'ph ph-book-open',
      command: () => this.documentationService.open()
    };
  }

  private changelogItem(): MenuItem {
    return {
      label: this.translation.translate(
        'titleBar.menuBar.help.items.changelog.label'
      ),
      icon: 'ph ph-megaphone',
      command: () => this.openChangelog()
    };
  }

  private openChangelog(): void {
    this.changelogService.open();
  }

  private showTipsAgainItem(): MenuItem {
    return {
      label: this.translation.translate('onboarding.menu.showTipsAgain'),
      icon: 'ph ph-lightbulb',
      command: () => this.showTipsAgain()
    };
  }

  private showTipsAgain(): void {
    this.onboardingService.showTipsAgain();
    this.toastService.info(
      this.translation.translate('onboarding.toast.tipsReset'),
      'EditorMenuService'
    );
  }

  /**
   * Creates a fresh blank board. Name and destination are not asked up front;
   * that prompt is deferred to the first save. Replacing the main project
   * throws away unsaved changes, so confirm the discard first.
   */
  private async newProject(): Promise<void> {
    if (!(await this.discardChanges.confirmDiscardMain())) return;
    this.persistenceService.createAndSetEmptyProject();
  }

  private saveProject(): void {
    const project = this.projectService.activeProject();
    if (project) void this.saveCoordinator.requestSave(project);
  }

  /**
   * A stored **local** project is the only case that can be moved to the cloud.
   * Reads the metadata signal so the item toggles as the source flips.
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
   * A stored **cloud** project is the only case that has a share link to
   * manage. Reads the metadata signal so the item toggles as the source flips.
   */
  private canShareMainProject(): boolean {
    const project = this.projectService.mainProject();
    const metadata = project
      ? this.projectMetadataStore.getMetadata(project)
      : null;
    return metadata?.type === 'project' && metadata.source === 'server';
  }

  /**
   * Which kind of read-only **share** is open as main, or `null` for anything
   * else — a share is the only case that can be cloned into the user's own
   * library. The kind decides both the label and the clone endpoint.
   */
  private cloneableShareKind(): 'project' | 'comp' | null {
    const project = this.projectService.mainProject();
    const metadata = project
      ? this.projectMetadataStore.getMetadata(project)
      : null;
    if (metadata?.source !== 'share' || !metadata.link) return null;
    return metadata.type;
  }

  /**
   * Clones the open share into the user's cloud projects — the server copies
   * the circuit and records the fork — and loads the copy as main. The
   * gateway's auth guard already toasts a signed-out user, so only unhandled
   * failures are reported here.
   */
  private async cloneShare(): Promise<void> {
    const project = this.projectService.mainProject();
    const metadata = project
      ? this.projectMetadataStore.getMetadata(project)
      : null;
    if (metadata?.source !== 'share' || !metadata.link) return;
    try {
      await this.persistenceService.cloneShare(metadata.link);
      this.toastService.success(
        this.translation.translate('persistence.shareCloned'),
        'EditorMenuService'
      );
    } catch (err) {
      if (!isHandledSaveError(err)) {
        this.toastService.error(
          this.translation.translate('persistence.shareCloneFailed'),
          'EditorMenuService',
          err
        );
      }
    }
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
      telemetryId: DialogId.ShareProject,
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
      closable: true,
      telemetryId: DialogId.ExportImage
    });
  }

  private newComponent(): void {
    this.dialogService.open(NewComponentDialogComponent, {
      header: this.translation.translate(
        'titleBar.menuBar.file.items.newComponent.label'
      ),
      width: '28rem',
      modal: true,
      closable: true,
      telemetryId: DialogId.NewComponent
    });
  }

  private openProject(): void {
    this.dialogService.open(OpenProjectDialogComponent, {
      header: this.translation.translate('openProjectDialog.title'),
      width: '40rem',
      modal: true,
      closable: true,
      telemetryId: DialogId.OpenProject
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

  private repairWiresItem(): MenuItem {
    return {
      label: this.translation.translate(
        'titleBar.menuBar.edit.items.repairWires.label'
      ),
      icon: 'ph ph-wrench',
      command: () => this.repairWires()
    };
  }

  private repairWires(): void {
    const project = this.projectService.activeProject();
    if (project) this.wireRepairService.repairManually(project);
  }
}
