import { Injectable, inject } from '@angular/core';
import { Location } from '@angular/common';
import { firstValueFrom, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ProjectApiService } from '../api/api-services/project-api.service';
import { ShareApiService } from '../api/api-services/share-api.service';
import { UserApiService } from '../api/api-services/user-api.service';
import { CircuitSerializer } from './circuit-serializer';
import { ProjectMetadataStore } from './project-metadata.store';
import { ProjectService } from '../project/project.service';
import { LoggingService } from '../logging/logging.service';
import { Project } from '../project/project';
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
	private readonly metadataStore = inject(ProjectMetadataStore);
	private readonly projectService = inject(ProjectService);
	private readonly logging = inject(LoggingService);
	private readonly location = inject(Location);

	private _mainLoadToken = 0;
	private _shareLoadToken = 0;
	private readonly _saveInFlight = new WeakMap<
		Project,
		Promise<ProjectSummary | null>
	>();

	// -- Public API ----------------------------------------------------------

	async loadProject(uuid: string): Promise<Project> {
		const detail = await firstValueFrom(this.projectApi.open(uuid));
		const { components, wires } = this.serializer.deserializeProject(
			detail.elements
		);

		const project = new Project();
		for (const c of components) project.addComponent(c);
		for (const w of wires) project.addWire(w);

		this.metadataStore.register(project, {
			serverUuid: uuid,
			name: detail.name,
			type: 'project',
			source: 'server',
			hash: detail.elementsFile?.hash ?? '',
			isPublic: detail.public,
			link: detail.link
		});

		return project;
	}

	async saveProject(project: Project): Promise<ProjectSummary | null> {
		const existing = this._saveInFlight.get(project);
		if (existing) return existing;

		if (!this.metadataStore.isDirty(project)) return null;

		const metadata = this.metadataStore.getMetadata(project);
		if (!metadata || metadata.source !== 'server') {
			// Local projects have no server counterpart yet — saving is a no-op
			// (the user must explicitly promote them via "New Project" /
			// "Save As").
			return null;
		}

		const promise = this._doSave(project).finally(() => {
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
			serverUuid: response.id,
			name,
			type: 'project',
			source: 'server',
			hash: response.elementsFile?.hash ?? '',
			isPublic: isPublic ?? false
		});

		const { elements, dependencies } = this.serializer.serializeProject(project);
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

	listProjects(page?: number, search?: string): Observable<Page<ProjectSummary>> {
		return this.projectApi.list(page ?? 1, 5, search);
	}

	async loadShare(
		linkId: string
	): Promise<{ project: Project; type: 'project' | 'comp' }> {
		const detail = await firstValueFrom(this.shareApi.get(linkId));
		const { components, wires } = this.serializer.deserializeProject(
			detail.elements
		);

		const project = new Project();
		for (const c of components) project.addComponent(c);
		for (const w of wires) project.addWire(w);

		// Shares are read-only — disable dirty tracking subscription.
		this.metadataStore.register(
			project,
			{
				serverUuid: detail.id,
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

	createAndSetEmptyProject(): Project {
		const project = new Project();
		this.metadataStore.register(project, {
			serverUuid: '',
			name: 'Untitled',
			type: 'project',
			source: 'local',
			hash: '',
			isPublic: false
		});

		this._replaceMainProject(project);
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

	// -- Private helpers -----------------------------------------------------

	private async _doSave(project: Project): Promise<ProjectSummary> {
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
				this.projectApi.save(metadata.serverUuid, {
					oldHash: metadata.hash,
					dependencies,
					elements
				})
			);

			this.metadataStore.updateHash(
				project,
				response.elementsFile?.hash ?? ''
			);
			if (this.metadataStore.dirtyVersion(project) === versionAtSnapshot) {
				this.metadataStore.clearDirty(project);
			}
			this.logging.log('Project saved', 'PersistenceService');

			return response;
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
