import { Injectable } from '@angular/core';
import { Subject, Subscription, Observable } from 'rxjs';
import { Project } from '../project/project';

export interface ProjectMetadata {
	serverUuid: string;
	name: string;
	type: 'project' | 'comp';
	source: 'server' | 'local' | 'share';
	hash: string;
	isPublic: boolean;
	link?: string;
}

interface ProjectEntry {
	metadata: ProjectMetadata;
	dirty: boolean;
	/** Monotonic counter incremented on every markDirty call (even when already dirty). */
	dirtyVersion: number;
	actionSub?: Subscription;
}

@Injectable({ providedIn: 'root' })
export class ProjectMetadataStore {
	private readonly _entries = new Map<Project, ProjectEntry>();

	private readonly _dirtyChange$ = new Subject<{
		project: Project;
		dirty: boolean;
	}>();

	public get dirtyChange$(): Observable<{ project: Project; dirty: boolean }> {
		return this._dirtyChange$.asObservable();
	}

	/**
	 * Registers a project with its metadata.
	 *
	 * When `trackDirty` is true (the default), the store subscribes to the
	 * project's `actionManager.actionChange$` and marks the project dirty on
	 * every state change. Shared (read-only) projects can opt out by passing
	 * `false`. Either way, `remove()` will tear the subscription down.
	 */
	public register(
		project: Project,
		metadata: ProjectMetadata,
		trackDirty = true
	): void {
		const entry: ProjectEntry = {
			metadata,
			dirty: false,
			dirtyVersion: 0
		};
		if (trackDirty) {
			entry.actionSub = project.actionManager.actionChange$.subscribe(() => {
				this.markDirty(project);
			});
		}
		this._entries.set(project, entry);
	}

	public getMetadata(project: Project): ProjectMetadata | undefined {
		return this._entries.get(project)?.metadata;
	}

	public getHandleByUuid(
		uuid: string
	): { project: Project; metadata: ProjectMetadata } | undefined {
		for (const [project, entry] of this._entries) {
			if (entry.metadata.serverUuid === uuid) {
				return { project, metadata: entry.metadata };
			}
		}
		return undefined;
	}

	public remove(project: Project): void {
		const entry = this._entries.get(project);
		if (!entry) return;
		entry.actionSub?.unsubscribe();
		this._entries.delete(project);
	}

	public markDirty(project: Project): void {
		const entry = this._entries.get(project);
		if (!entry) return;
		entry.dirtyVersion++;
		if (entry.dirty) return; // flag already set; no event needed
		entry.dirty = true;
		this._dirtyChange$.next({ project, dirty: true });
	}

	public clearDirty(project: Project): void {
		const entry = this._entries.get(project);
		if (!entry || !entry.dirty) return;
		entry.dirty = false;
		this._dirtyChange$.next({ project, dirty: false });
	}

	public isDirty(project: Project): boolean {
		return this._entries.get(project)?.dirty ?? false;
	}

	/**
	 * Returns a token that changes on every `markDirty` call. Callers (e.g. the
	 * save flow) capture it before async work and compare on completion to
	 * detect concurrent edits.
	 */
	public dirtyVersion(project: Project): number {
		return this._entries.get(project)?.dirtyVersion ?? 0;
	}

	public updateHash(project: Project, hash: string): void {
		const entry = this._entries.get(project);
		if (entry) {
			entry.metadata.hash = hash;
		}
	}
}
