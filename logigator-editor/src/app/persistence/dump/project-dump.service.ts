import { inject, Injectable } from '@angular/core';
import { TranslationService } from '../../translation/translation.service';
import { ToastService } from '../../logging/toast.service';
import { CircuitFileService } from '../file/circuit-file.service';
import { ProjectMetadataStore } from '../project-metadata.store';
import { PersistenceService } from '../persistence.service';
import { Project } from '../../project/project';
import { buildProject } from '../circuit-builder';
import { downloadBlob } from '../../utils/download';
import { warnSkippedCustoms } from '../load-warnings';
import { deserializeAction } from '../../actions/action-codec';
import { ProjectDump, PROJECT_DUMP_VERSION } from './project-dump.types';

/**
 * Debug-only project dumps: the native circuit document plus the original
 * element ids (the file format drops them on load) and the serialized undo
 * history — enough to reconstruct the exact in-memory session. Driven by the
 * debug menu and the bug-report payload builder.
 */
@Injectable({ providedIn: 'root' })
export class ProjectDumpService {
  private readonly circuitFile = inject(CircuitFileService);
  private readonly metadataStore = inject(ProjectMetadataStore);
  private readonly persistence = inject(PersistenceService);
  private readonly toast = inject(ToastService);
  private readonly translation = inject(TranslationService);

  buildDump(project: Project): ProjectDump {
    const name = this.metadataStore.getMetadata(project)?.name ?? 'Untitled';
    const actionManager = project.actionManager;
    // Both encoders reorder (chain walk, position-delta sort), so the
    // document's element order is the emission order — the id lists must
    // follow it, not the project's iteration order.
    const components = [...project.components];
    const wires = [...project.wires];
    const { file, wireOrder, componentOrder } = this.circuitFile.toDocument(
      project,
      name
    );
    return {
      dumpVersion: PROJECT_DUMP_VERSION,
      name,
      project: file,
      componentIds: componentOrder.map((i) => components[i].id),
      wireIds: wireOrder.map((i) => wires[i].id),
      actions: {
        history: actionManager.history.map((a) => a.serialize()),
        pointer: actionManager.pointer
      }
    };
  }

  /** Exports a {@link ProjectDump} as a downloadable `.dump.json` file. */
  exportDumpToFile(project: Project): void {
    const dump = this.buildDump(project);
    const blob = new Blob([JSON.stringify(dump)], {
      type: 'application/json'
    });
    downloadBlob(blob, `${dump.name}.dump.json`);
  }

  /**
   * Imports a debug {@link ProjectDump}: loads the circuit body exactly like a
   * file import, re-stamps the saved element ids onto the freshly-built
   * instances, then restores the undo history so undo/redo walks the real
   * session. If the loaded element count no longer matches the id lists (e.g. a
   * custom dropped because its definition is missing), id and history restoration
   * are skipped with a warning — the circuit still loads.
   */
  async importDump(content: string): Promise<Project> {
    const dump = JSON.parse(content) as ProjectDump;
    if (!dump || typeof dump !== 'object' || dump.project === undefined) {
      throw new Error('Not a Project Dump file');
    }

    const { name, components, wires, skippedCustom } = this.circuitFile.decode(
      dump.project
    );
    warnSkippedCustoms(
      this.toast,
      this.translation,
      skippedCustom,
      'ProjectDumpService'
    );

    const idsMatch =
      components.length === dump.componentIds?.length &&
      wires.length === dump.wireIds?.length;
    if (idsMatch) {
      components.forEach((c, i) => (c.id = dump.componentIds[i]));
      wires.forEach((w, i) => (w.id = dump.wireIds[i]));
    } else {
      this.toast.warn(
        this.translation.translate('persistence.dumpElementCountChanged'),
        'ProjectDumpService'
      );
    }

    const project = buildProject(components, wires);
    await this.persistence.persistImportedProject(project, name);

    if (idsMatch && dump.actions) {
      project.actionManager.restore(
        dump.actions.history.map(deserializeAction),
        dump.actions.pointer
      );
    }
    return project;
  }
}
