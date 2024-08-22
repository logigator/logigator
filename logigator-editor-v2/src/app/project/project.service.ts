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

	constructor() {}

	public setMainProject(project: Project): void {
		this._mainProject.set(project);
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
}
