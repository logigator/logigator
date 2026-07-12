import { computed, Injectable, signal } from '@angular/core';
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

  public setMainProject(project: Project): void {
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
