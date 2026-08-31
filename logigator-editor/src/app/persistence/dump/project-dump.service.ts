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
 * Debug-only project dumps: the native circuit document, the original element
 * ids the file format drops on load, and the serialized undo history — enough
 * to reconstruct the in-memory session.
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
    // Both encoders reorder, so the id lists follow the document's emission
    // order rather than the project's iteration order.
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
   * Loads the circuit body like a file import, re-stamps the saved element ids
   * and restores the undo history. When the loaded element count no longer
   * matches the id lists, ids and history are skipped with a warning and the
   * circuit still loads.
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
