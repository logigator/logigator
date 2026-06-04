import { Injectable, inject } from '@angular/core';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
import { ComponentProviderService } from '../../components/component-provider.service';
import { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import { LoggingService } from '../../logging/logging.service';
import { MigrationContext } from './migrations/migration';
import { migrateToCurrent } from './circuit-file-migrator';
import { InvalidFileError } from './circuit-file.errors';
import { CURRENT_FILE_VERSION, CurrentCircuitFile } from './circuit-file.types';
import { remapComponentTypes } from '../serialized-circuit';
import { collectSnapshots, serializeProjectBody } from '../snapshots';

function isNumberPair(value: unknown): value is [number, number] {
	return (
		Array.isArray(value) &&
		value.length >= 2 &&
		typeof value[0] === 'number' &&
		typeof value[1] === 'number'
	);
}

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
	toJson(project: Project, name: string): string {
		const { definitions, sessionToLocal } = collectSnapshots(
			project,
			this.registry
		);
		const body = serializeProjectBody(project);

		const file: CurrentCircuitFile = {
			version: CURRENT_FILE_VERSION,
			name,
			components: remapComponentTypes(body.components, sessionToLocal),
			wires: body.wires,
			definitions
		};
		return JSON.stringify(file);
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
		components: Component[];
		wires: Wire[];
	} {
		const file = migrateToCurrent(data, this.migrationContext);
		const name = typeof file.name === 'string' ? file.name : 'Untitled';
		return { name, ...this.deserialize(file) };
	}

	/**
	 * Decodes a current-version document into editor instances. First ingests the
	 * embedded snapshots into the registry (so custom `type`s resolve) and remaps
	 * the body's file-local ids to session ids, then builds instances. Sole
	 * structural validator for native files (the migrator passes an already-current
	 * document through untouched): structurally broken elements throw
	 * `InvalidFileError`, while unknown component types are dropped with a warning.
	 * Elements carry no id, so fresh ids are allocated on construction.
	 */
	deserialize(file: CurrentCircuitFile): {
		components: Component[];
		wires: Wire[];
	} {
		const remap = this.registry.ingestSnapshots(
			this._asArray(file.definitions, 'definitions')
		);

		const components: Component[] = [];
		for (const c of this._asArray(file.components, 'components')) {
			if (
				!c ||
				typeof c.type !== 'number' ||
				!isNumberPair(c.pos) ||
				typeof c.options !== 'object' ||
				c.options === null
			) {
				throw new InvalidFileError('Invalid component in file');
			}
			const sessionType = remap.get(c.type) ?? c.type;
			const config = this.componentProvider.getComponent(sessionType);
			if (!config) {
				this.logging.warn(
					`Unknown component type ID: ${c.type} — skipping element at [${c.pos[0]}, ${c.pos[1]}]`,
					'CircuitFileService'
				);
				continue;
			}
			components.push(
				Component.deserialize({ pos: c.pos, options: c.options }, config)
			);
		}

		const wires: Wire[] = [];
		for (const w of this._asArray(file.wires, 'wires')) {
			if (
				!w ||
				!isNumberPair(w.pos) ||
				(w.direction !== 0 && w.direction !== 1) ||
				typeof w.length !== 'number'
			) {
				throw new InvalidFileError('Invalid wire in file');
			}
			wires.push(
				Wire.deserialize({
					pos: w.pos,
					direction: w.direction,
					length: w.length
				})
			);
		}

		return { components, wires };
	}

	/** Convenience: parse JSON + migrate + deserialize into editor instances. */
	fromJson(content: string): {
		name: string;
		components: Component[];
		wires: Wire[];
	} {
		let parsed: unknown;
		try {
			parsed = JSON.parse(content);
		} catch {
			throw new InvalidFileError('Malformed JSON');
		}
		return this.decode(parsed);
	}

	private _asArray<T>(value: T[] | undefined, field: string): T[] {
		if (value === undefined) return [];
		if (!Array.isArray(value)) {
			throw new InvalidFileError(`File "${field}" must be an array`);
		}
		return value;
	}
}
