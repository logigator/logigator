import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal
} from '@angular/core';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { TabsModule } from 'primeng/tabs';
import { type FileSelectEvent, FileUploadModule } from 'primeng/fileupload';
import { TranslocoDirective } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { PersistenceService } from '../../persistence/persistence.service';
import { ToastService } from '../../logging/toast.service';
import { LoggingService } from '../../logging/logging.service';
import { UserService } from '../../user/user.service';
import {
  ProjectListComponent,
  type ProjectListItem
} from '../project-list/project-list.component';
import type { BrowserProjectSummary } from '../../persistence/browser/browser-project.types';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-open-project-dialog',
  imports: [TabsModule, FileUploadModule, TranslocoDirective, ProjectListComponent],
  templateUrl: './open-project-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OpenProjectDialogComponent implements OnInit {
  private readonly ref = inject(DynamicDialogRef);
  private readonly persistenceService = inject(PersistenceService);
  private readonly toastService = inject(ToastService);
  private readonly loggingService = inject(LoggingService);
  protected readonly userService = inject(UserService);

  protected readonly activeTab = signal<string>('local');
  protected readonly importError = signal<string | null>(null);

  // --- Local source ---
  private readonly localAllItems = signal<BrowserProjectSummary[]>([]);
  protected readonly loadingLocal = signal(false);
  protected readonly localPage = signal(1);
  protected readonly localSearch = signal('');

  protected readonly localFiltered = computed(() => {
    const q = this.localSearch().toLowerCase().trim();
    const all = this.localAllItems();
    return q ? all.filter((p) => p.name.toLowerCase().includes(q)) : all;
  });

  protected readonly localItems = computed((): ProjectListItem[] => {
    const start = (this.localPage() - 1) * PAGE_SIZE;
    return this.localFiltered()
      .slice(start, start + PAGE_SIZE)
      .map((p) => ({ id: p.id, name: p.name, lastEdited: p.lastEdited }));
  });

  protected readonly localTotal = computed(() => this.localFiltered().length);

  // --- Server source ---
  protected readonly serverItems = signal<ProjectListItem[]>([]);
  protected readonly loadingServer = signal(false);
  protected readonly serverPage = signal(1);
  protected readonly serverTotal = signal(0);
  private readonly serverLoaded = signal(false);

  ngOnInit(): void {
    this.loadLocalProjects();
  }

  protected onTabChange(tab: string | number | undefined): void {
    if (typeof tab !== 'string') return;
    this.activeTab.set(tab);
    if (tab === 'server' && !this.serverLoaded() && this.userService.user()) {
      void this.loadServerProjects();
    }
  }

  // --- Local handlers ---

  private loadLocalProjects(): void {
    this.loadingLocal.set(true);
    this.persistenceService
      .listBrowserProjects()
      .then((projects) => {
        this.localAllItems.set(projects);
        this.loadingLocal.set(false);
      })
      .catch(() => {
        this.loggingService.error(
          'Failed to list local projects',
          'OpenProjectDialogComponent'
        );
        this.toastService.error('Failed to list local projects');
        this.loadingLocal.set(false);
      });
  }

  protected onLocalSearch(query: string): void {
    this.localSearch.set(query);
    this.localPage.set(1);
  }

  protected openLocalProject(id: string): void {
    this.persistenceService.loadLocalProjectAsMain(id).catch(() => {
      this.loggingService.error(
        'Failed to open local project',
        'OpenProjectDialogComponent'
      );
      this.toastService.error('Failed to open local project');
    });
    this.ref.close();
  }

  protected deleteLocalConfirmed(item: ProjectListItem): void {
    this.persistenceService
      .deleteBrowserProject(item.id)
      .then(() => this.loadLocalProjects())
      .catch(() => {
        this.loggingService.error(
          'Failed to delete local project',
          'OpenProjectDialogComponent'
        );
        this.toastService.error('Failed to delete local project');
      });
  }

  // --- Server handlers ---

  private async loadServerProjects(page = 1): Promise<void> {
    this.loadingServer.set(true);
    try {
      const result = await firstValueFrom(
        this.persistenceService.listProjects(page)
      );
      this.serverItems.set(
        result.entries.map((p) => ({
          id: p.id,
          name: p.name,
          lastEdited: p.lastEdited
        }))
      );
      this.serverTotal.set(result.total);
      this.serverPage.set(page);
      this.serverLoaded.set(true);
    } catch {
      this.loggingService.error(
        'Failed to list server projects',
        'OpenProjectDialogComponent'
      );
      this.toastService.error('Failed to list server projects');
    } finally {
      this.loadingServer.set(false);
    }
  }

  protected onServerSearch(query: string): void {
    this.loadingServer.set(true);
    firstValueFrom(this.persistenceService.listProjects(1, query))
      .then((result) => {
        this.serverItems.set(
          result.entries.map((p) => ({
            id: p.id,
            name: p.name,
            lastEdited: p.lastEdited
          }))
        );
        this.serverTotal.set(result.total);
        this.serverPage.set(1);
      })
      .catch(() => {
        this.loggingService.error(
          'Failed to search server projects',
          'OpenProjectDialogComponent'
        );
        this.toastService.error('Failed to search server projects');
      })
      .finally(() => this.loadingServer.set(false));
  }

  protected onServerPageChange(page: number): void {
    void this.loadServerProjects(page);
  }

  protected openServerProject(id: string): void {
    this.persistenceService.loadProjectAsMain(id).catch(() => {
      this.loggingService.error(
        'Failed to open server project',
        'OpenProjectDialogComponent'
      );
      this.toastService.error('Failed to open server project');
    });
    this.ref.close();
  }

  protected deleteServerConfirmed(item: ProjectListItem): void {
    firstValueFrom(this.persistenceService.deleteProject(item.id))
      .then(() => this.loadServerProjects(this.serverPage()))
      .catch(() => {
        this.loggingService.error(
          'Failed to delete server project',
          'OpenProjectDialogComponent'
        );
        this.toastService.error('Failed to delete server project');
      });
  }

  // --- File import ---

  protected onFileSelect(event: FileSelectEvent): void {
    const file = event.files[0];
    if (!file) return;

    this.importError.set(null);

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      this.persistenceService
        .importProjectFromJson(content)
        .then(() => this.ref.close())
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          this.loggingService.error(
            `Failed to import file: ${message}`,
            'OpenProjectDialogComponent'
          );
          this.toastService.error(`Failed to import file: ${message}`);
          this.importError.set(message);
        });
    };
    reader.onerror = () => {
      this.importError.set('Failed to read file');
    };
    reader.readAsText(file);
  }
}
