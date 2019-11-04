import * as PIXI from 'pixi.js';
import {Element} from '../element';

export interface LGraphics extends PIXI.DisplayObject {

	readonly element: Element;

	applySimState(scale: number);
	updateScale(scale: number);
	setSelected(selected: boolean);
}

export function isLGraphics(object: any): object is LGraphics {
	return 'applySimState' in object && 'updateScale' in object && 'setSelected' in object && 'element' in object;
}
