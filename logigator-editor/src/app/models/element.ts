import * as PIXI from 'pixi.js';
import {ElementTypeId} from './element-types/element-type-ids';

export interface Element {
	id: number;
	typeId: ElementTypeId;

	numInputs: number;
	numOutputs: number;

	pos: PIXI.Point;
	endPos?: PIXI.Point;

	wireEnds?: PIXI.Point[];

	rotation?: ElementRotation;

	plugIndex?: number;

	options?: number[];

	data?: unknown;
}

export const enum ElementRotation {
	right,
	down,
	left,
	up
}
