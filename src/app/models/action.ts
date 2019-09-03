import {Component} from './component';
import * as PIXI from 'pixi.js';

export interface Action {
	name: 'addComp' |
		'addWire' |
		'addText' |
		'remComp' |
		'remWire' |
		'remText' |
		'movComp' |
		'movWire' |
		'movText' |
		'conWire' |	// TODO connect Wire
		'setComp';	// TODO component settings
	component?: Component;
	id?: number;
	pos?: PIXI.Point;
	startPos?: PIXI.Point;
}
