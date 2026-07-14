import { effect, inject, Injectable, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DialogService } from '@logigator/ui';
import { TranslationService } from '../translation/translation.service';
import { UserService } from './user.service';
import { sessionUserId } from '../api/models/user';
import { CloudSessionService } from './cloud-session.service';
import { PersistenceService } from '../persistence/persistence.service';
import { ComponentLibraryService } from '../custom-component/component-library.service';
import {
  ProjectMetadata,
  ProjectMetadataStore
} from '../persistence/project-metadata.store';
import { ProjectService } from '../project/project.service';
import { CustomComponentService } from '../custom-component/custom-component.service';
import { UploadCoordinatorService } from '../ui/upload/upload-coordinator.service';
import { SimulationService } from '../simulation/simulation.service';
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
 * Orchestrates what happens when the sign-in changes — the action half of the
 * session lifecycle ({@link CloudSessionService} is the state half).
 *
 * One effect follows `UserService.user()` and keeps a single invariant for
 * *every* transition (initial load, login tab, another browser tab, session
 * expiry): **the cloud component library mirrors the session** — a session
 * starting loads the user's masters, ending removes them. Nothing else is
 * touched reactively, so an *external* logout leaves the open project, tabs and
 * a running simulation as they are; later cloud saves are rejected by the save
 * guard until the user signs in again.
 *
 * A *user-initiated* logout runs {@link requestLogout}: dirty cloud documents
 * prompt Save / Discard / Cancel (a failed or cancelled save aborts, so the
 * session never ends with work in limbo), then the server session ends and the
 * cloud workspace is reset — server component tabs close, a server main document
 * becomes a blank draft (exiting a simulation that renders it), local docs stay.
 */
@Injectable({ providedIn: 'root' })
export class SessionLifecycleService {
  private readonly userService = inject(UserService);
  private readonly cloudSession = inject(CloudSessionService);
  private readonly persistence = inject(PersistenceService);
  private readonly componentLibrary = inject(ComponentLibraryService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly projectService = inject(ProjectService);
  private readonly customComponents = inject(CustomComponentService);
  private readonly uploadCoordinator = inject(UploadCoordinatorService);
  private readonly simulation = inject(SimulationService);
  private readonly dialogService = inject(DialogService);
  private readonly translation = inject(TranslationService);
  private readonly toast = inject(ToastService);
  private readonly logging = inject(LoggingService);

  private _lastUserId: string | null = null;

  constructor() {
    effect(() => {
      const user = this.userService.user();
      const userId = user ? sessionUserId(user) : null;
      const prevId = this._lastUserId;
      if (userId === prevId) return; // data refresh (e.g. profile PATCH), not a transition
      this._lastUserId = userId;
      untracked(() => {
        if (prevId !== null) this._onSessionEnded();
        if (userId !== null) void this._onSessionStarted();
      });
    });
  }

  /**
   * The Log Out menu action. Resolves when the flow completes — whether it
   * ended the session or was aborted (cancel, failed save, failed logout).
   */
  async requestLogout(): Promise<void> {
    const dirty = this._dirtySavableCloudDocs();
    if (dirty.length > 0) {
      const choice = await this._promptLogout(dirty);
      if (choice === undefined) return; // cancelled — keep the session
      if (choice === 'save') {
        for (const { project } of dirty) {
          // Consent to publish embedded local components was collected by the
          // dialog's warning line, so save without further prompting. A failure
          // was already surfaced — abort with the session (and the dirty state)
          // intact so the user can retry or discard explicitly.
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
   * A session started (initial load with an existing session, or a login from
   * anywhere): load the user's cloud masters into the palette. The promotion
   * aliases must be in place first so pre-promotion references resolve; the
   * preload is memoized, so this never double-loads against the startup path.
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
   * A session ended (initiated or external): the cloud library empties. This is
   * deliberately *all* that happens here — an external logout must leave the
   * workspace untouched; the initiated flow layers its reset on top.
   */
  private _onSessionEnded(): void {
    this.componentLibrary.clearServerMasters();
  }

  /**
   * The deliberate teardown after a user-initiated logout: server component
   * tabs close without prompting (the dirty question was settled by the
   * dialog), a server main document is replaced by a blank draft — exiting a
   * running simulation first, since it renders that project — and the library
   * clears. Local documents are untouched. The library clear also runs via the
   * session-end transition when the auth cookie flips, but that event's timing
   * is browser-dependent, so it is repeated here deterministically (idempotent).
   */
  private _resetCloudWorkspace(): void {
    for (const tab of [...this.projectService.openComponents()]) {
      if (this.metadataStore.getMetadata(tab)?.source === 'server') {
        this.customComponents.forceCloseComponent(tab);
      }
    }

    const main = this.projectService.mainProject();
    if (main && this.metadataStore.getMetadata(main)?.source === 'server') {
      this.simulation.exit();
      this.persistence.createAndSetEmptyProject();
    }

    this.componentLibrary.clearServerMasters();
  }

  /**
   * The dirty cloud documents the logout dialog offers to save. Foreign
   * documents (loaded under a different account) are excluded — they cannot be
   * saved under this session, so there is nothing to offer.
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
   * Opens the logout confirmation for dirty cloud documents, folding in the
   * cloud-promotion warning when saving them would publish embedded local
   * components. Resolves the choice, or `undefined` when dismissed (cancel).
   */
  private _promptLogout(
    dirty: DocumentHandle[]
  ): Promise<LogoutChoice | undefined> {
    const promotable = new Set<number>();
    for (const { project } of dirty) {
      for (const dep of this.persistence.localDependenciesOfProject(project)) {
        if (dep.masterTypeId !== null) promotable.add(dep.masterTypeId);
      }
    }

    const ref = this.dialogService.open(LogoutDialogComponent, {
      header: this.translation.translate('logoutDialog.header'),
      width: '40rem',
      modal: true,
      closable: true,
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
