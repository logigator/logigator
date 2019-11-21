import * as PIXI from 'pixi.js';
import {Element} from '../../element';

export interface ComponentUpdatable {
	updateComponent(scale: number, newElement: Element);
}

export interface ComponentScalable {
	updateScale(scale: number);
}

export interface ComponentSelectable {
	setSelected(selected: boolean);
}

export interface LGraphics extends PIXI.DisplayObject, ComponentScalable, ComponentSelectable {

	readonly element: Element;

	applySimState(scale: number);
	setSimulationState(state: boolean[]);
}

export function isLGraphics(object: any): object is LGraphics {
	return 'applySimState' in object &&
		'updateScale' in object &&
		'setSelected' in object &&
		'setSimulationState' in object &&
		'element' in object;
}

export function isUpdatable(object: any): object is ComponentUpdatable {
	return 'updateComponent' in object;
}

export function isScalable(object: any): object is ComponentSelectable {
	return 'updateScale' in object;
}
