import { GraphicsContext } from 'pixi.js';
import { fromGrid } from '../../utils/grid';
import { getStaticDI } from '../../utils/get-di';
import { ThemingService } from '../../theming/theming.service';

export class ComponentGraphics extends GraphicsContext {
	constructor(width: number, height: number, scale: number) {
		super();

		const themingService = getStaticDI(ThemingService);
		const widthPx = fromGrid(width);
		const heightPx = fromGrid(height);

		this.moveTo(0, 0);
		this.lineTo(widthPx - 3, 0);
		this.lineTo(widthPx, 3);
		this.lineTo(widthPx, heightPx - 3);
		this.lineTo(widthPx - 3, heightPx);
		this.lineTo(0, heightPx);
		this.closePath();
		this.stroke({
			color: themingService.currentTheme().wire,
			width: 2 / scale
		});
		this.fill({
			color: themingService.currentTheme().background,
		});
	}
}
