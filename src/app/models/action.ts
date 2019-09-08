import {Element} from './element';
import * as PIXI from 'pixi.js';

export type ActionType = 'addComp' |
	'addWire' |
	'addText' |
	'remComp' |
	'remWire' |
	'remText' |
	'movComp' |
	'movWire' |
	'movText' |
	'conWire' |
	'dcoWire' |
	'setComp';

export interface Action {
	name: ActionType;	// TODO element settings
	element?: Element;
	element1?: Element;
	id?: number;
	pos?: PIXI.Point;
	endPos?: PIXI.Point;
}
