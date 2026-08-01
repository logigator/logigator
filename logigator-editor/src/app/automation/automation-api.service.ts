import { inject, Injectable } from '@angular/core';
import { Rectangle } from 'pixi.js';

import { environment } from '../../environments/environment';
import { ComponentProviderService } from '../components/component-provider.service';
import { LoggingService } from '../logging/logging.service';
import { PersistenceService } from '../persistence/persistence.service';
import { ProjectMetadataStore } from '../persistence/project-metadata.store';
import {
  serializeComponentBody,
  serializeWireBody
} from '../persistence/snapshots';
import { Project } from '../project/project';
import { ProjectService } from '../project/project.service';
import { BoardCompilerService } from '../simulation/compiler/board-compiler.service';
import { CompileDiagnostic } from '../simulation/compiler/compile-error';
import { TranslationService } from '../translation/translation.service';
import { WorkMode } from '../work-mode/work-mode.enum';
import { WorkModeService } from '../work-mode/work-mode.service';
import {
  ApiInfo,
  AUTOMATION_API_VERSION,
  BusyReason,
  CatalogEntry,
  CompileDiagnosticReport,
  EditOp,
  EditResult,
  ElementList,
  ElementQuery,
  GridRect,
  LogigatorAutomationApi,
  PerOpError,
  ProjectState
} from './automation-api.model';
import { describeCatalog } from './catalog';
import { applyEditOps } from './edit-ops';

/**
 * The transport-agnostic automation facade: a semantic, JSON-in/JSON-out view
 * of the editor for scripts and agents. {@link install} publishes it as
 * `window.__logigator`, gated by `environment.debug.automationApi` — nothing is
 * installed in production.
 *
 * Everything here targets the **active** project, resolved per call: an import
 * or a new-project call replaces the main slot (and destroys the old project),
 * so the facade never caches a `Project` reference.
 */
@Injectable({ providedIn: 'root' })
export class AutomationApiService {
  private readonly projectService = inject(ProjectService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly componentProvider = inject(ComponentProviderService);
  private readonly persistence = inject(PersistenceService);
  private readonly compiler = inject(BoardCompilerService);
  private readonly workMode = inject(WorkModeService);
  private readonly translation = inject(TranslationService);
  private readonly logging = inject(LoggingService);

  public readonly enabled = environment.debug.automationApi;

  /**
   * Publishes the facade on `window` when enabled. Called once at startup,
   * after the static DI injector is set — the facade builds model objects
   * (`Project`, `Component`), which resolve their dependencies through it.
   */
  public install(): void {
    if (!this.enabled) return;
    window.__logigator = this.buildApi();
    this.logging.info(
      `automation API installed as window.__logigator (v${AUTOMATION_API_VERSION})`,
      'AutomationApiService'
    );
  }

  /**
   * The frozen facade object. Methods are arrow properties so a driver may
   * destructure them (`const { getProject } = window.__logigator`) without
   * losing `this`.
   */
  public buildApi(): LogigatorAutomationApi {
    return Object.freeze({
      version: (): ApiInfo => this.version(),
      describeCatalog: (): CatalogEntry[] => this.describeCatalog(),
      getProject: (): ProjectState => this.getProject(),
      getElements: (query?: ElementQuery): ElementList =>
        this.getElements(query),
      applyEdit: (ops: EditOp[]): EditResult => this.applyEdit(ops),
      undo: (): boolean => this.undo(),
      redo: (): boolean => this.redo(),
      check: (): CompileDiagnosticReport => this.check(),
      exportProject: (): string => this.exportProject(),
      importProject: (json: string): Promise<ProjectState> =>
        this.importProject(json),
      newProject: (): ProjectState => this.newProject()
    });
  }

  // -- Discovery -----------------------------------------------------------

  public version(): ApiInfo {
    return {
      apiVersion: AUTOMATION_API_VERSION,
      editorVersion: environment.version,
      buildCommit: environment.buildCommit
    };
  }

  public describeCatalog(): CatalogEntry[] {
    return describeCatalog(this.componentProvider.allComponents(), {
      translate: (key) => this.translation.translate(key),
      warn: (message) => this.logging.warn(message, 'AutomationApiService')
    });
  }

  // -- Reads ---------------------------------------------------------------

  public getProject(): ProjectState {
    const project = this.activeProject;
    const metadata = project
      ? this.metadataStore.getMetadata(project)
      : undefined;
    const bounds = project?.getContentBounds() ?? null;
    return {
      name: metadata?.name ?? '',
      id: metadata?.id ?? '',
      documentType: metadata?.type ?? 'unknown',
      source: metadata?.source ?? 'unknown',
      dirty: project ? this.metadataStore.isDirty(project) : false,
      bounds: bounds ? toGridRect(bounds) : null,
      busy: this.busyReason(),
      undoAvailable: project?.actionManager.undoAvailable ?? false,
      redoAvailable: project?.actionManager.redoAvailable ?? false,
      elements: this.getElements()
    };
  }

  public getElements(query: ElementQuery = {}): ElementList {
    const project = this.activeProject;
    if (!project) return { components: [], wires: [] };

    const componentIds = query.componentIds
      ? new Set(query.componentIds)
      : null;
    const wireIds = query.wireIds ? new Set(query.wireIds) : null;
    const types = query.types ? new Set(query.types) : null;
    const bounds = query.bounds
      ? new Rectangle(
          query.bounds.x,
          query.bounds.y,
          query.bounds.width,
          query.bounds.height
        )
      : null;

    // A bounds filter goes through the quad trees; without one every element is
    // a candidate. Id/type filters then narrow whichever set that produced.
    const components = bounds
      ? project.queryComponentsInRange(bounds)
      : project.components;
    const wires = bounds ? project.queryWiresInRange(bounds) : project.wires;

    const result: ElementList = { components: [], wires: [] };
    // An explicit id list on the *other* kind means "only those elements" —
    // asking for wire ids alone must not also return every component.
    const wantComponents = !wireIds || !!componentIds;
    const wantWires = !componentIds || !!wireIds;

    if (wantComponents) {
      for (const component of components) {
        if (componentIds && !componentIds.has(component.id)) continue;
        if (types && !types.has(component.config.type)) continue;
        result.components.push({
          id: component.id,
          ...serializeComponentBody(component)
        });
      }
    }
    if (wantWires) {
      for (const wire of wires) {
        if (wireIds && !wireIds.has(wire.id)) continue;
        result.wires.push({ id: wire.id, ...serializeWireBody(wire) });
      }
    }
    return result;
  }

  // -- Writes --------------------------------------------------------------

  /**
   * Applies a batch of edits as exactly one undo step. Refused (nothing
   * touched) while the editor is busy — see {@link BusyReason}.
   */
  public applyEdit(ops: EditOp[]): EditResult {
    const refusal = this.refuseWhenBusy('applyEdit');
    if (refusal) return refusal;
    if (!Array.isArray(ops)) {
      return {
        ok: false,
        errors: [
          { index: -1, op: 'applyEdit', message: 'ops must be an array' }
        ]
      };
    }
    return applyEditOps(ops, {
      project: this.activeProject!,
      provider: this.componentProvider,
      debug: (message) => this.logging.debug(message, 'AutomationApiService')
    });
  }

  /** Reverts the newest history entry; `false` when there is none (or busy). */
  public undo(): boolean {
    const project = this.busyReason() === null ? this.activeProject : null;
    if (!project?.actionManager.undoAvailable) return false;
    project.actionManager.undo();
    return true;
  }

  public redo(): boolean {
    const project = this.busyReason() === null ? this.activeProject : null;
    if (!project?.actionManager.redoAvailable) return false;
    project.actionManager.redo();
    return true;
  }

  // -- Validation ----------------------------------------------------------

  /**
   * Compiles the active circuit and reports the blocking diagnostics, so an
   * agent can validate a design without entering simulation. Read-only: the
   * compiled board is discarded.
   */
  public check(): CompileDiagnosticReport {
    const project = this.activeProject;
    if (!project) {
      return {
        ok: false,
        diagnostics: [
          {
            kind: 'no-project',
            message: 'no project is open',
            instancePath: '',
            componentType: 0
          }
        ]
      };
    }
    return toDiagnosticReport(this.compiler.compile(project).diagnostics);
  }

  // -- Persistence ---------------------------------------------------------

  /** The active project as a current-version native file JSON string. */
  public exportProject(): string {
    return this.persistence.exportProjectToJson(this.requireProject());
  }

  /**
   * Replaces the open document with one loaded from native file JSON (a `.lgix`
   * payload's inner JSON, or a legacy `logigator-editor` export). Like the file
   * import in the UI, the result is persisted as a browser draft and the URL
   * moves to `/local/:id`.
   */
  public async importProject(json: string): Promise<ProjectState> {
    this.assertNotBusy('importProject');
    await this.persistence.importProjectFromJson(json);
    return this.getProject();
  }

  /** Replaces the open document with an empty, unsaved draft. */
  public newProject(): ProjectState {
    this.assertNotBusy('newProject');
    this.persistence.createAndSetEmptyProject();
    return this.getProject();
  }

  // -- Shared internals ----------------------------------------------------

  /** The project every call operates on; never cached (see the class doc). */
  private get activeProject(): Project | null {
    const project = this.projectService.activeProject();
    return project && !project.destroyed ? project : null;
  }

  /**
   * Why a mutation would be refused right now: no project, a running
   * simulation, or a live drag session (the router locks the action manager for
   * the whole session, including a paste/rotate group still floating before its
   * first grab).
   */
  private busyReason(): BusyReason | null {
    const project = this.activeProject;
    if (!project) return 'no-project';
    if (this.workMode.mode() === WorkMode.SIMULATION) return 'simulation';
    if (project.actionManager.locked) return 'session-active';
    return null;
  }

  /**
   * The active project, or a thrown error — for the calls whose result has no
   * room for a refusal (the driver sees the exception through `evaluate`).
   */
  private requireProject(): Project {
    const project = this.activeProject;
    if (!project) throw new Error('logigator: no project is open');
    return project;
  }

  /** Throws when a document-replacing call arrives while the editor is busy. */
  private assertNotBusy(op: string): void {
    const reason = this.busyReason();
    if (reason) throw new Error(`logigator: ${op} refused — editor ${reason}`);
  }

  /** The per-op error a mutating call returns while the editor is busy. */
  private refuseWhenBusy(
    op: string
  ): { ok: false; errors: PerOpError[] } | null {
    const reason = this.busyReason();
    return reason
      ? {
          ok: false,
          errors: [{ index: -1, op, message: `editor busy: ${reason}` }]
        }
      : null;
  }
}

/** Compile diagnostics → the JSON report the contract uses. */
export function toDiagnosticReport(
  diagnostics: readonly CompileDiagnostic[]
): CompileDiagnosticReport {
  return {
    ok: diagnostics.length === 0,
    diagnostics: diagnostics.map((d) => ({
      kind: d.kind,
      message: d.message,
      instancePath: d.instancePath,
      componentType: d.componentType,
      ...(d.componentId !== undefined ? { componentId: d.componentId } : {})
    }))
  };
}

/** Pixi `Rectangle` → the JSON rect the contract uses. */
export function toGridRect(rect: Rectangle): GridRect {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height
  };
}
