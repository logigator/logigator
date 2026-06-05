/**
 * @deprecated TEMPORARY — delete when the native-model API ships.
 *
 * The server API is legacy: it transports the positional `ProjectElement[]`
 * format, which is conceptually **file-format version 0 over HTTP**. This module
 * is the throwaway half of handling it — the **encoder** that packs a live
 * `Project` back into the v0 wire shape ({@link ServerCircuitV0}) for PUT/save,
 * plus the {@link toCircuitFileV0} read adapter that wraps a server response as a
 * {@link CircuitFileV0} so reads route through the permanent `v0ToV1` migration.
 *
 * Decode is NOT here — it lives in the permanent migration chain. When the
 * native-model API replaces this transport, this entire folder is deleted; the
 * `v0ToV1` migration and the file format stay.
 *
 * Encode reads each config's {@link ComponentConfig.legacyV0Slots} descriptor in
 * reverse (the same descriptor the `v0ToV1` migration uses to decode); the
 * `i`/`o`/`r` slots come straight from the component's first-class
 * `numInputs`/`numOutputs`/`direction` fields, so fixed-arity types still emit
 * them without a descriptor entry.
 *
 * Custom components are folded in via the universal snapshot codec
 * (`persistence/snapshots.ts`): every custom the project transitively places
 * becomes a `dependencies[]` entry carrying the legacy `{ id, model }` (for
 * old-client compat) **plus** the additive frozen `snapshot` (the embedded
 * circuit, named per R14). The document body and the snapshot bodies all use
 * file-local type ids (≥ {@link CUSTOM_TYPE_ID_BASE}) so the decode's
 * `ingestSnapshots` can remap them to session ids in one pass.
 */
import type { ProjectElement } from '../../api/models/project-element';
import type { DependencyMapping } from '../../api/models/dependencies';
import type { ComponentConfig } from '../../components/component-config.model';
import type { Project } from '../../project/project';
import type { Component } from '../../components/component';
import type { Wire } from '../../wires/wire';
import type { ComponentProviderService } from '../../components/component-provider.service';
import type { CustomComponentRegistry } from '../../components/custom/custom-component-registry.service';
import type {
	SerializedComponentBody,
	SerializedWireBody,
	SnapshotDefinition
} from '../serialized-circuit';
import { WireDirection } from '../../wires/wire-direction.enum';
import { CUSTOM_TYPE_ID_BASE } from '../../components/component-type.enum';
import { PersistedCircuitV0 } from '../persisted-circuit.types';
import { CircuitFileV0 } from '../file/circuit-file.types';
import { collectSnapshots } from '../snapshots';

/** Old editor's ElementTypeId.WIRE — the canonical type ID for wires in ProjectElement[]. */
export const WIRE_TYPE_ID = 0;

/** The old API transport: a v0 circuit plus its dependency mappings. */
export interface ServerCircuitV0 extends PersistedCircuitV0 {
	elements: ProjectElement[];
	dependencies: DependencyMapping[];
}

/**
 * Wraps a server response as a {@link CircuitFileV0} envelope. The `dependencies`
 * (carrying the additive embedded snapshots) are threaded through so the
 * `v0ToV1` migration can revive them into `definitions[]`.
 */
export function toCircuitFileV0(detail: {
	name: string;
	elements: ProjectElement[];
	dependencies?: CircuitFileV0['dependencies'];
}): CircuitFileV0 {
	return {
		project: { name: detail.name, elements: detail.elements },
		dependencies: detail.dependencies
	};
}

/**
 * Encodes a live project into the v0 server transport shape, embedding a frozen
 * snapshot of every custom it transitively places. The body's custom `t`s and
 * each `dependencies[].model` use the file-local ids from
 * {@link collectSnapshots}, so they match the embedded snapshots' `type`s.
 */
export function serializeProject(
	project: Project,
	registry: CustomComponentRegistry,
	provider: ComponentProviderService
): ServerCircuitV0 {
	const { definitions, sessionToLocal } = collectSnapshots(project, registry);

	const elements: ProjectElement[] = [];
	for (const component of project.components) {
		const el = serializeComponent(component);
		const local = sessionToLocal.get(el.t);
		if (local !== undefined) el.t = local; // custom: session id -> file-local id
		elements.push(el);
	}
	for (const wire of project.wires) {
		elements.push(serializeWire(wire));
	}

	const dependencies: DependencyMapping[] = definitions.map((def) => ({
		// Provenance back to the library master; '' for a never-saved-to-library
		// local (promotion into the server library is a deferred follow-up).
		id: def.source?.id ?? '',
		model: def.type, // file-local id, matches the body `t` and the snapshot
		snapshot: {
			version: def.source?.version ?? 1,
			name: def.name,
			symbol: def.symbol,
			description: def.description,
			numInputs: def.numInputs,
			numOutputs: def.numOutputs,
			labels: [...def.labels],
			elements: encodeDefinitionElements(def, provider)
		}
	}));

	return { elements, dependencies };
}

function serializeComponent(component: Component): ProjectElement {
	// Every real config is a full ComponentConfig; the base only narrows it to
	// the view. The descriptor lives on the config, so widen back.
	const config = component.config as ComponentConfig;
	const el: ProjectElement = {
		t: config.type,
		p: [component.position.x, component.position.y]
	};

	if (component.numInputs > 0) {
		el.i = component.numInputs;
	}
	if (component.numOutputs > 0) {
		el.o = component.numOutputs;
	}
	if (component.direction !== 0) {
		el.r = component.direction;
	}

	const slots = config.legacyV0Slots;
	if (slots?.n && slots.n.length > 0) {
		el.n = slots.n.map((key) => component.options[key].value as number);
	}
	if (slots?.s) {
		el.s = component.options[slots.s].value as string;
	}

	return el;
}

function serializeWire(wire: Wire): ProjectElement {
	const gridX = Math.floor(wire.position.x);
	const gridY = Math.floor(wire.position.y);

	let endX: number;
	let endY: number;

	if (wire.direction === WireDirection.HORIZONTAL) {
		endX = gridX + wire.length;
		endY = gridY;
	} else {
		endX = gridX;
		endY = gridY + wire.length;
	}

	return {
		t: WIRE_TYPE_ID,
		p: [gridX, gridY],
		q: [endX, endY]
	};
}

/**
 * Encodes one snapshot definition's circuit (already file-local-numbered by
 * {@link collectSnapshots}) into positional elements. No instantiation: the
 * named-option body is mapped straight to the wire slots. Snapshot bodies are
 * read only by *our* decode (old clients ignore the `snapshot` field), so
 * fixed-/derived-arity `i`/`o` are reconstructed from the type on decode and are
 * intentionally not emitted here.
 */
function encodeDefinitionElements(
	def: SnapshotDefinition,
	provider: ComponentProviderService
): ProjectElement[] {
	const elements: ProjectElement[] = [];
	for (const component of def.components) {
		elements.push(encodeBodyComponent(component, provider));
	}
	for (const wire of def.wires) {
		elements.push(encodeBodyWire(wire));
	}
	return elements;
}

function encodeBodyComponent(
	component: SerializedComponentBody,
	provider: ComponentProviderService
): ProjectElement {
	const el: ProjectElement = {
		t: component.type,
		p: [component.pos[0], component.pos[1]]
	};

	if (component.type >= CUSTOM_TYPE_ID_BASE) {
		// Nested custom: no legacy slots — only the direction round-trips; the
		// instance's counts/labels come from its own definition on load (Inv. A).
		const dir = component.options['direction'];
		if (typeof dir === 'number' && dir !== 0) el.r = dir;
		return el;
	}

	const config = provider.getComponent(component.type);
	const slots = (config as ComponentConfig | undefined)?.legacyV0Slots;
	if (!slots) return el;

	if (slots.r) {
		const v = component.options[slots.r];
		if (typeof v === 'number' && v !== 0) el.r = v;
	}
	if (slots.i) {
		const v = component.options[slots.i];
		if (typeof v === 'number') el.i = v;
	}
	if (slots.o) {
		const v = component.options[slots.o];
		if (typeof v === 'number') el.o = v;
	}
	if (slots.n && slots.n.length > 0) {
		el.n = slots.n.map((key) => component.options[key] as number);
	}
	if (slots.s) {
		const v = component.options[slots.s];
		if (v !== undefined) el.s = v as string;
	}

	return el;
}

function encodeBodyWire(wire: SerializedWireBody): ProjectElement {
	const [x, y] = wire.pos;
	const end: [number, number] =
		wire.direction === WireDirection.HORIZONTAL
			? [x + wire.length, y]
			: [x, y + wire.length];
	return { t: WIRE_TYPE_ID, p: [x, y], q: end };
}
