import { effect, inject, Injectable } from '@angular/core';
import { UserService } from './user.service';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { Project } from '../project/project';

/**
 * Whether a cloud document may be saved right now:
 * - `'ok'` — signed in, and the document belongs to the current user.
 * - `'logged-out'` — no signed-in user.
 * - `'foreign'` — loaded under a different account; saving would write into
 *   the wrong one.
 */
export type CloudSaveVerdict = 'ok' | 'logged-out' | 'foreign';

/**
 * Tracks which account each open cloud document belongs to — the state half of
 * the session lifecycle, kept free of persistence dependencies so
 * `PersistenceService` can consult it.
 *
 * Ownership is stamped reactively, so a document loaded before the user data
 * resolves is stamped as soon as the user arrives. A document surviving a
 * logout keeps its stamp: a different user signing in reads it as foreign,
 * while the original user signing back in resumes saving.
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
          this._owners.set(project, user.id);
        }
      }
    });
  }

  /** Whether a user is signed in (creating new cloud documents is allowed). */
  isSignedIn(): boolean {
    return this.userService.user() !== null;
  }

  /**
   * Whether a `source:'server'` document may be saved under the current
   * sign-in. An unstamped document with a signed-in user counts as theirs, and
   * the effect stamps it on its next run.
   */
  verdict(project: Project): CloudSaveVerdict {
    const user = this.userService.user();
    if (!user) return 'logged-out';
    const owner = this._owners.get(project);
    if (owner !== undefined && owner !== user.id) return 'foreign';
    return 'ok';
  }
}
