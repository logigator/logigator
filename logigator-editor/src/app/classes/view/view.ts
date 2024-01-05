import { Container } from 'pixi.js';

import { romComponentConfig } from '../rendering/components/rom.component';
import { ScalingGraphics } from '../rendering/component';


export class View extends Container {
	override sortableChildren = false;

	constructor() {
		super();

		const component = romComponentConfig.generate(romComponentConfig.options.map(x => x.clone()));
		component.position.set(100, 100);

		this.addChild(component);

	}

	public updateScale(scale: number) {
		console.log(scale);
		this.scale.set(scale);

		for (const child of this.children) {
			if (child instanceof ScalingGraphics) {
				child.applyConstantScale(scale);
			}
		}
	}

}
