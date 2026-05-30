import { Injectable, inject } from '@angular/core';
import { Location } from '@angular/common';
import { firstValueFrom, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ProjectApiService } from '../api/api-services/project-api.service';
import { ShareApiService } from '../api/api-services/share-api.service';
import { UserApiService } from '../api/api-services/user-api.service';
import { CircuitSerializer } from './circuit-serializer';
import { CircuitFileService } from './file/circuit-file.service';
import { BrowserProjectStore } from './browser/browser-project.store';
import { BrowserProjectSummary } from './browser/browser-project.types';
import { ProjectMetadataStore } from './project-metadata.store';
import { ProjectService } from '../project/project.service';
import { LoggingService } from '../logging/logging.service';
import { Project } from '../project/project';
import { Component } from '../components/component';
import { Wire } from '../wires/wire';
import { ProjectSummary } from '../api/models/project';
import { Page } from '../api/models/shared';

export class AuthRequiredError extends Error {
	constructor() {
		super('AuthRequired');
		this.name = 'AuthRequiredError';
	}
}

@Injectable({ providedIn: 'root' })
export class PersistenceService {
	private readonly projectApi = inject(ProjectApiService);
	private readonly shareApi = inject(ShareApiService);
	private readonly userApi = inject(UserApiService);
	private readonly serializer = inject(CircuitSerializer);
	private readonly circuitFile = inject(CircuitFileService);
	private readonly browserStore = inject(BrowserProjectStore);
	private readonly metadataStore = inject(ProjectMetadataStore);
	private readonly projectService = inject(ProjectService);
	private readonly logging = inject(LoggingService);
	private readonly location = inject(Location);

	private _mainLoadToken = 0;
	private _shareLoadToken = 0;
	private readonly _saveInFlight = new WeakMap<Project, Promise<void>>();

	// -- Public API ----------------------------------------------------------

	async loadProject(uuid: string): Promise<Project> {
		const detail = await firstValueFrom(this.projectApi.open(uuid));
		const { components, wires } = this.serializer.deserializeProject(
			detail.elements
		);
		const project = this._buildProject(components, wires);

		this.metadataStore.register(project, {
			id: uuid,
			name: detail.name,
			type: 'project',
			source: 'server',
			hash: detail.elementsFile?.hash ?? '',
			isPublic: detail.public,
			link: detail.link
		});

		return project;
	}

	/**
	 * Persists a project to its backing store, dispatching on `source`: `'server'`
	 * projects are PUT to the API, `'browser'` projects are written to IndexedDB
	 * (the native file format). File is never a save target — only an export. A
	 * fresh `'browser'` project with no id yet is promoted into storage here (an id
	 * is generated and the URL becomes `/local/:id`). No-op for non-dirty projects
	 * and for read-only shares.
	 */
	async saveProject(project: Project): Promise<void> {
		const existing = this._saveInFlight.get(project);
		if (existing) return existing;

		if (!this.metadataStore.isDirty(project)) return;

		const metadata = this.metadataStore.getMetadata(project);
		if (!metadata) return;

		let work: Promise<void> | undefined;
		if (metadata.source === 'server') {
			work = this._doServerSave(project);
		} else if (metadata.source === 'browser') {
			work = this._doBrowserSave(project);
		}
		// Shares (and any unknown source) are read-only: nothing to save.
		if (!work) return;

		const promise = work.finally(() => {
			this._saveInFlight.delete(project);
		});
		this._saveInFlight.set(project, promise);
		return promise;
	}

	async createProject(
		name: string,
		description?: string,
		isPublic?: boolean
	): Promise<string> {
		const response = await firstValueFrom(
			this.projectApi.create({
				name,
				description,
				public: isPublic ? 'true' : 'false'
			})
		);

		const project = new Project();
		this.metadataStore.register(project, {
			id: response.id,
			name,
			type: 'project',
			source: 'server',
			hash: response.elementsFile?.hash ?? '',
			isPublic: isPublic ?? false
		});

		const { elements, dependencies } =
			this.serializer.serializeProject(project);
		const saveResponse = await firstValueFrom(
			this.projectApi.save(response.id, {
				oldHash: response.elementsFile?.hash ?? '',
				dependencies,
				elements
			})
		);
		this.metadataStore.updateHash(
			project,
			saveResponse.elementsFile?.hash ?? ''
		);

		this._replaceMainProject(project);
		this.location.go(`/project/${response.id}`);

		return response.id;
	}

	listProjects(
		page?: number,
		search?: string
	): Observable<Page<ProjectSummary>> {
		return this.projectApi.list(page ?? 1, 5, search);
	}

	/** Lists circuits stored in the browser (IndexedDB), newest first. */
	listBrowserProjects(): Promise<BrowserProjectSummary[]> {
		return this.browserStore.list();
	}

	/** Removes a browser-stored circuit. */
	deleteBrowserProject(id: string): Promise<void> {
		return this.browserStore.delete(id);
	}

	async loadShare(
		linkId: string
	): Promise<{ project: Project; type: 'project' | 'comp' }> {
		const detail = await firstValueFrom(this.shareApi.get(linkId));
		const { components, wires } = this.serializer.deserializeProject(
			detail.elements
		);
		const project = this._buildProject(components, wires);

		// Shares are read-only — disable dirty tracking subscription.
		this.metadataStore.register(
			project,
			{
				id: detail.id,
				name: detail.name,
				type: detail.type,
				source: 'share',
				hash: detail.elementsFile?.hash ?? '',
				isPublic: true,
				link: detail.link
			},
			false
		);

		return { project, type: detail.type };
	}

	async cloneShare(linkId: string): Promise<Project> {
		try {
			await firstValueFrom(this.userApi.get());
		} catch {
			this.logging.error(
				`Cannot clone share ${linkId}: user not authenticated`,
				'PersistenceService'
			);
			throw new AuthRequiredError();
		}

		const response = await firstValueFrom(
			this.projectApi.cloneFromShare(linkId)
		);
		await this.loadProjectAsMain(response.id);
		return this.projectService.mainProject()!;
	}

	/**
	 * Creates a blank project and sets it as main. It registers as a `'browser'`
	 * project with an empty id and is **not** written to storage yet — a fresh draft
	 * leaves no record until the first `saveProject` of a dirty project (which
	 * generates the id and updates the URL to `/local/:id`).
	 */
	createAndSetEmptyProject(): Project {
		const project = new Project();
		this.metadataStore.register(project, {
			id: '',
			name: 'Untitled',
			type: 'project',
			source: 'browser',
			hash: '',
			isPublic: false
		});

		this._replaceMainProject(project);
		return project;
	}

	/**
	 * Serializes a project to the current native file format. The name is read
	 * from project metadata (the `Project` itself has no name). Returns the JSON
	 * string; triggering an actual download is a UI concern handled elsewhere.
	 */
	exportProjectToJson(project: Project): string {
		const name = this.metadataStore.getMetadata(project)?.name ?? 'Untitled';
		return this.circuitFile.toJson(project, name);
	}

	/**
	 * Loads a circuit from file content into a new project, **persists it
	 * immediately as a browser project** (IndexedDB), sets it as main and navigates
	 * to `/local/:id`. Importing is the one path that writes a fresh draft to
	 * storage up front (so a reload restores it). Throws (`InvalidFileError` /
	 * `UnsupportedVersionError`) on an unreadable file — unlike server loads, there
	 * is no fallback here; the caller decides how to surface it. Unsupported
	 * component types are dropped silently (warning only).
	 */
	async importProjectFromJson(content: string): Promise<Project> {
		const { name, components, wires } = this.circuitFile.fromJson(content);
		const project = this._buildProject(components, wires);

		// addComponent/addWire don't push to the ActionManager, so the project
		// starts non-dirty even though it was just populated.
		this.metadataStore.register(project, {
			id: '',
			name,
			type: 'project',
			source: 'browser',
			hash: '',
			isPublic: false
		});

		// Re-encode through the file codec so the stored blob is always at the
		// current format version (the imported content may have been older).
		const record = await this.browserStore.save({
			name,
			content: this.circuitFile.toJson(project, name)
		});
		this.metadataStore.updateId(project, record.id);

		this._replaceMainProject(project);
		this.location.go(`/local/${record.id}`);
		return project;
	}

	async loadProjectAsMain(
		uuid: string,
		opts?: { skipUrlUpdate?: boolean }
	): Promise<void> {
		const token = ++this._mainLoadToken;
		try {
			const project = await this.loadProject(uuid);
			if (token !== this._mainLoadToken) {
				this._disposeProject(project);
				return;
			}
			this._replaceMainProject(project);
			if (!opts?.skipUrlUpdate) {
				this.location.go(`/project/${uuid}`);
			}
		} catch (e) {
			if (token === this._mainLoadToken) {
				this.logging.error(
					`Failed to load project ${uuid}: ${this._formatError(e)}`,
					'PersistenceService'
				);
				if (!this.projectService.mainProject()) {
					this.createAndSetEmptyProject();
				}
			}
		}
	}

	async loadShareAsMain(linkId: string): Promise<void> {
		const token = ++this._shareLoadToken;
		try {
			const { project, type } = await this.loadShare(linkId);
			if (token !== this._shareLoadToken) {
				this._disposeProject(project);
				return;
			}
			if (type === 'comp') {
				this.projectService.addOpenComponent(project);
			} else {
				this._replaceMainProject(project);
			}
		} catch (e) {
			if (token === this._shareLoadToken) {
				this.logging.error(
					`Failed to load share ${linkId}: ${this._formatError(e)}`,
					'PersistenceService'
				);
				if (!this.projectService.mainProject()) {
					this.createAndSetEmptyProject();
				}
			}
		}
	}

	/**
	 * Loads a browser-stored circuit (IndexedDB) into a new project and registers
	 * it as a `'browser'` project. Mirrors `loadProject` for the server target.
	 * Rejects if no record exists for `id`.
	 */
	async loadLocalProject(id: string): Promise<Project> {
		const record = await this.browserStore.get(id);
		if (!record) {
			throw new Error(`No browser project with id ${id}`);
		}
		const { name, components, wires } = this.circuitFile.fromJson(
			record.content
		);
		const project = this._buildProject(components, wires);

		this.metadataStore.register(project, {
			id: record.id,
			name,
			type: 'project',
			source: 'browser',
			hash: '',
			isPublic: false
		});

		return project;
	}

	async loadLocalProjectAsMain(
		id: string,
		opts?: { skipUrlUpdate?: boolean }
	): Promise<void> {
		// Server and browser projects share the single main slot, so they share the
		// load token: starting either load discards a still-pending one of the other.
		const token = ++this._mainLoadToken;
		try {
			const project = await this.loadLocalProject(id);
			if (token !== this._mainLoadToken) {
				this._disposeProject(project);
				return;
			}
			this._replaceMainProject(project);
			if (!opts?.skipUrlUpdate) {
				this.location.go(`/local/${id}`);
			}
		} catch (e) {
			if (token === this._mainLoadToken) {
				this.logging.error(
					`Failed to load browser project ${id}: ${this._formatError(e)}`,
					'PersistenceService'
				);
				if (!this.projectService.mainProject()) {
					this.createAndSetEmptyProject();
				}
			}
		}
	}

	// -- Private helpers -----------------------------------------------------

	private _buildProject(components: Component[], wires: Wire[]): Project {
		const project = new Project();
		for (const c of components) project.addComponent(c);
		for (const w of wires) project.addWire(w);
		return project;
	}

	private async _doServerSave(project: Project): Promise<void> {
		// Capture metadata and a dirty version snapshot *before* serializing.
		// If new edits land between snapshot and save completion, we must NOT
		// clear the dirty flag — otherwise the user sees "Saved" with unsaved
		// changes still in the editor.
		const metadata = this.metadataStore.getMetadata(project)!;
		const versionAtSnapshot = this.metadataStore.dirtyVersion(project);
		const { elements, dependencies } =
			this.serializer.serializeProject(project);

		try {
			const response = await firstValueFrom(
				this.projectApi.save(metadata.id, {
					oldHash: metadata.hash,
					dependencies,
					elements
				})
			);

			this.metadataStore.updateHash(project, response.elementsFile?.hash ?? '');
			if (this.metadataStore.dirtyVersion(project) === versionAtSnapshot) {
				this.metadataStore.clearDirty(project);
			}
			this.logging.log('Project saved', 'PersistenceService');
		} catch (err) {
			if (this._isVersionMismatch(err)) {
				this.logging.error(
					'Version mismatch — reload required',
					'PersistenceService'
				);
			} else {
				this.logging.error(
					`Save failed: ${this._formatError(err)}`,
					'PersistenceService'
				);
			}
			throw err;
		}
	}

	private async _doBrowserSave(project: Project): Promise<void> {
		// Same dirty-version snapshot guard as the server save: the IndexedDB write
		// awaits, so an edit can land mid-save and must keep the project dirty.
		const metadata = this.metadataStore.getMetadata(project)!;
		const versionAtSnapshot = this.metadataStore.dirtyVersion(project);
		const content = this.circuitFile.toJson(project, metadata.name);

		const record = await this.browserStore.save({
			id: metadata.id || undefined,
			name: metadata.name,
			content
		});

		// First save of a fresh draft: record the generated id and reflect it in
		// the URL so a reload restores this project via the /local/:id route.
		if (metadata.id !== record.id) {
			this.metadataStore.updateId(project, record.id);
			this.location.go(`/local/${record.id}`);
		}

		if (this.metadataStore.dirtyVersion(project) === versionAtSnapshot) {
			this.metadataStore.clearDirty(project);
		}
		this.logging.log('Project saved to browser storage', 'PersistenceService');
	}

	private _replaceMainProject(newProject: Project): void {
		const previous = this.projectService.mainProject();
		this.projectService.setMainProject(newProject);
		if (previous && previous !== newProject) {
			this._disposeProject(previous);
		}
	}

	private _disposeProject(project: Project): void {
		this.metadataStore.remove(project);
		project.destroy();
	}

	private _isVersionMismatch(err: unknown): boolean {
		return (
			err instanceof HttpErrorResponse &&
			err.status === 400 &&
			(err.error as { message?: string })?.message === 'VersionMismatch'
		);
	}

	private _formatError(err: unknown): string {
		if (err instanceof HttpErrorResponse) {
			return `HTTP ${err.status} ${err.statusText}`;
		}
		if (err instanceof Error) {
			return err.message;
		}
		return String(err);
	}
}
