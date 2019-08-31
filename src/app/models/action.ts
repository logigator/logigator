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
	component: Component;
	posX?: number;
	posY?: number;
}
