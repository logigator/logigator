import { Graphics } from 'pixi.js';
import { getStaticDI } from '../../../utils/get-di';
import { ThemingService } from '../../../services/theming/theming.service';
import { fromGrid } from '../../../utils/grid';
import { environment } from '../../../../environments/environment';

export class GridGraphics extends Graphics {
	constructor(size: number, scale: number) {
		super();

		const themingService = getStaticDI(ThemingService);
		const sizePx = fromGrid(size);

		this.beginFill(themingService.getEditorColor('grid'));

		for (let x = 0; x <= sizePx; x += environment.gridSize) {
			for (let y = 0; y <= sizePx; y += environment.gridSize) {
				this.drawRect(x, y, 1 / scale, 1 / scale);
			}
		}

		if (environment.debug.showGridBorders) {
			this.lineStyle(1 / scale, 0xff0000, 0.25, 0.5);
			this.endFill();
			this.drawRect(0, 0, sizePx, sizePx);
		}
	}
}
