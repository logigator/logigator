import * as PIXI from 'pixi.js';
import {getStaticDI} from '../get-di';
import {ThemingService} from '../../services/theming/theming.service';

export abstract class LGraphics extends PIXI.Graphics {

	protected _scale: number;
	protected themingService = getStaticDI(ThemingService);

	protected constructor(scale: number) {
		super();
		this._scale = scale;
	}

	abstract applySimState(scale: number);
	abstract updateScale(scale: number);
}
