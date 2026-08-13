import { inject, Injectable } from '@angular/core';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
import { ComponentProviderService } from '../../components/component-provider.service';
import {
  CURRENT_FILE_VERSION,
  CurrentCircuitFile,
  CUSTOM_TYPE_ID_BASE,
  decodeComponentPositions,
  decodeWireChain,
  encodeComponentPositions,
  encodeWireChain,
  FileForkAttributionV1,
  fromPersistedDefinition,
  InvalidFileError,
  PersistedSnapshotDefinitionV1,
  PositionDeltaDecodeError,
  remapComponentTypes,
  SerializedCircuitBody,
  SerializedComponentBody,
  SerializedWireBody,
  SnapshotDefinition,
  toPersistedDefinition,
  WireChainDecodeError
} from '@logigator/core';
import { instantiateBody } from '../circuit-builder';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import { LoggingService } from '../../logging/logging.service';
import { MigrationContext } from './migrations/migration';
import { migrateToCurrent } from './circuit-file-migrator';
import { collectSnapshots, serializeProjectBody } from '../snapshots';

/**
 * Reads/writes the native circuit file format. Encoding always emits the current
 * version; decoding parses, migrates any older document up to current (via the
 * migration chain), then turns it into editor instances.
 *
 * It is a thin adapter over the universal snapshot codec (`persistence/snapshots.ts`):
 * encoding embeds a frozen snapshot of every custom the project uses and rewrites
 * the body to file-local type ids; decoding ingests those snapshots into the
 * registry and remaps the body back to session type ids. It does not touch project
 * metadata or the active-project lifecycle (that is `PersistenceService`'s job).
 */
@Injectable({ providedIn: 'root' })
export class CircuitFileService {
  private readonly componentProvider = inject(ComponentProviderService);
  private readonly registry = inject(CustomComponentRegistry);
  private readonly logging = inject(LoggingService);

  private get migrationContext(): MigrationContext {
    return {
      componentProvider: this.componentProvider,
      logging: this.logging
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
   * Serializes a project to a current-version file document, alongside the
   * emission orders: `wireOrder[k]` / `componentOrder[k]` is the index (in
   * `project.wires` / `project.components` iteration order) of the element
   * emitted k-th. Both encoders reorder (the chain walk for wires, the
   * position-delta sort for components), so the document's element order is
   * the emission order — consumers that align per-element data with the
   * document (the project dump's `wireIds`/`componentIds`) map through these
   * instead of iterating the project.
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
    const wires = encodeWireChain(body.wires);
    const components = encodeComponentPositions(
      remapComponentTypes(body.components, sessionToLocal)
    );

    return {
      file: {
        version: CURRENT_FILE_VERSION,
        name,
        components: components.components,
        wires: wires.text,
        definitions: definitions.map(toPersistedDefinition),
        // Fork lineage rides along only when the document has one — an empty
        // field would suggest a checked-and-absent lineage rather than none.
        ...(attribution?.length ? { attribution } : {})
      },
      wireOrder: wires.order,
      componentOrder: components.order
    };
  }

  /**
   * Migrates an already-parsed document up to the current version and turns it
   * into editor instances. The object-level entry shared by file reads
   * ({@link fromJson}) and server reads (which wrap their `ProjectElement[]`
   * response as a {@link CircuitFileV0} via `server.toCircuitFileV0`, so they
   * route through the same `v0ToV1` migration). Returns the document `name`
   * alongside the instances.
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
   * Decodes a current-version, validated document into editor instances: the
   * shared file→session-body path ({@link _toSessionBody}) followed by the
   * shared instance builder (`instantiateBody`). A custom whose snapshot is
   * missing (an old reference-only or client-stripped server document) is
   * dropped and reported via `skippedCustom` — the codec owns no UI, so the
   * load entry points surface the count to the user (`warnSkippedCustoms`).
   * Elements carry no id, so fresh ids are allocated on construction.
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
   * Parses and migrates a JSON string, ingests its embedded snapshots into the
   * registry, and returns the remapped serialized circuit body. Cheaper than
   * {@link fromJson} — no live PixiJS objects are constructed. Used by the
   * startup preload path to register masters without opening editor projects.
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
   * The object-level form of {@link decodeToBody}: migrates an already-parsed
   * document (e.g. a server response wrapped via `server.toCircuitFileV0`),
   * ingests its embedded snapshots and returns the remapped body — no JSON parse,
   * no live instances. Used by the startup preload of server masters.
   */
  decodeToBodyFromData(data: unknown): SerializedCircuitBody {
    const file = migrateToCurrent(data, this.migrationContext);
    return this._toSessionBody(file).body;
  }

  /**
   * The shared file→session decode: ingests the document's embedded snapshots
   * into the registry and remaps the body's file-local custom ids to session
   * ids. A custom-range id resolves ONLY through the snapshot remap; a
   * built-in passes through. Never fall a custom id through to its own value:
   * file-local and session custom ids both count up from CUSTOM_TYPE_ID_BASE,
   * so a missing snapshot would otherwise alias an unrelated session type —
   * such elements are dropped with a warning and counted for the caller to
   * surface.
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
   * Parses and migrates a stored circuit and returns its embedded snapshot
   * definitions **without ingesting them into the registry** — a read-only peek
   * for inspecting a component's dependencies (e.g. the upload-to-cloud
   * confirmation). Builds no live instances and allocates no type ids, so unlike
   * {@link decodeToBody} it leaves the registry untouched.
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

  /** Decodes the body's chain-encoded wires, mapping structural failures
   * (including a non-string field) to {@link InvalidFileError}. */
  private _decodeWires(value: unknown): SerializedWireBody[] {
    if (value === undefined) return [];
    try {
      return decodeWireChain(value as string);
    } catch (err) {
      this._rethrowAsFileError(err);
    }
  }

  /** Restores absolute positions from the body's delta-encoded components,
   * mapping structural failures to {@link InvalidFileError}. */
  private _decodeComponents(
    value: SerializedComponentBody[] | undefined
  ): SerializedComponentBody[] {
    try {
      return decodeComponentPositions(this._asArray(value, 'components'));
    } catch (err) {
      this._rethrowAsFileError(err);
    }
  }

  /** Revives persisted definitions (delta components, chain wires) into
   * in-memory {@link SnapshotDefinition}s, mapping decode failures to
   * {@link InvalidFileError}. */
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
