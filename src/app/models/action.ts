import {Element} from './element';
import * as PIXI from 'pixi.js';

export type ActionType = 'addComp' |
	'addWire' |
	'addText' |
	'remComp' |
	'remWire' |
	'remText' |
	'movMult' |
	'conWire' |
	'dcoWire' |
	'setComp';

export interface Action {
	name: ActionType;	// TODO element settings
	element?: Element;
	others?: Element[];
	oldElements?: Element[];
	id?: number;
	pos?: PIXI.Point;
	endPos?: PIXI.Point;
}
