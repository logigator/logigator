import { Graphics } from 'pixi.js';
import { getStaticDI } from '../../../utils/get-di';
import { ThemingService } from '../../../services/theming/theming.service';
import { fromGrid } from '../../../utils/grid';

export class ComponentGraphics extends Graphics {
	constructor(width: number, height: number) {
		super();

		const themingService = getStaticDI(ThemingService);
		const widthPx = fromGrid(width);
		const heightPx = fromGrid(height);

		this.lineStyle(1, themingService.getEditorColor('wire'), 1, 0.5, true);
		this.beginFill(themingService.getEditorColor('background'));

		this.moveTo(0, 0);
		this.lineTo(widthPx - 3, 0);
		this.lineTo(widthPx, 3);
		this.lineTo(widthPx, heightPx - 3);
		this.lineTo(widthPx - 3, heightPx);
		this.lineTo(0, heightPx);
		this.closePath();
	}
}
