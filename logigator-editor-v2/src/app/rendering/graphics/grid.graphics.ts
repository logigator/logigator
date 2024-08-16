import { GraphicsContext } from 'pixi.js';
import { fromGrid } from '../../utils/grid';
import { environment } from '../../../environments/environment';
import { getStaticDI } from '../../utils/get-di';
import { ThemingService } from '../../theming/theming.service';

export class GridGraphics extends GraphicsContext {
	constructor(size: number, scale: number) {
		super();

		const themingService = getStaticDI(ThemingService);
		const sizePx = fromGrid(size);

		for (let x = 0; x <= sizePx; x += environment.gridSize) {
			for (let y = 0; y <= sizePx; y += environment.gridSize) {
				this.rect(x, y, 1 / scale, 1 / scale);
			}
		}
		this.fill(themingService.currentTheme().grid);

		if (environment.debug.showGridBorders) {
			this.rect(0, 0, sizePx, sizePx);
			this.stroke({
				color: 0xff0000,
				alpha: 0.2,
				width: 1 / scale
			});
		}
	}
}
