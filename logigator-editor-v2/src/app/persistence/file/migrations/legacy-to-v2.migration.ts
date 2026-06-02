import { Migration, MigrationContext } from './migration';
import { CircuitFileV0, CircuitFileV2 } from '../circuit-file.types';
import { InvalidFileError } from '../circuit-file.errors';
import { buildOptionValues, WIRE_TYPE_ID } from '../../circuit-serializer';
import {
	SerializedComponentBody,
	SerializedWireBody
} from '../../serialized-circuit';
import { ProjectElement } from '../../../api/models/project-element';
import { WireDirection } from '../../../wires/wire-direction.enum';

function legacyWireToBody(el: ProjectElement): SerializedWireBody {
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
 * packed positionally into the `t/p/q/r/i/o/n/s` wire format) into the native v2
 * format with named options. Targets v2 directly — the never-shipped v1 native
 * format has no migration of its own.
 *
 * Registry-backed (needs the component configs to map positional slots to named
 * options) but instantiates no render objects. Legacy sub-circuit definitions
 * (the old `components` array) are dropped — reviving them into `definitions[]`
 * is a separate, deferred task — and the output carries an empty `definitions`.
 * Any element of an unsupported type is dropped, consistent with the editor's
 * silent-drop behavior for unknown component types.
 */
export const legacyToV2Migration: Migration<CircuitFileV0, CircuitFileV2> = {
	from: 0,
	to: 2,
	migrate(input, ctx: MigrationContext): CircuitFileV2 {
		if (!input?.project || !Array.isArray(input.project.elements)) {
			throw new InvalidFileError('Legacy file is missing project elements');
		}

		const components: SerializedComponentBody[] = [];
		const wires: SerializedWireBody[] = [];

		for (const element of input.project.elements) {
			if (element.t === WIRE_TYPE_ID) {
				wires.push(legacyWireToBody(element));
				continue;
			}

			const config = ctx.componentProvider.getComponent(element.t);
			if (!config) {
				ctx.logging.warn(
					`Unknown component type ID: ${element.t} — skipping element at [${element.p[0]}, ${element.p[1]}]`,
					'legacyToV2Migration'
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
			version: 2,
			name: input.project.name ?? 'Untitled',
			components,
			wires,
			definitions: []
		};
	}
};
