import { computed, Injectable, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Project } from './project';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private _mainProject = signal<Project | null>(null);
  private _openComponents = signal<Project[]>([]);
  private _activeProject = signal<Project | null>(null);

  public readonly mainProject = computed(this._mainProject);
  public readonly openComponents = computed(this._openComponents);
  public readonly activeProject = computed(this._activeProject);

  private readonly _mainProjectReplaced$ = new Subject<Project>();
  /**
   * Fires synchronously *before* the main slot is handed over, carrying the
   * outgoing project while it is still live, so a listener holding state tied
   * to it can wind down against something it may still touch. Silent on the
   * first assignment.
   */
  public readonly mainProjectReplaced$: Observable<Project> =
    this._mainProjectReplaced$.asObservable();

  public setMainProject(project: Project): void {
    const previous = this._mainProject();
    if (previous && previous !== project) {
      this._mainProjectReplaced$.next(previous);
    }
    this._mainProject.set(project);
    this._activeProject.set(project);
  }

  public setActiveProject(project: Project): void {
    this._activeProject.set(project);
  }

  public addOpenComponent(project: Project): void {
    this._openComponents.update((v) => [...v, project]);
  }

  public removeOpenComponent(project: Project): void {
    if (project === this._activeProject()) {
      this._activeProject.set(this._mainProject());
    }
    this._openComponents.update((v) => v.filter((p) => p !== project));
  }

  // Both indices are relative to `openComponents`, which excludes the pinned
  // main project. Session state only; the order is not persisted.
  public reorderOpenComponents(
    previousIndex: number,
    currentIndex: number
  ): void {
    if (previousIndex === currentIndex) return;
    this._openComponents.update((v) => {
      const next = [...v];
      const [moved] = next.splice(previousIndex, 1);
      next.splice(currentIndex, 0, moved);
      return next;
    });
  }
}
