import { Graphics } from 'pixi.js';
import { getStaticDI } from '../../../utils/get-di';
import { ThemingService } from '../../../services/theming/theming.service';

export class WireGraphics extends Graphics {
	constructor() {
		super();

		const themingService = getStaticDI(ThemingService);
		this.beginFill(themingService.getEditorColor('wire'));
		this.drawRect(0, 0, 1, 1);
	}
}
