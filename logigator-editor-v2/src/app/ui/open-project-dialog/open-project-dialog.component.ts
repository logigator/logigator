import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  DialogRef,
  LgFileUpload,
  type LgFileSelectEvent,
  LgMessage,
  LgTab,
  LgTabPanel,
  LgTabs
} from '@logigator/ui';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import {
  debounceTime,
  distinctUntilChanged,
  firstValueFrom,
  Subject
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PersistenceService } from '../../persistence/persistence.service';
import { ToastService } from '../../logging/toast.service';
import { UserService } from '../../user/user.service';
import {
  ProjectListComponent,
  type ProjectListItem
} from '../project-list/project-list.component';
import type { BrowserProjectSummary } from '../../persistence/browser/browser-project.types';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-open-project-dialog',
  imports: [
    LgTabs,
    LgTab,
    LgTabPanel,
    LgFileUpload,
    TranslocoDirective,
    ProjectListComponent,
    LgMessage
  ],
  templateUrl: './open-project-dialog.component.html'
})
export class OpenProjectDialogComponent implements OnInit {
  private readonly ref = inject(DialogRef);
  private readonly persistenceService = inject(PersistenceService);
  private readonly toastService = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  protected readonly userService = inject(UserService);

  private readonly ctx = 'OpenProjectDialogComponent';

  protected readonly activeTab = signal<string>('local');
  protected readonly importError = signal<string | null>(null);

  // --- Local source ---
  private readonly localAllItems = signal<BrowserProjectSummary[]>([]);
  protected readonly loadingLocal = signal(false);
  protected readonly localPage = signal(0);
  protected readonly localSearch = signal('');

  protected readonly localFiltered = computed(() => {
    const q = this.localSearch().toLowerCase().trim();
    const all = this.localAllItems();
    return q ? all.filter((p) => p.name.toLowerCase().includes(q)) : all;
  });

  protected readonly localItems = computed((): ProjectListItem[] => {
    const start = this.localPage() * PAGE_SIZE;
    return this.localFiltered()
      .slice(start, start + PAGE_SIZE)
      .map((p) => ({ id: p.id, name: p.name, lastEdited: p.lastEdited }));
  });

  protected readonly localTotal = computed(() => this.localFiltered().length);

  // --- Server source ---
  protected readonly serverItems = signal<ProjectListItem[]>([]);
  protected readonly loadingServer = signal(false);
  protected readonly serverPage = signal(0);
  protected readonly serverTotal = signal(0);
  private readonly serverLoaded = signal(false);
  private readonly serverSearch = signal('');
  private readonly serverSearch$ = new Subject<string>();

  constructor() {
    this.serverSearch$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((query) => {
        this.serverSearch.set(query);
        void this.loadServerProjects(0);
      });
  }

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
      .catch((err: unknown) => {
        this.toastService.error(
          this.transloco.translate('openProjectDialog.errors.listLocal'),
          err,
          this.ctx
        );
        this.loadingLocal.set(false);
      });
  }

  protected onLocalSearch(query: string): void {
    this.localSearch.set(query);
    this.localPage.set(0);
  }

  protected openLocalProject(id: string): void {
    this.persistenceService.loadLocalProjectAsMain(id).catch((err: unknown) => {
      this.toastService.error(
        this.transloco.translate('openProjectDialog.errors.openLocal'),
        err,
        this.ctx
      );
    });
    this.ref.close();
  }

  protected deleteLocalConfirmed(item: ProjectListItem): void {
    this.persistenceService
      .deleteBrowserProject(item.id)
      .then(() => this.loadLocalProjects())
      .catch((err: unknown) => {
        this.toastService.error(
          this.transloco.translate('openProjectDialog.errors.deleteLocal'),
          err,
          this.ctx
        );
      });
  }

  protected renameLocal(change: { id: string; name: string }): void {
    this.persistenceService
      .renameBrowserProject(change.id, change.name)
      .then(() => this.loadLocalProjects())
      .catch((err: unknown) => {
        this.toastService.error(
          this.transloco.translate('openProjectDialog.errors.renameLocal'),
          err,
          this.ctx
        );
      });
  }

  // --- Server handlers ---

  private async loadServerProjects(page = 0): Promise<void> {
    this.loadingServer.set(true);
    try {
      const result = await firstValueFrom(
        this.persistenceService.listProjects(page, this.serverSearch())
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
    } catch (err) {
      this.toastService.error(
        this.transloco.translate('openProjectDialog.errors.listServer'),
        err,
        this.ctx
      );
    } finally {
      this.loadingServer.set(false);
    }
  }

  protected onServerSearch(query: string): void {
    this.serverSearch$.next(query);
  }

  protected onServerPageChange(page: number): void {
    void this.loadServerProjects(page);
  }

  protected openServerProject(id: string): void {
    this.persistenceService.loadProjectAsMain(id).catch((err: unknown) => {
      this.toastService.error(
        this.transloco.translate('openProjectDialog.errors.openServer'),
        err,
        this.ctx
      );
    });
    this.ref.close();
  }

  protected deleteServerConfirmed(item: ProjectListItem): void {
    firstValueFrom(this.persistenceService.deleteProject(item.id))
      .then(() => this.loadServerProjects(this.serverPage()))
      .catch((err: unknown) => {
        this.toastService.error(
          this.transloco.translate('openProjectDialog.errors.deleteServer'),
          err,
          this.ctx
        );
      });
  }

  protected renameServer(change: { id: string; name: string }): void {
    firstValueFrom(
      this.persistenceService.renameProject(change.id, change.name)
    )
      .then(() => this.loadServerProjects(this.serverPage()))
      .catch((err: unknown) => {
        this.toastService.error(
          this.transloco.translate('openProjectDialog.errors.renameServer'),
          err,
          this.ctx
        );
      });
  }

  // --- File import ---

  protected onFileSelect(event: LgFileSelectEvent): void {
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
          this.toastService.error(
            this.transloco.translate('openProjectDialog.errors.importFailed', {
              detail: message
            }),
            err,
            this.ctx
          );
          this.importError.set(message);
        });
    };
    reader.onerror = () => {
      const message = this.transloco.translate(
        'openProjectDialog.errors.readFailed'
      );
      this.toastService.error(message, reader.error, this.ctx);
      this.importError.set(message);
    };
    reader.readAsText(file);
  }
}
