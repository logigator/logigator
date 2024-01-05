import { Container, Point } from 'pixi.js';

import { romComponentConfig } from '../rendering/components/rom.component';
import { ScalingGraphics } from '../rendering/component';
import { getStaticDI } from '../../utils/get-di';
import { PixiLoaderService } from '../../services/pixi-loader/pixi-loader.service';

export class View extends Container {
	override sortableChildren = false;

	constructor() {
		super();

		getStaticDI(PixiLoaderService).loaded$.subscribe(() => {
			const component = romComponentConfig.generate(romComponentConfig.options.map(x => x.clone()));
			component.gridPos = new Point(0, 0);

			this.addChild(component);

			// setInterval(() => {
			// 	component.options[0].value = (component.options[0].value as ElementRotation + 1) % 4
			// }, 500);
		});
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
