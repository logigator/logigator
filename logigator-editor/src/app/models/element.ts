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

	rotation?: number;

	plugIndex?: number;

	options?: number[];

	data?: unknown;
}
