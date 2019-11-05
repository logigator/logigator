import * as PIXI from 'pixi.js';
import {Element} from '../../element';

export interface LGraphics extends PIXI.DisplayObject {

	readonly element: Element;

	applySimState(scale: number);
	updateScale(scale: number);
	setSelected(selected: boolean);
	setSimulationState(state: boolean[]);
}

export interface ComponentUpdatable {
	updateComponent(scale: number, inputs: number, outputs: number, rotation: number);
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
