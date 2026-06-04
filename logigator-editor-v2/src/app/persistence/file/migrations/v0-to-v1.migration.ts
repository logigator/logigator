import { Migration, MigrationContext } from './migration';
import { CircuitFileV0, CircuitFileV1 } from '../circuit-file.types';
import { InvalidFileError } from '../circuit-file.errors';
import {
	SerializedComponentBody,
	SerializedWireBody
} from '../../serialized-circuit';
import { ProjectElement } from '../../../api/models/project-element';
import { WireDirection } from '../../../wires/wire-direction.enum';
import { ComponentConfig } from '../../../components/component-config.model';

/** Old editor's ElementTypeId.WIRE — the canonical type ID for wires in the v0 format. */
const WIRE_TYPE_ID = 0;

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
 * Decodes a v0 element's positional option slots into **named** option values,
 * driven by the config's {@link ComponentConfig.legacyV0Slots} descriptor. Every
 * option starts at its default; the descriptor then overrides those it maps to a
 * present `r`/`i`/`o`/`n`/`s` field. Pure: reads only config metadata, builds no
 * render objects.
 */
function decodeOptions(
	element: ProjectElement,
	config: ComponentConfig
): Record<string, unknown> {
	const slots = config.legacyV0Slots ?? {};
	const values: Record<string, unknown> = {};
	for (const [key, proto] of Object.entries(config.options)) {
		values[key] = proto.value;
	}

	if (slots.r && element.r !== undefined) values[slots.r] = element.r;
	if (slots.i && element.i !== undefined) values[slots.i] = element.i;
	if (slots.o && element.o !== undefined) values[slots.o] = element.o;
	if (slots.n && element.n) {
		slots.n.forEach((key, index) => {
			if (element.n && index < element.n.length) {
				values[key] = element.n[index];
			}
		});
	}
	if (slots.s && element.s !== undefined) values[slots.s] = element.s;

	return values;
}

/**
 * Converts the legacy `logigator-editor` file format (v0: no `version` field,
 * options packed positionally into the `t/p/q/r/i/o/n/s` wire format) into the
 * native v1 format with named options. This is a single v0→v1 step — the next
 * version in the chain, not a jump to newest.
 *
 * Registry-backed (needs the component configs and their `legacyV0Slots`
 * descriptors to map positional slots to named options) but instantiates no
 * render objects. Legacy sub-circuit definitions (the old `components` array)
 * are dropped — reviving them into `definitions[]` is a separate, deferred task
 * — and the output carries an empty `definitions`. Any element whose type is
 * unknown or carries no `legacyV0Slots` descriptor is dropped with a warning,
 * consistent with the editor's silent-drop behavior for unknown component types.
 */
export const v0ToV1Migration: Migration<CircuitFileV0, CircuitFileV1> = {
	from: 0,
	to: 1,
	migrate(input, ctx: MigrationContext): CircuitFileV1 {
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
			if (!config || !config.legacyV0Slots) {
				ctx.logging.warn(
					`Unknown component type ID: ${element.t} — skipping element at [${element.p[0]}, ${element.p[1]}]`,
					'v0ToV1Migration'
				);
				continue;
			}

			components.push({
				type: element.t,
				pos: [element.p[0], element.p[1]],
				options: decodeOptions(element, config)
			});
		}

		return {
			version: 1,
			name: input.project.name ?? 'Untitled',
			components,
			wires,
			definitions: []
		};
	}
};
