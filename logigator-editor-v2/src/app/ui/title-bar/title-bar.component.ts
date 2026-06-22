import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Signal
} from '@angular/core';
import { MenubarModule } from 'primeng/menubar';
import { MenuItem } from 'primeng/api';
import { NgOptimizedImage } from '@angular/common';
import { TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import logoUrl from '@assets/logo.svg';
import { PersistenceService } from '../../persistence/persistence.service';
import { ProjectService } from '../../project/project.service';
import { DialogService } from 'primeng/dynamicdialog';
import { ConfirmationService } from 'primeng/api';
import { OpenProjectDialogComponent } from '../open-project-dialog/open-project-dialog.component';
import { NewComponentDialogComponent } from '../new-component-dialog/new-component-dialog.component';
import { SaveCoordinatorService } from '../save-coordinator.service';
import { ClipboardService } from '../../clipboard/clipboard.service';
import { ShortcutService } from '../../shortcuts/shortcut.service';
import { ShortcutActionEnum } from '../../shortcuts/shortcut-action.enum';
import { ShortcutManagerComponent } from '../../shortcuts/shortcut-manager/shortcut-manager.component';
import { map } from 'rxjs/operators';
import { Ripple } from 'primeng/ripple';
import { ShortcutDisplayComponent } from '../../shortcuts/shortcut-display/shortcut-display.component';
import { UserSettingsComponent } from '../user-settings/user-settings.component';
import { ProjectMetadataStore } from '../../persistence/project-metadata.store';

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
  private readonly translocoService = inject(TranslocoService);
  private readonly persistenceService = inject(PersistenceService);
  private readonly projectService = inject(ProjectService);
  private readonly projectMetadataStore = inject(ProjectMetadataStore);
  private readonly dialogService = inject(DialogService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly clipboardService = inject(ClipboardService);
  private readonly shortcutService = inject(ShortcutService);
  private readonly saveCoordinator = inject(SaveCoordinatorService);

  protected readonly logoUrl = logoUrl;

  protected items: Signal<MenuItem[]>;

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

  public constructor() {
    this.items = toSignal(
      this.translocoService.events$.pipe(map(() => this.generateMenuItems())),
      { initialValue: [] }
    );
  }

  private generateMenuItems(): MenuItem[] {
    return [
      {
        label: this.translocoService.translate('titleBar.menuBar.file.label'),
        items: [
          {
            label: this.translocoService.translate(
              'titleBar.menuBar.file.items.newProject.label'
            ),

            icon: 'ph ph-trash',
            command: () => this.newProject()
          },
          {
            label: this.translocoService.translate(
              'titleBar.menuBar.file.items.newComponent.label'
            ),
            shortcut: this.shortcutService.binding(
              ShortcutActionEnum.NEW_COMPONENT
            )(),
            command: () => this.newComponent()
          },
          {
            separator: true
          },
          {
            label: this.translocoService.translate(
              'titleBar.menuBar.file.items.open.label'
            ),
            shortcut: this.shortcutService.binding(ShortcutActionEnum.OPEN)(),
            command: () => this.openProject()
          },
          {
            label: this.translocoService.translate(
              'titleBar.menuBar.file.items.save.label'
            ),
            shortcut: this.shortcutService.binding(ShortcutActionEnum.SAVE)(),
            command: () => this.saveProject()
          },
          {
            label: this.translocoService.translate(
              'titleBar.menuBar.file.items.exportFile.label'
            ),
            command: () => this.exportFile()
          },
          {
            separator: true
          },
          {
            label: this.translocoService.translate(
              'titleBar.menuBar.file.items.generateImage.label'
            )
          }
        ]
      },
      {
        label: this.translocoService.translate('titleBar.menuBar.edit.label'),
        items: [
          {
            label: this.translocoService.translate(
              'titleBar.menuBar.edit.items.undo.label'
            ),
            shortcut: this.shortcutService.binding(ShortcutActionEnum.UNDO)(),
            command: () =>
              this.projectService.mainProject()?.actionManager.undo()
          },
          {
            label: this.translocoService.translate(
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
            label: this.translocoService.translate(
              'titleBar.menuBar.edit.items.cut.label'
            ),
            shortcut: this.shortcutService.binding(ShortcutActionEnum.CUT)(),
            command: () => this.cut()
          },
          {
            label: this.translocoService.translate(
              'titleBar.menuBar.edit.items.copy.label'
            ),
            shortcut: this.shortcutService.binding(ShortcutActionEnum.COPY)(),
            command: () => this.copy()
          },
          {
            label: this.translocoService.translate(
              'titleBar.menuBar.edit.items.paste.label'
            ),
            shortcut: this.shortcutService.binding(ShortcutActionEnum.PASTE)(),
            command: () => this.paste()
          },
          {
            separator: true
          },
          {
            label: this.translocoService.translate(
              'titleBar.menuBar.edit.items.delete.label'
            ),
            shortcut: this.shortcutService.binding(ShortcutActionEnum.DELETE)(),
            command: () => this.delete()
          },
          {
            separator: true
          },
          {
            label: this.translocoService.translate('shortcuts.title'),
            command: () => this.openShortcutManager()
          }
        ]
      },
      {
        label: 'View',
        items: [
          {
            label: this.translocoService.translate(
              'titleBar.menuBar.view.items.zoomOut.label'
            ),
            shortcut: this.shortcutService.binding(
              ShortcutActionEnum.ZOOM_OUT
            )(),
            command: () => this.projectService.mainProject()?.zoomOut()
          },
          {
            label: this.translocoService.translate(
              'titleBar.menuBar.view.items.zoomIn.label'
            ),
            shortcut: this.shortcutService.binding(
              ShortcutActionEnum.ZOOM_IN
            )(),
            command: () => this.projectService.mainProject()?.zoomIn()
          },
          {
            label: this.translocoService.translate(
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
        label: 'Help'
      }
    ];
  }

  private openShortcutManager(): void {
    this.dialogService.open(ShortcutManagerComponent, {
      header: this.translocoService.translate('shortcuts.title'),
      width: '40rem',
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
        header: this.translocoService.translate(
          'titleBar.discardChanges.header'
        ),
        message: this.translocoService.translate(
          'titleBar.discardChanges.message'
        ),
        acceptButtonProps: { severity: 'danger' },
        acceptLabel: this.translocoService.translate(
          'titleBar.discardChanges.accept'
        ),
        rejectButtonProps: { severity: 'secondary', outlined: true },
        rejectLabel: this.translocoService.translate(
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

  private exportFile(): void {
    const project = this.projectService.mainProject();
    if (project) {
      this.persistenceService.exportProjectToFile(project);
    }
  }

  private newComponent(): void {
    this.dialogService.open(NewComponentDialogComponent, {
      header: this.translocoService.translate(
        'titleBar.menuBar.file.items.newComponent.label'
      ),
      width: '28rem',
      modal: true,
      closable: true
    });
  }

  private openProject(): void {
    this.dialogService.open(OpenProjectDialogComponent, {
      header: this.translocoService.translate('openProjectDialog.title'),
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
