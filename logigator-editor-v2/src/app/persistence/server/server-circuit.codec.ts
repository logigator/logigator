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
 */
import type { ProjectElement } from '../../api/models/project-element';
import type { DependencyMapping } from '../../api/models/dependencies';
import type { ComponentConfig } from '../../components/component-config.model';
import type { Project } from '../../project/project';
import type { Component } from '../../components/component';
import type { Wire } from '../../wires/wire';
import { WireDirection } from '../../wires/wire-direction.enum';
import { PersistedCircuitV0 } from '../persisted-circuit.types';
import { CircuitFileV0 } from '../file/circuit-file.types';

/** Old editor's ElementTypeId.WIRE — the canonical type ID for wires in ProjectElement[]. */
export const WIRE_TYPE_ID = 0;

/** The old API transport: a v0 circuit plus its dependency mappings. */
export interface ServerCircuitV0 extends PersistedCircuitV0 {
	elements: ProjectElement[];
	dependencies: DependencyMapping[];
}

/** Wraps a server response (`{ name, elements }`) as a {@link CircuitFileV0} envelope. */
export function toCircuitFileV0(detail: {
	name: string;
	elements: ProjectElement[];
}): CircuitFileV0 {
	return { project: { name: detail.name, elements: detail.elements } };
}

/** Encodes a live project into the v0 server transport shape. */
export function serializeProject(project: Project): ServerCircuitV0 {
	const elements: ProjectElement[] = [];

	for (const component of project.components) {
		elements.push(serializeComponent(component));
	}

	for (const wire of project.wires) {
		elements.push(serializeWire(wire));
	}

	return { elements, dependencies: [] };
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
