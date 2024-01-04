// @ts-strict-ignore
import * as PIXI from 'pixi.js';
import { RomComponent } from '../element/elements/rom-component';

export class View extends PIXI.Container {
	constructor() {
		super();
		this.sortableChildren = false;

		this.addChild(new RomComponent());
	}

}
