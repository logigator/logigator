import { effect, inject, Injectable } from '@angular/core';
import { UserService } from './user.service';
import { sessionUserId } from '../api/models/user';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { Project } from '../project/project';

/**
 * The verdict on whether a cloud document may be saved right now:
 * - `'ok'` — signed in, and the document belongs to the current user.
 * - `'logged-out'` — no signed-in user (external logout / expired session).
 * - `'foreign'` — the document was loaded under a *different* account than the
 *   one now signed in; saving would write into the wrong account.
 */
export type CloudSaveVerdict = 'ok' | 'logged-out' | 'foreign';

/**
 * Tracks which account each open cloud document belongs to and answers "may
 * this document be saved to the cloud right now?" — the state half of the
 * session lifecycle, deliberately free of persistence dependencies so
 * `PersistenceService` can consult it.
 *
 * Ownership is stamped reactively: whenever a user is signed in, every
 * registered `source:'server'` document that has no stamp yet is stamped with
 * that user's id. A document loaded before the user data resolves (a
 * `/project/:uuid` route racing the startup `GET /api/user`) is stamped as soon
 * as the user arrives; a document surviving a logout keeps its original stamp,
 * so a *different* user signing in reads it as foreign — while the original
 * user signing back in matches again and saving simply resumes.
 */
@Injectable({ providedIn: 'root' })
export class CloudSessionService {
  private readonly userService = inject(UserService);
  private readonly metadataStore = inject(ProjectMetadataStore);

  private readonly _owners = new WeakMap<Project, string>();

  constructor() {
    effect(() => {
      const user = this.userService.user();
      if (!user) return;
      for (const { project, metadata } of this.metadataStore.getAllHandles()) {
        if (metadata.source !== 'server') continue;
        if (!this._owners.has(project)) {
          this._owners.set(project, sessionUserId(user));
        }
      }
    });
  }

  /** Whether a user is signed in (creating new cloud documents is allowed). */
  isSignedIn(): boolean {
    return this.userService.user() !== null;
  }

  /**
   * Whether `project` (a `source:'server'` document) may be saved under the
   * current sign-in. An unstamped document with a signed-in user is treated as
   * the current user's (and stamped by the effect on its next run).
   */
  verdict(project: Project): CloudSaveVerdict {
    const user = this.userService.user();
    if (!user) return 'logged-out';
    const owner = this._owners.get(project);
    if (owner !== undefined && owner !== sessionUserId(user)) return 'foreign';
    return 'ok';
  }
}
