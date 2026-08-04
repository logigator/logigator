import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  DialogRef,
  DialogService,
  LgFileUpload,
  type LgFileSelectEvent,
  LgMessage,
  LgTab,
  LgTabPanel,
  LgTabs
} from '@logigator/ui';
import { TranslationService } from '../../../translation/translation.service';
import {
  debounceTime,
  distinctUntilChanged,
  firstValueFrom,
  Subject
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PersistenceService } from '../../../persistence/persistence.service';
import { UploadCoordinatorService } from '../../upload/upload-coordinator.service';
import { DiscardChangesService } from '../../discard-changes.service';
import { ToastService } from '../../../logging/toast.service';
import { UserService } from '../../../user/user.service';
import {
  ProjectListComponent,
  type ProjectListItem
} from '../../project-list/project-list.component';
import { ShareDialogComponent } from '../share-dialog/share-dialog.component';
import type { BrowserProjectSummary } from '../../../persistence/browser/browser-project.types';
import { TranslateDirective } from '../../../translation/translate.directive';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-open-project-dialog',
  imports: [
    LgTabs,
    LgTab,
    LgTabPanel,
    LgFileUpload,
    TranslateDirective,
    ProjectListComponent,
    LgMessage
  ],
  templateUrl: './open-project-dialog.component.html'
})
export class OpenProjectDialogComponent implements OnInit {
  private readonly ref = inject(DialogRef);
  private readonly dialogService = inject(DialogService);
  private readonly persistenceService = inject(PersistenceService);
  private readonly uploadCoordinator = inject(UploadCoordinatorService);
  private readonly discardChanges = inject(DiscardChangesService);
  private readonly toastService = inject(ToastService);
  private readonly translation = inject(TranslationService);
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
          this.translation.translate('openProjectDialog.errors.listLocal'),
          this.ctx,
          err
        );
        this.loadingLocal.set(false);
      });
  }

  protected onLocalSearch(query: string): void {
    this.localSearch.set(query);
    this.localPage.set(0);
  }

  protected async openLocalProject(id: string): Promise<void> {
    if (!(await this.discardChanges.confirmDiscardMain())) return;
    this.persistenceService.loadLocalProjectAsMain(id).catch((err: unknown) => {
      this.toastService.error(
        this.translation.translate('openProjectDialog.errors.openLocal'),
        this.ctx,
        err
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
          this.translation.translate('openProjectDialog.errors.deleteLocal'),
          this.ctx,
          err
        );
      });
  }

  protected async uploadLocal(item: ProjectListItem): Promise<void> {
    const uploaded = await this.uploadCoordinator.requestUpload({
      kind: 'stored-project',
      id: item.id,
      name: item.name
    });
    if (!uploaded) return;
    // Moved to the cloud: the local record is gone, so refresh the local list
    // (and the server list if it has been loaded) to reflect the relocation.
    this.loadLocalProjects();
    if (this.serverLoaded()) void this.loadServerProjects(this.serverPage());
  }

  protected renameLocal(change: { id: string; name: string }): void {
    this.persistenceService
      .renameBrowserProject(change.id, change.name)
      .then(() => this.loadLocalProjects())
      .catch((err: unknown) => {
        this.toastService.error(
          this.translation.translate('openProjectDialog.errors.renameLocal'),
          this.ctx,
          err
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
          lastEdited: p.lastEdited,
          link: p.link,
          isPublic: p.public
        }))
      );
      this.serverTotal.set(result.total);
      this.serverPage.set(page);
      this.serverLoaded.set(true);
    } catch (err) {
      this.toastService.error(
        this.translation.translate('openProjectDialog.errors.listCloud'),
        this.ctx,
        err
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

  protected async openServerProject(id: string): Promise<void> {
    if (!(await this.discardChanges.confirmDiscardMain())) return;
    this.persistenceService.loadProjectAsMain(id).catch((err: unknown) => {
      this.toastService.error(
        this.translation.translate('openProjectDialog.errors.openCloud'),
        this.ctx,
        err
      );
    });
    this.ref.close();
  }

  protected deleteServerConfirmed(item: ProjectListItem): void {
    firstValueFrom(this.persistenceService.deleteProject(item.id))
      .then(() => this.loadServerProjects(this.serverPage()))
      .catch((err: unknown) => {
        this.toastService.error(
          this.translation.translate('openProjectDialog.errors.deleteCloud'),
          this.ctx,
          err
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
          this.translation.translate('openProjectDialog.errors.renameCloud'),
          this.ctx,
          err
        );
      });
  }

  protected shareServer(item: ProjectListItem): void {
    const shareRef = this.dialogService.open(ShareDialogComponent, {
      header: this.translation.translate('shareDialog.header'),
      width: '32rem',
      modal: true,
      closable: true,
      data: {
        kind: 'project',
        projectId: item.id,
        name: item.name,
        link: item.link ?? '',
        isPublic: item.isPublic ?? false
      }
    });
    // The share dialog PATCHes link/visibility; refresh the list so the row's
    // stored values (which seed a later share) reflect any change.
    void firstValueFrom(shareRef.onClose).then(() =>
      this.loadServerProjects(this.serverPage())
    );
  }

  // --- File import ---

  protected async onFileSelect(event: LgFileSelectEvent): Promise<void> {
    const file = event.files[0];
    if (!file) return;
    if (!(await this.discardChanges.confirmDiscardMain())) return;

    this.importError.set(null);

    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result as ArrayBuffer;
      this.persistenceService
        .importProjectFromFile(data)
        .then(() => this.ref.close())
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          this.toastService.error(
            this.translation.translate(
              'openProjectDialog.errors.importFailed',
              {
                detail: message
              }
            ),
            this.ctx,
            err
          );
          this.importError.set(message);
        });
    };
    reader.onerror = () => {
      const message = this.translation.translate(
        'openProjectDialog.errors.readFailed'
      );
      this.toastService.error(message, this.ctx, reader.error);
      this.importError.set(message);
    };
    reader.readAsArrayBuffer(file);
  }
}
