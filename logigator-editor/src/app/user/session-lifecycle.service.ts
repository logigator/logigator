import { effect, inject, Injectable, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DialogService } from '@logigator/ui';
import { DialogId } from '../analytics/analytics.mapping';
import { TranslationService } from '../translation/translation.service';
import { UserService } from './user.service';
import { CloudSessionService } from './cloud-session.service';
import { PersistenceService } from '../persistence/persistence.service';
import { ComponentLibraryService } from '../custom-component/component-library.service';
import { PromotionService } from '../persistence/promotion.service';
import {
  ProjectMetadata,
  ProjectMetadataStore
} from '../persistence/project-metadata.store';
import { ProjectService } from '../project/project.service';
import { CustomComponentService } from '../custom-component/custom-component.service';
import { UploadCoordinatorService } from '../ui/upload/upload-coordinator.service';
import { ToastService } from '../logging/toast.service';
import { LoggingService } from '../logging/logging.service';
import { Project } from '../project/project';
import {
  LogoutChoice,
  LogoutDialogComponent
} from '../ui/dialogs/logout-dialog/logout-dialog.component';

/** A registered document together with its metadata. */
interface DocumentHandle {
  project: Project;
  metadata: ProjectMetadata;
}

/**
 * The action half of the session lifecycle ({@link CloudSessionService} is the
 * state half).
 *
 * One effect follows `UserService.user()` and keeps a single invariant across
 * every transition: the cloud component library mirrors the session. Nothing
 * else is touched reactively, so an *external* logout leaves the open project,
 * tabs and a running simulation alone; the save guard rejects later cloud saves
 * until the user signs in again.
 *
 * A *user-initiated* logout runs {@link requestLogout}, which additionally
 * resets the cloud workspace.
 */
@Injectable({ providedIn: 'root' })
export class SessionLifecycleService {
  private readonly userService = inject(UserService);
  private readonly cloudSession = inject(CloudSessionService);
  private readonly persistence = inject(PersistenceService);
  private readonly componentLibrary = inject(ComponentLibraryService);
  private readonly promotion = inject(PromotionService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly projectService = inject(ProjectService);
  private readonly customComponents = inject(CustomComponentService);
  private readonly uploadCoordinator = inject(UploadCoordinatorService);
  private readonly dialogService = inject(DialogService);
  private readonly translation = inject(TranslationService);
  private readonly toast = inject(ToastService);
  private readonly logging = inject(LoggingService);

  private _lastUserId: string | null = null;

  constructor() {
    effect(() => {
      const user = this.userService.user();
      const userId = user?.id ?? null;
      const prevId = this._lastUserId;
      if (userId === prevId) return; // data refresh, not a transition
      this._lastUserId = userId;
      untracked(() => {
        if (prevId !== null) this._onSessionEnded();
        if (userId !== null) void this._onSessionStarted();
      });
    });
  }

  /**
   * The Log Out action. Resolves whether the flow ended the session or aborted
   * (cancel, failed save, failed logout).
   */
  async requestLogout(): Promise<void> {
    const dirty = this._dirtySavableCloudDocs();
    if (dirty.length > 0) {
      const choice = await this._promptLogout(dirty);
      if (choice === undefined) return; // cancelled — keep the session
      if (choice === 'save') {
        for (const { project } of dirty) {
          // The dialog's warning line already collected consent to publish
          // embedded local components. A failure is surfaced there, so abort
          // with the session and dirty state intact.
          if (
            !(await this.uploadCoordinator.promoteLocalDepsAndSave(project))
          ) {
            return;
          }
        }
      }
    }

    try {
      await this.userService.logout();
    } catch (err) {
      this.toast.error(
        this.translation.translate('session.logoutFailed'),
        'SessionLifecycleService',
        err
      );
      return;
    }

    this._resetCloudWorkspace();
    this.toast.success(
      this.translation.translate('session.loggedOut'),
      'SessionLifecycleService'
    );
  }

  /**
   * Loads the user's cloud masters into the palette. Promotion aliases must be
   * in place first so pre-promotion references resolve; the preload is
   * memoized, so this never double-loads against the startup path.
   */
  private async _onSessionStarted(): Promise<void> {
    try {
      await this.componentLibrary.preloadComponentIdAliases();
      await this.componentLibrary.preloadServerMasters();
      this.logging.info('Cloud library loaded', 'SessionLifecycleService');
    } catch (err) {
      this.toast.warn(
        this.translation.translate('library.loadFailed'),
        'SessionLifecycleService',
        err
      );
    }
  }

  /**
   * Deliberately *all* that happens on a session end: an external logout must
   * leave the workspace untouched. The initiated flow layers its reset on top.
   */
  private _onSessionEnded(): void {
    this.componentLibrary.clearServerMasters();
  }

  /**
   * Teardown after a user-initiated logout: server component tabs close without
   * prompting (the dialog settled the dirty question), a server main document
   * is replaced by a blank draft — a simulation of it leaves with the swap (see
   * `simulation.md` § Session lifecycle) — and the library clears. Local
   * documents are untouched. The session-end transition clears the library too,
   * but its timing depends on when the auth cookie flips, so the idempotent
   * clear is repeated here.
   */
  private _resetCloudWorkspace(): void {
    for (const tab of [...this.projectService.openComponents()]) {
      if (this.metadataStore.getMetadata(tab)?.source === 'server') {
        this.customComponents.forceCloseComponent(tab);
      }
    }

    const main = this.projectService.mainProject();
    if (main && this.metadataStore.getMetadata(main)?.source === 'server') {
      this.persistence.createAndSetEmptyProject();
    }

    this.componentLibrary.clearServerMasters();
  }

  /**
   * The dirty cloud documents the logout dialog offers to save. Foreign ones
   * (loaded under a different account) cannot be saved under this session.
   */
  private _dirtySavableCloudDocs(): DocumentHandle[] {
    return this.metadataStore
      .getAllHandles()
      .filter(
        ({ project, metadata }) =>
          metadata.source === 'server' &&
          this.metadataStore.isDirty(project) &&
          this.cloudSession.verdict(project) === 'ok'
      );
  }

  /**
   * Opens the logout confirmation, folding in the cloud-promotion warning when
   * saving would publish embedded local components. Resolves `undefined` when
   * dismissed.
   */
  private _promptLogout(
    dirty: DocumentHandle[]
  ): Promise<LogoutChoice | undefined> {
    const promotable = new Set<number>();
    for (const { project } of dirty) {
      for (const dep of this.promotion.localDependenciesOfProject(project)) {
        if (dep.masterTypeId !== null) promotable.add(dep.masterTypeId);
      }
    }

    const ref = this.dialogService.open(LogoutDialogComponent, {
      header: this.translation.translate('logoutDialog.header'),
      width: '40rem',
      modal: true,
      closable: true,
      telemetryId: DialogId.Logout,
      data: {
        items: dirty.map(({ project, metadata }) => ({
          name: metadata.name,
          lastEditedAt: this.metadataStore.lastEditedAt(project)
        })),
        promotionWarning:
          promotable.size > 0
            ? this.translation.translate('logoutDialog.promotionWarning', {
                count: promotable.size
              })
            : undefined
      }
    });
    if (!ref) return Promise.resolve(undefined);
    return firstValueFrom(ref.onClose);
  }
}
