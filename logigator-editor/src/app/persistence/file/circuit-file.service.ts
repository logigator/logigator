import { inject, Injectable } from '@angular/core';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
import { ComponentProviderService } from '../../components/component-provider.service';
import {
  assembleCircuitFile,
  CurrentCircuitFile,
  CUSTOM_TYPE_ID_BASE,
  decodeComponentPositions,
  decodeWireChain,
  FileForkAttributionV1,
  fromPersistedDefinition,
  InvalidFileError,
  migrateToCurrent,
  MigrationContext,
  PersistedSnapshotDefinitionV1,
  PositionDeltaDecodeError,
  remapComponentTypes,
  SerializedCircuitBody,
  SerializedComponentBody,
  SerializedWireBody,
  SnapshotDefinition,
  WireChainDecodeError
} from '@logigator/core';
import { instantiateBody } from '../circuit-builder';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import { LoggingService } from '../../logging/logging.service';
import { collectSnapshots, serializeProjectBody } from '../snapshots';

/**
 * Reads and writes the native circuit file format. Encoding always emits the
 * current version; decoding migrates an older document up to it first.
 *
 * A thin adapter over the snapshot codec (`persistence/snapshots.ts`):
 * encoding embeds a frozen snapshot of every custom the project uses and
 * rewrites the body to file-local type ids, decoding ingests those snapshots
 * and remaps back to session type ids. Project metadata and the
 * active-project lifecycle belong to `PersistenceService`.
 */
@Injectable({ providedIn: 'root' })
export class CircuitFileService {
  private readonly componentProvider = inject(ComponentProviderService);
  private readonly registry = inject(CustomComponentRegistry);
  private readonly logging = inject(LoggingService);

  /**
   * Core's migration chain takes its catalog and log as plain functions, so
   * this is the whole Angular adapter.
   */
  private get migrationContext(): MigrationContext {
    return {
      catalog: (type) => this.componentProvider.getComponent(type)?.meta,
      log: {
        info: (message) => this.logging.info(message, 'CircuitFileMigrator'),
        warn: (message) => this.logging.warn(message, 'CircuitFileMigrator')
      }
    };
  }

  /** Serializes a project to a current-version file JSON string. */
  toJson(
    project: Project,
    name: string,
    attribution?: FileForkAttributionV1[]
  ): string {
    return JSON.stringify(this.toDocument(project, name, attribution).file);
  }

  /**
   * Serializes a project to a current-version document, alongside the emission
   * orders: `wireOrder[k]` / `componentOrder[k]` is the index, in project
   * iteration order, of the element emitted k-th. Both encoders reorder, so
   * anything aligning per-element data with the document maps through these
   * rather than iterating the project.
   */
  toDocument(
    project: Project,
    name: string,
    attribution?: FileForkAttributionV1[]
  ): {
    file: CurrentCircuitFile;
    wireOrder: number[];
    componentOrder: number[];
  } {
    const { definitions, sessionToLocal } = collectSnapshots(
      project,
      this.registry
    );
    const body = serializeProjectBody(project);
    return assembleCircuitFile(
      {
        components: remapComponentTypes(body.components, sessionToLocal),
        wires: body.wires
      },
      definitions,
      name,
      attribution
    );
  }

  /**
   * Migrates an already-parsed document up to the current version and turns it
   * into editor instances. The object-level entry shared by file reads
   * ({@link fromJson}) and server reads, which carry the same document.
   */
  decode(data: unknown): {
    name: string;
    attribution?: FileForkAttributionV1[];
    components: Component[];
    wires: Wire[];
    skippedCustom: number;
  } {
    const file = migrateToCurrent(data, this.migrationContext);
    const name = typeof file.name === 'string' ? file.name : 'Untitled';
    return { name, attribution: file.attribution, ...this.deserialize(file) };
  }

  /**
   * Decodes a current-version, validated document into editor instances. A
   * custom whose snapshot is missing is dropped and counted in
   * `skippedCustom`: the codec owns no UI, so the load entry points surface
   * the count. Elements carry no id, so fresh ones are allocated.
   */
  deserialize(file: CurrentCircuitFile): {
    components: Component[];
    wires: Wire[];
    skippedCustom: number;
  } {
    const { body, skippedCustom } = this._toSessionBody(file);
    return { ...instantiateBody(this.componentProvider, body), skippedCustom };
  }

  /** Convenience: parse JSON + migrate + deserialize into editor instances. */
  fromJson(content: string): {
    name: string;
    attribution?: FileForkAttributionV1[];
    components: Component[];
    wires: Wire[];
    skippedCustom: number;
  } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new InvalidFileError('Malformed JSON');
    }
    return this.decode(parsed);
  }

  /**
   * Parses and migrates a JSON string, ingests its embedded snapshots and
   * returns the remapped body. Cheaper than {@link fromJson}: no live PixiJS
   * objects, so the startup preload registers masters without opening editors.
   */
  decodeToBody(content: string): SerializedCircuitBody {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new InvalidFileError('Malformed JSON');
    }
    return this.decodeToBodyFromData(parsed);
  }

  /**
   * The object-level form of {@link decodeToBody}, for an already-parsed
   * document such as a server response.
   */
  decodeToBodyFromData(data: unknown): SerializedCircuitBody {
    const file = migrateToCurrent(data, this.migrationContext);
    return this._toSessionBody(file).body;
  }

  /**
   * Ingests the document's embedded snapshots and remaps the body's file-local
   * custom ids to session ids. A custom-range id resolves ONLY through the
   * snapshot remap, never through its own value: both id spaces count up from
   * CUSTOM_TYPE_ID_BASE, so a missing snapshot would alias an unrelated
   * session type. Such elements are dropped, warned about and counted.
   */
  private _toSessionBody(file: CurrentCircuitFile): {
    body: SerializedCircuitBody;
    skippedCustom: number;
  } {
    const remap = this.registry.ingestSnapshots(
      this._decodeDefinitions(file.definitions)
    );

    const components: SerializedComponentBody[] = [];
    let skippedCustom = 0;
    for (const c of this._decodeComponents(file.components)) {
      if (c.type >= CUSTOM_TYPE_ID_BASE) {
        const sessionType = remap.get(c.type);
        if (sessionType === undefined) {
          this.logging.warn(
            `Unknown component type ID: ${c.type} — skipping element at [${c.pos[0]}, ${c.pos[1]}]`,
            'CircuitFileService'
          );
          skippedCustom++;
          continue;
        }
        components.push({ ...c, type: sessionType });
      } else {
        components.push(c);
      }
    }

    return {
      body: { components, wires: this._decodeWires(file.wires) },
      skippedCustom
    };
  }

  /**
   * A stored circuit's embedded snapshot definitions, without ingesting them:
   * no live instances and no type ids, so unlike {@link decodeToBody} the
   * registry is left untouched.
   */
  peekDefinitions(content: string): SnapshotDefinition[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new InvalidFileError('Malformed JSON');
    }
    const file = migrateToCurrent(parsed, this.migrationContext);
    return this._decodeDefinitions(file.definitions);
  }

  private _asArray<T>(value: T[] | undefined, field: string): T[] {
    if (value === undefined) return [];
    if (!Array.isArray(value)) {
      throw new InvalidFileError(`File "${field}" must be an array`);
    }
    return value;
  }

  /** Maps a persisted-body decode failure to {@link InvalidFileError}. */
  private _rethrowAsFileError(err: unknown): never {
    if (
      err instanceof WireChainDecodeError ||
      err instanceof PositionDeltaDecodeError
    ) {
      throw new InvalidFileError(err.message);
    }
    throw err;
  }

  /** Chain-encoded wires; a non-string field is a structural failure too. */
  private _decodeWires(value: unknown): SerializedWireBody[] {
    if (value === undefined) return [];
    try {
      return decodeWireChain(value as string);
    } catch (err) {
      this._rethrowAsFileError(err);
    }
  }

  /** Restores absolute positions from the delta-encoded components. */
  private _decodeComponents(
    value: SerializedComponentBody[] | undefined
  ): SerializedComponentBody[] {
    try {
      return decodeComponentPositions(this._asArray(value, 'components'));
    } catch (err) {
      this._rethrowAsFileError(err);
    }
  }

  /** Revives persisted definitions into in-memory {@link SnapshotDefinition}s. */
  private _decodeDefinitions(
    value: PersistedSnapshotDefinitionV1[] | undefined
  ): SnapshotDefinition[] {
    return this._asArray(value, 'definitions').map((def) => {
      try {
        return fromPersistedDefinition(def);
      } catch (err) {
        this._rethrowAsFileError(err);
      }
    });
  }
}
