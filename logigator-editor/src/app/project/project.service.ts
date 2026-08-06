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
   * Fires synchronously *before* the main slot is handed to another project,
   * carrying the outgoing one. It is still the main project and still live at
   * that point, so listeners holding state tied to it (the simulation session)
   * wind down against a project they may still touch — the caller destroys it
   * right after the swap. Silent on the first assignment.
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

  // Reorders the open-component tabs in place. Both indices are relative to the
  // `openComponents` array (the pinned main project is not part of it). Session
  // state only — the order is not persisted.
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
