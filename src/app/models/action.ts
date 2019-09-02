import {Component} from './component';

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
	posX?: number;
	posY?: number;
}
