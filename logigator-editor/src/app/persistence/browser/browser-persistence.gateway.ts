import { inject, Injectable } from '@angular/core';
import { Location } from '@angular/common';
import { TranslationService } from '../../translation/translation.service';
import { ToastService } from '../../logging/toast.service';
import { CircuitFileService } from '../file/circuit-file.service';
import { BrowserProjectStore } from './browser-project.store';
import { BrowserComponentStore } from './browser-component.store';
import {
  BrowserComponentSummary,
  BrowserProjectSummary
} from './browser-project.types';
import { ProjectMetadataStore } from '../project-metadata.store';
import { Project } from '../../project/project';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import { deriveSummary } from '../../custom-component/definition-derivation';
import { buildProject } from '../circuit-builder';
import { warnSkippedCustoms } from '../load-warnings';

/**
 * Browser-local (IndexedDB) transport + codec + metadata + build, returning
 * `Project`s — the browser sibling of {@link ServerPersistenceGateway}. Stored
 * `content` is the native file format (a `CircuitFileService.toJson` string),
 * so loads ride the migration chain exactly like file imports. The facade
 * keeps main-slot orchestration and dirty-dispatch.
 */
@Injectable({ providedIn: 'root' })
export class BrowserPersistenceGateway {
  private readonly projectStore = inject(BrowserProjectStore);
  private readonly componentStore = inject(BrowserComponentStore);
  private readonly circuitFile = inject(CircuitFileService);
  private readonly registry = inject(CustomComponentRegistry);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly toast = inject(ToastService);
  private readonly translation = inject(TranslationService);
  private readonly location = inject(Location);

  /**
   * Loads a browser-stored circuit into a new project and registers it as a
   * `'browser'` project. Mirrors the server gateway's `loadProject`. Rejects
   * if no record exists for `id`.
   */
  async loadProject(id: string): Promise<Project> {
    const record = await this.projectStore.get(id);
    if (!record) {
      throw new Error(`No browser project with id ${id}`);
    }
    const { name, attribution, components, wires, skippedCustom } =
      this.circuitFile.fromJson(record.content);
    warnSkippedCustoms(
      this.toast,
      this.translation,
      skippedCustom,
      'BrowserPersistenceGateway'
    );
    const project = buildProject(components, wires);

    this.metadataStore.register(project, {
      id: record.id,
      name,
      type: 'project',
      source: 'browser',
      hash: '',
      isPublic: false,
      attribution
    });

    return project;
  }

  /**
   * Loads a browser-stored **library master** into a fresh editor Project and
   * registers it (reusing the master's session type id if it is already known,
   * so placing it from the palette and opening it share one definition).
   * Returns the Project plus the master type id so the caller can attach a
   * `DefinitionBinding` and open a tab. The circuit is self-contained — its
   * embedded snapshots are ingested with no cross-row resolution. Rejects if
   * no record exists for `id`.
   */
  async loadComponentForEdit(
    id: string
  ): Promise<{ project: Project; masterTypeId: number }> {
    const record = await this.componentStore.get(id);
    if (!record) {
      throw new Error(`No browser component with id ${id}`);
    }
    const { components, wires, skippedCustom } = this.circuitFile.fromJson(
      record.content
    );
    warnSkippedCustoms(
      this.toast,
      this.translation,
      skippedCustom,
      'BrowserPersistenceGateway'
    );
    const project = buildProject(components, wires);

    const masterTypeId =
      this.registry.masterTypeIdForId(id) ??
      this.registry.createMaster(
        {
          id,
          version: record.version,
          name: record.name,
          symbol: record.symbol,
          description: record.description,
          numInputs: record.numInputs,
          numOutputs: record.numOutputs,
          labels: record.labels,
          lastEdited: record.lastEdited
        },
        'browser'
      );

    this.metadataStore.register(project, {
      id,
      name: record.name,
      type: 'comp',
      source: 'browser',
      hash: '',
      isPublic: false
    });

    return { project, masterTypeId };
  }

  /**
   * Writes a project to the browser store under the mid-save edit guard. A
   * fresh draft (empty metadata id) gets a generated id, recorded in the
   * metadata and reflected in the URL so a reload restores it via the
   * `/local/:id` route.
   */
  async saveProject(project: Project): Promise<void> {
    const metadata = this.metadataStore.getMetadata(project)!;
    await this.metadataStore.withDirtyGuard(project, async () => {
      const content = this.circuitFile.toJson(
        project,
        metadata.name,
        metadata.attribution
      );

      const record = await this.projectStore.save({
        id: metadata.id || undefined,
        name: metadata.name,
        content
      });

      if (metadata.id !== record.id) {
        this.metadataStore.updateId(project, record.id);
        this.location.go(`/local/${record.id}`);
      }
    });
    this.toast.success(
      this.translation.translate('persistence.projectSavedLocal'),
      'BrowserPersistenceGateway'
    );
  }

  /**
   * Saves a custom-component editor (`type: 'comp'`) to the browser
   * `components` store: its summary columns (recomputed from its plugs at save
   * time) plus its `content` (own circuit + embedded snapshots of its
   * dependencies). Does not retroactively change placed instances — they are
   * frozen snapshots; this only affects future placements and explicit
   * per-instance updates.
   */
  async saveComponent(project: Project): Promise<void> {
    const metadata = this.metadataStore.getMetadata(project)!;
    const masterTypeId = this.registry.masterTypeIdForId(metadata.id);
    const master =
      masterTypeId !== undefined
        ? this.registry.getDefinition(masterTypeId)
        : undefined;
    await this.metadataStore.withDirtyGuard(project, async () => {
      const summary = deriveSummary(project);
      const content = this.circuitFile.toJson(project, metadata.name);

      // Auto-increment the monotonic version so that placed instances frozen at an
      // older version can detect "a newer master exists" and offer the update button.
      const newVersion = (master?.version ?? 0) + 1;

      const record = await this.componentStore.save({
        id: metadata.id || undefined,
        version: newVersion,
        name: metadata.name,
        symbol: master?.symbol ?? '',
        description: master?.description ?? '',
        numInputs: summary.numInputs,
        numOutputs: summary.numOutputs,
        labels: summary.labels,
        content
      });

      // Adopt the bumped version so the in-memory master reflects it, invalidates
      // the placement snapshot cache, and placed instances behind this version can
      // detect "a newer master exists". Re-stamp the save time so the palette
      // re-sorts the just-edited master to the top.
      if (masterTypeId !== undefined) {
        this.registry.setMasterVersion(masterTypeId, newVersion);
        this.registry.setMasterLastEdited(masterTypeId, record.lastEdited);
      }
    });
    this.toast.success(
      this.translation.translate('persistence.componentSavedLocal'),
      'BrowserPersistenceGateway'
    );
  }

  /**
   * Renames a browser-stored project. The display name is duplicated out of the
   * stored content blob (the codec reads the blob's top-level `name` on open, not
   * the summary column), so both must change: the blob's `name` field is rewritten
   * and the new value re-saved as the column. If the project is currently open,
   * its in-memory metadata — and thus the title bar — is synced too.
   */
  async renameProject(id: string, name: string): Promise<void> {
    const record = await this.projectStore.get(id);
    if (!record) throw new Error(`No browser project with id ${id}`);
    await this.projectStore.save({
      id,
      name,
      content: this._withRenamedContent(record.content, name)
    });
    const handle = this.metadataStore.getHandleById(id);
    if (
      handle?.metadata.source === 'browser' &&
      handle.metadata.type === 'project'
    ) {
      this.metadataStore.update(handle.project, { name });
    }
  }

  /** Lists circuits stored in the browser (IndexedDB), newest first. */
  listProjects(): Promise<BrowserProjectSummary[]> {
    return this.projectStore.list();
  }

  /** Removes a browser-stored circuit. */
  deleteProject(id: string): Promise<void> {
    return this.projectStore.delete(id);
  }

  /** Lists library masters stored in the browser (IndexedDB), newest first. */
  listComponents(): Promise<BrowserComponentSummary[]> {
    return this.componentStore.list();
  }

  /**
   * Returns the stored circuit JSON with its top-level `name` replaced. Browser
   * blobs are always current-version with a top-level `name` (every write path
   * goes through `CircuitFileService.toJson`), so a structural rewrite suffices —
   * decoding to instances would needlessly ingest the project's custom snapshots
   * into the live registry as a side effect of a background rename.
   */
  private _withRenamedContent(content: string, name: string): string {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content) as Record<string, unknown>;
    } catch {
      throw new Error('Stored project content is not valid JSON');
    }
    return JSON.stringify({ ...parsed, name });
  }
}
