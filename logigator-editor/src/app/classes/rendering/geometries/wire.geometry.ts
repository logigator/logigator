import { Graphics, GraphicsGeometry } from 'pixi.js';
import { getStaticDI } from '../../../utils/get-di';
import { ThemingService } from '../../../services/theming/theming.service';

class WireGraphics extends Graphics {
	constructor() {
		super();

		const themingService = getStaticDI(ThemingService);
		this.beginFill(themingService.getEditorColor('wire'));
		this.drawRect(0, 0, 1, 1);
	}
}

let _geometry: GraphicsGeometry;

export const wireGeometry = () => {
	if (!_geometry) {
		_geometry = new WireGraphics().geometry;
	}
	return _geometry;
}
