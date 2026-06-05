import { Migration, MigrationContext } from './migration';
import { CircuitFileV0, CircuitFileV1 } from '../circuit-file.types';
import { InvalidFileError } from '../circuit-file.errors';
import {
	SerializedComponentBody,
	SerializedWireBody,
	SnapshotDefinition
} from '../../serialized-circuit';
import { ProjectElement } from '../../../api/models/project-element';
import { WireDirection } from '../../../wires/wire-direction.enum';
import { ComponentConfig } from '../../../components/component-config.model';
import { CUSTOM_TYPE_ID_BASE } from '../../../components/component-type.enum';

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
 * Decodes a positional element list into the native body (components + wires),
 * shared by the document body and every embedded snapshot's circuit. Wires
 * become {@link SerializedWireBody}; built-ins map their positional slots to
 * named options; custom-range elements (`t >= CUSTOM_TYPE_ID_BASE`, written by a
 * snapshot-bearing save) keep their file-local type id and round-trip only
 * `direction` — port counts/labels come from the resolved definition on load
 * (Invariant A), so no config lookup is needed. Unknown built-in types are
 * dropped with a warning, consistent with the editor's silent-drop behaviour.
 */
function decodeElements(
	elements: ProjectElement[],
	ctx: MigrationContext
): { components: SerializedComponentBody[]; wires: SerializedWireBody[] } {
	const components: SerializedComponentBody[] = [];
	const wires: SerializedWireBody[] = [];

	for (const element of elements) {
		if (element.t === WIRE_TYPE_ID) {
			wires.push(legacyWireToBody(element));
			continue;
		}

		if (element.t >= CUSTOM_TYPE_ID_BASE) {
			components.push({
				type: element.t,
				pos: [element.p[0], element.p[1]],
				options: { direction: element.r ?? 0 }
			});
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

	return { components, wires };
}

/**
 * Revives the additive embedded snapshots (R14) carried by a server response's
 * `dependencies` into native {@link SnapshotDefinition}s. Each entry's `model`
 * is the file-local type id (kept verbatim so the body's custom `t`s match);
 * the summary travels frozen inside the `snapshot` (so a stale instance renders
 * at its own ports, not the master's current ones); `source` provenance comes
 * from the dependency id + the snapshot version. Reference-only dependencies (no
 * embedded `snapshot`, i.e. the old always-latest model) are skipped here — their
 * body elements then surface as unresolved customs and are dropped with a warning
 * on load (see `CircuitFileService.deserialize`).
 */
function decodeDependencies(
	input: CircuitFileV0,
	ctx: MigrationContext
): SnapshotDefinition[] {
	const definitions: SnapshotDefinition[] = [];
	for (const dep of input.dependencies ?? []) {
		if (!dep.snapshot) continue;
		const { components, wires } = decodeElements(dep.snapshot.elements, ctx);
		const id = dep.id ?? dep.dependency?.id;
		definitions.push({
			type: dep.model,
			source:
				id !== undefined ? { id, version: dep.snapshot.version } : undefined,
			name: dep.snapshot.name,
			symbol: dep.snapshot.symbol,
			description: dep.snapshot.description,
			numInputs: dep.snapshot.numInputs,
			numOutputs: dep.snapshot.numOutputs,
			labels: [...dep.snapshot.labels],
			components,
			wires
		});
	}
	return definitions;
}

/**
 * Converts the legacy `logigator-editor` file format (v0: no `version` field,
 * options packed positionally into the `t/p/q/r/i/o/n/s` wire format) into the
 * native v1 format with named options. This is a single v0→v1 step — the next
 * version in the chain, not a jump to newest.
 *
 * Registry-backed (needs the component configs and their `legacyV0Slots`
 * descriptors to map positional slots to named options) but instantiates no
 * render objects. Legacy old-editor sub-circuit definitions (the inline
 * `components` array) are still dropped — reviving those is a separate, deferred
 * task. The server transport's additive embedded snapshots, however, ARE revived
 * into `definitions[]` (so a server load is self-contained and indistinguishable
 * from a file load downstream).
 */
export const v0ToV1Migration: Migration<CircuitFileV0, CircuitFileV1> = {
	from: 0,
	to: 1,
	migrate(input, ctx: MigrationContext): CircuitFileV1 {
		if (!input?.project || !Array.isArray(input.project.elements)) {
			throw new InvalidFileError('Legacy file is missing project elements');
		}

		const { components, wires } = decodeElements(input.project.elements, ctx);

		return {
			version: 1,
			name: input.project.name ?? 'Untitled',
			components,
			wires,
			definitions: decodeDependencies(input, ctx)
		};
	}
};
