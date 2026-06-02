import { inject, Injectable } from '@angular/core';
import { Project } from '../project/project';
import { ProjectService } from '../project/project.service';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import { PersistenceService } from '../persistence/persistence.service';
import { CustomComponentRegistry } from '../components/custom/custom-component-registry.service';
import { ComponentProviderService } from '../components/component-provider.service';
import { CustomComponent } from '../components/custom/custom-component';
import { Action } from '../actions/action';
import { UpdateInstanceAction } from '../actions/actions/update-instance.action';
import { ToastService } from '../logging/toast.service';
import { DefinitionBinding } from './definition-binding';

export interface NewComponentMeta {
	name: string;
	symbol: string;
	description: string;
	isPublic?: boolean;
}

/**
 * Editor-side orchestration of custom components: create / open / close a
 * component **editor** tab, distinct from the rendering/registry layer. A
 * component editor is just a {@link Project} registered with `type: 'comp'`,
 * carrying a {@link DefinitionBinding} that keeps its master's summary current.
 *
 * Masters live in the browser id space: creating opens an empty editor, opening
 * loads a saved master's circuit from the browser `components` store (or re-focuses
 * an already-open editor), and closing saves a dirty editor before disposing it.
 * The server target lands in a later phase.
 */
@Injectable({ providedIn: 'root' })
export class CustomComponentService {
	private readonly registry = inject(CustomComponentRegistry);
	private readonly provider = inject(ComponentProviderService);
	private readonly projectService = inject(ProjectService);
	private readonly metadataStore = inject(ProjectMetadataStore);
	private readonly persistence = inject(PersistenceService);
	private readonly toast = inject(ToastService);

	private readonly _bindings = new Map<Project, DefinitionBinding>();

	/**
	 * Creates a new editable master and opens an empty editor tab for it. Phase 3
	 * mints a browser master; the server target lands in Phase 5.
	 */
	public createComponent(meta: NewComponentMeta): Project {
		const masterTypeId = this.registry.createMaster(
			{
				name: meta.name,
				symbol: meta.symbol,
				description: meta.description
			},
			'browser'
		);
		const id = this.registry.idForTypeId(masterTypeId)!;

		const project = new Project();
		this.metadataStore.register(project, {
			id,
			name: meta.name,
			type: 'comp',
			source: 'browser',
			hash: '',
			isPublic: meta.isPublic ?? false
		});

		this.projectService.addOpenComponent(project);
		this.projectService.setActiveProject(project);
		this._bindings.set(
			project,
			new DefinitionBinding(project, masterTypeId, this.registry)
		);
		return project;
	}

	/**
	 * Brings the editor for a master to the front, re-focusing an already-open
	 * editor or loading the master's circuit from the browser `components` store
	 * (the universal embedded-snapshot path). A reused master shares its session
	 * type id, so the palette tile and the editor stay one definition.
	 */
	public async openComponentForEdit(masterId: string): Promise<void> {
		const open = this._findOpenEditor(masterId);
		if (open) {
			this.projectService.setActiveProject(open);
			return;
		}
		try {
			const { project, masterTypeId } =
				await this.persistence.loadComponentForEdit(masterId);
			this.projectService.addOpenComponent(project);
			this.projectService.setActiveProject(project);
			this._bindings.set(
				project,
				new DefinitionBinding(project, masterTypeId, this.registry)
			);
		} catch {
			this.toast.error('Failed to open component');
		}
	}

	/**
	 * Closes a component editor tab. A dirty editor is saved to its store before
	 * being disposed (so edits are not lost); a clean editor is disposed straight
	 * away. Disposing tears down the binding, the tab and the editor Project — the
	 * master definition itself stays registered (it remains in the palette).
	 */
	public closeComponent(project: Project): void {
		if (this.metadataStore.isDirty(project)) {
			// Save fully before disposing — the save reads the live project.
			void this.persistence
				.saveProject(project)
				.catch(() => undefined)
				.then(() => this._disposeEditor(project));
			return;
		}
		this._disposeEditor(project);
	}

	private _disposeEditor(project: Project): void {
		this._bindings.get(project)?.dispose();
		this._bindings.delete(project);
		this.projectService.removeOpenComponent(project);
		this.metadataStore.remove(project);
		project.destroy();
	}

	/**
	 * Builds an undoable action that brings one placed custom instance up to its
	 * master's current state: re-snapshot the master, then replace the instance
	 * with a fresh one of the new snapshot type at the same position/direction.
	 * Returns null if the instance's master can no longer be resolved (e.g. it was
	 * deleted) — there is nothing to update against. The instance keeps working
	 * either way; this only changes its shape.
	 */
	public buildInstanceUpdate(instance: CustomComponent): Action | null {
		const def = this.registry.getDefinition(instance.config.type);
		if (def?.id === undefined) return null;
		const masterTypeId = this.registry.masterTypeIdForId(def.id);
		if (masterTypeId === undefined) return null;

		const newDef = this.registry.snapshot(masterTypeId);
		const config = this.provider.getComponent(newDef.typeId);
		if (!config) return null;

		const replacement = config.create({
			direction: instance.options.direction.clone(
				instance.options.direction.value
			)
		});
		replacement.position.copyFrom(instance.position);

		const action = new UpdateInstanceAction(instance, replacement);
		// The replacement was only built to be serialized into the action; the
		// real instance is created by the action's add on do(). Drop this one.
		replacement.destroy({ children: true });
		return action;
	}

	private _findOpenEditor(masterId: string): Project | undefined {
		for (const project of this.projectService.openComponents()) {
			if (this.metadataStore.getMetadata(project)?.id === masterId) {
				return project;
			}
		}
		return undefined;
	}
}
