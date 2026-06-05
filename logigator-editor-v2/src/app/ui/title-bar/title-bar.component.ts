import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Signal
} from '@angular/core';
import { MenubarModule } from 'primeng/menubar';
import { MenuItem } from 'primeng/api';
import { ToastService } from '../../logging/toast.service';
import { LoggingService } from '../../logging/logging.service';
import { NgOptimizedImage } from '@angular/common';
import { TranslocoService } from '@jsverse/transloco';
import { map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { HashedPipe } from '../../hashing/hashed.pipe';
import { PersistenceService } from '../../persistence/persistence.service';
import { ProjectService } from '../../project/project.service';
import { DialogService } from 'primeng/dynamicdialog';
import { OpenProjectDialogComponent } from '../open-project-dialog/open-project-dialog.component';
import { NewComponentDialogComponent } from '../new-component-dialog/new-component-dialog.component';

@Component({
  selector: 'app-title-bar',
  imports: [MenubarModule, NgOptimizedImage, HashedPipe],
  providers: [DialogService],
  templateUrl: './title-bar.component.html',
  styleUrl: './title-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TitleBarComponent {
  private readonly toastService = inject(ToastService);
  private readonly logging = inject(LoggingService);
  private readonly translocoService = inject(TranslocoService);
  private readonly persistenceService = inject(PersistenceService);
  private readonly projectService = inject(ProjectService);
  private readonly dialogService = inject(DialogService);

  public items: Signal<MenuItem[]>;

  public constructor() {
    const translocoService = this.translocoService;

    this.items = toSignal(
      translocoService.events$.pipe(map(() => this.generateMenuItems())),
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
            command: () => this.newProject()
          },
          {
            label: this.translocoService.translate(
              'titleBar.menuBar.file.items.newComponent.label'
            ),
            command: () => this.newComponent()
          },
          {
            separator: true
          },
          {
            label: this.translocoService.translate(
              'titleBar.menuBar.file.items.open.label'
            ),
            command: () => this.openProject()
          },
          {
            label: this.translocoService.translate(
              'titleBar.menuBar.file.items.save.label'
            ),
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
            command: () => this.undo()
          },
          {
            label: this.translocoService.translate(
              'titleBar.menuBar.edit.items.redo.label'
            ),
            command: () => this.redo()
          },
          {
            separator: true
          },
          {
            label: this.translocoService.translate(
              'titleBar.menuBar.edit.items.cut.label'
            )
          },
          {
            label: this.translocoService.translate(
              'titleBar.menuBar.edit.items.copy.label'
            )
          },
          {
            label: this.translocoService.translate(
              'titleBar.menuBar.edit.items.paste.label'
            )
          },
          {
            separator: true
          },
          {
            label: this.translocoService.translate(
              'titleBar.menuBar.edit.items.delete.label'
            )
          }
        ]
      },
      {
        label: 'View'
      },
      {
        label: 'Help'
      }
    ];
  }

  private newProject(): void {
    const name = prompt('Project name:');
    if (name) {
      this.persistenceService.createProject(name).catch(() => {
        this.logging.error('Failed to create project', 'TitleBarComponent');
        this.toastService.error('Failed to create project');
      });
    }
  }

  private saveProject(): void {
    const project = this.projectService.mainProject();
    if (project) {
      this.persistenceService.saveProject(project).catch(() => {
        this.logging.error('Failed to save project', 'TitleBarComponent');
        this.toastService.error('Failed to save project');
      });
    }
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

  private undo(): void {
    this.projectService.mainProject()?.actionManager.undo();
  }

  private redo(): void {
    this.projectService.mainProject()?.actionManager.redo();
  }
}
