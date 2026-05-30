import { Injectable, inject } from '@angular/core';
import { Project } from '../../project/project';
import { Component } from '../../components/component';
import { Wire } from '../../wires/wire';
import { ComponentProviderService } from '../../components/component-provider.service';
import { LoggingService } from '../../logging/logging.service';
import { MigrationContext } from './migrations/migration';
import { migrateToCurrent } from './circuit-file-migrator';
import { InvalidFileError } from './circuit-file.errors';
import {
	CURRENT_FILE_VERSION,
	CircuitFileComponentV1,
	CircuitFileV1,
	CircuitFileWireV1,
	CurrentCircuitFile
} from './circuit-file.types';

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
 * This is purely the file-format codec — it does not touch project metadata or
 * the active-project lifecycle (that is `PersistenceService`'s job).
 */
@Injectable({ providedIn: 'root' })
export class CircuitFileService {
	private readonly componentProvider = inject(ComponentProviderService);
	private readonly logging = inject(LoggingService);

	private get migrationContext(): MigrationContext {
		return {
			componentProvider: this.componentProvider,
			logging: this.logging
		};
	}

	/** Serializes a project to a current-version file JSON string. */
	toJson(project: Project, name: string): string {
		const components: CircuitFileComponentV1[] = [];
		for (const component of project.components) {
			components.push({
				type: component.config.type,
				pos: [component.position.x, component.position.y],
				options: Object.fromEntries(
					Object.entries(component.options).map(([key, opt]) => [
						key,
						opt.value
					])
				)
			});
		}

		const wires: CircuitFileWireV1[] = [];
		for (const wire of project.wires) {
			wires.push({
				pos: [Math.floor(wire.position.x), Math.floor(wire.position.y)],
				direction: wire.direction,
				length: wire.length
			});
		}

		const file: CurrentCircuitFile = {
			version: CURRENT_FILE_VERSION,
			name,
			components,
			wires
		};
		return JSON.stringify(file);
	}

	/** Parses + migrates file content to a current-version document. */
	parse(content: string): CurrentCircuitFile {
		let parsed: unknown;
		try {
			parsed = JSON.parse(content);
		} catch {
			throw new InvalidFileError('Malformed JSON');
		}
		return migrateToCurrent(parsed, this.migrationContext);
	}

	/**
	 * Decodes a current-version document into editor instances. Sole structural
	 * validator for native files (the migrator passes an already-current document
	 * through untouched): structurally broken elements throw `InvalidFileError`,
	 * while unknown component types are dropped with a warning. Elements carry no
	 * id, so fresh ids are allocated on construction.
	 */
	deserialize(file: CurrentCircuitFile): {
		components: Component[];
		wires: Wire[];
	} {
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
			const config = this.componentProvider.getComponent(c.type);
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

	/** Convenience: parse + migrate + deserialize into editor instances. */
	fromJson(content: string): {
		name: string;
		components: Component[];
		wires: Wire[];
	} {
		const file = this.parse(content);
		const name = typeof file.name === 'string' ? file.name : 'Untitled';
		return { name, ...this.deserialize(file) };
	}

	private _asArray<T>(value: T[] | undefined, field: string): T[] {
		if (value === undefined) return [];
		if (!Array.isArray(value)) {
			throw new InvalidFileError(`File "${field}" must be an array`);
		}
		return value;
	}
}
