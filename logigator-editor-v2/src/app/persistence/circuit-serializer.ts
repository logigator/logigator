import { Injectable, inject } from '@angular/core';
import type { ProjectElement } from '../api/models/project-element';
import type { DependencyMapping } from '../api/models/dependencies';
import type { ComponentConfig } from '../components/component-config.model';
import { Project } from '../project/project';
import { Component } from '../components/component';
import { Wire } from '../wires/wire';
import { WireDirection } from '../wires/wire-direction.enum';
import { ComponentProviderService } from '../components/component-provider.service';
import { ComponentOption } from '../components/component-option';
import { LoggingService } from '../logging/logging.service';

/** Old editor's ElementTypeId.WIRE — the canonical type ID for wires in ProjectElement[]. */
export const WIRE_TYPE_ID = 0;

/**
 * Option keys captured by dedicated `ProjectElement` fields rather than the
 * generic `n`/`s` slots. Single source of truth for both serialize and
 * deserialize.
 */
const RESERVED_KEY_TO_ELEMENT_FIELD = {
	direction: 'r',
	numInputs: 'i',
	numOutputs: 'o'
} as const satisfies Record<string, 'r' | 'i' | 'o'>;

type ReservedKey = keyof typeof RESERVED_KEY_TO_ELEMENT_FIELD;

function isReservedKey(key: string): key is ReservedKey {
	return key in RESERVED_KEY_TO_ELEMENT_FIELD;
}

@Injectable({ providedIn: 'root' })
export class CircuitSerializer {
	private readonly componentProvider = inject(ComponentProviderService);
	private readonly logging = inject(LoggingService);

	serializeProject(project: Project): {
		elements: ProjectElement[];
		dependencies: DependencyMapping[];
	} {
		const elements: ProjectElement[] = [];

		for (const component of project.components) {
			elements.push(this._serializeComponent(component));
		}

		for (const wire of project.wires) {
			elements.push(this._serializeWire(wire));
		}

		return { elements, dependencies: [] };
	}

	deserializeProject(elements: ProjectElement[]): {
		components: Component[];
		wires: Wire[];
	} {
		const components: Component[] = [];
		const wires: Wire[] = [];

		for (const element of elements) {
			if (element.t === WIRE_TYPE_ID) {
				wires.push(this._deserializeWire(element));
			} else {
				const component = this._deserializeComponent(element);
				if (component) {
					components.push(component);
				}
			}
		}

		return { components, wires };
	}

	private _serializeComponent(component: Component): ProjectElement {
		const config = component.config;
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

		const n: number[] = [];
		let sAssigned = false;

		for (const key of Object.keys(config.options)) {
			if (isReservedKey(key)) continue;

			const option = component.options[key];
			if (option.wireSlot === 'n') {
				n.push(option.value as number);
			} else if (option.wireSlot === 's' && !sAssigned) {
				// First TextAreaComponentOption wins; subsequent string options
				// are intentionally dropped (the wire format has only one `s`).
				el.s = option.value as string;
				sAssigned = true;
			}
		}

		if (n.length > 0) {
			el.n = n;
		}

		return el;
	}

	private _serializeWire(wire: Wire): ProjectElement {
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

	private _deserializeComponent(element: ProjectElement): Component | null {
		const typeId = element.t;
		const config = this.componentProvider.getComponent(typeId);

		if (!config) {
			this.logging.warn(
				`Unknown component type ID: ${typeId} — skipping element at [${element.p[0]}, ${element.p[1]}]`,
				'CircuitSerializer'
			);
			return null;
		}

		const options = this._buildOptions(element, config);
		const component = new config.implementation(options);
		component.position.set(element.p[0], element.p[1]);

		return component;
	}

	private _buildOptions(
		element: ProjectElement,
		config: ComponentConfig
	): Record<string, ComponentOption> {
		const result: Record<string, ComponentOption> = {};
		let nIndex = 0;
		let sConsumed = false;

		for (const [key, proto] of Object.entries(config.options)) {
			if (isReservedKey(key)) {
				const field = RESERVED_KEY_TO_ELEMENT_FIELD[key];
				const raw = element[field];
				result[key] = proto.clone(raw ?? proto.value);
				continue;
			}

			if (proto.wireSlot === 'n') {
				const value =
					element.n && nIndex < element.n.length
						? element.n[nIndex++]
						: proto.value;
				result[key] = proto.clone(value);
			} else if (proto.wireSlot === 's') {
				const value =
					!sConsumed && element.s !== undefined ? element.s : proto.value;
				sConsumed = true;
				result[key] = proto.clone(value);
			} else {
				result[key] = proto.clone();
			}
		}

		return result;
	}

	private _deserializeWire(element: ProjectElement): Wire {
		const [px, py] = element.p;
		const [qx, qy] = element.q!;

		let direction: WireDirection;
		let length: number;

		if (qy === py) {
			direction = WireDirection.HORIZONTAL;
			length = qx - px;
		} else {
			direction = WireDirection.VERTICAL;
			length = qy - py;
		}

		const wire = new Wire(direction, length);
		wire.position.set(px + 0.5, py + 0.5);

		return wire;
	}
}
