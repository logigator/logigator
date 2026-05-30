import { Migration, MigrationContext } from './migration';
import {
	CircuitFileComponentV1,
	CircuitFileV0,
	CircuitFileV1,
	CircuitFileWireV1
} from '../circuit-file.types';
import { InvalidFileError } from '../circuit-file.errors';
import { buildOptionValues, WIRE_TYPE_ID } from '../../circuit-serializer';
import { ProjectElement } from '../../../api/models/project-element';
import { WireDirection } from '../../../wires/wire-direction.enum';

function legacyWireToV1(el: ProjectElement): CircuitFileWireV1 {
	const [px, py] = el.p;
	const [qx, qy] = el.q!;
	const horizontal = qy === py;
	return {
		pos: [px, py],
		direction: horizontal ? WireDirection.HORIZONTAL : WireDirection.VERTICAL,
		length: horizontal ? qx - px : qy - py
	};
}

/**
 * Converts the legacy `logigator-editor` file format (no `version` field, options
 * packed positionally into the `t/p/q/r/i/o/n/s` wire format) into the native v1
 * format with named options.
 *
 * Registry-backed (needs the component configs to map positional slots to named
 * options) but instantiates no render objects. Legacy sub-circuit definitions
 * (`components`) and any element of an unsupported type are dropped — consistent
 * with the editor's silent-drop behavior for unknown component types.
 */
export const legacyToV1Migration: Migration<CircuitFileV0, CircuitFileV1> = {
	from: 0,
	to: 1,
	migrate(input, ctx: MigrationContext): CircuitFileV1 {
		if (!input?.project || !Array.isArray(input.project.elements)) {
			throw new InvalidFileError('Legacy file is missing project elements');
		}

		const components: CircuitFileComponentV1[] = [];
		const wires: CircuitFileWireV1[] = [];

		for (const element of input.project.elements) {
			if (element.t === WIRE_TYPE_ID) {
				wires.push(legacyWireToV1(element));
				continue;
			}

			const config = ctx.componentProvider.getComponent(element.t);
			if (!config) {
				ctx.logging.warn(
					`Unknown component type ID: ${element.t} — skipping element at [${element.p[0]}, ${element.p[1]}]`,
					'legacyToV1Migration'
				);
				continue;
			}

			components.push({
				type: element.t,
				pos: [element.p[0], element.p[1]],
				options: buildOptionValues(element, config)
			});
		}

		return {
			version: 1,
			name: input.project.name ?? 'Untitled',
			components,
			wires
		};
	}
};
