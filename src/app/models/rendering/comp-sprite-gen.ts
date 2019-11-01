import {environment} from '../../../environments/environment';
import * as PIXI from 'pixi.js';
import {getStaticDI} from '../get-di';
import {ThemingService} from '../../services/theming/theming.service';
import {ComponentGraphics} from './component-graphics';

export abstract class CompSpriteGen {

	private static _renderers = new Map<number, PIXI.Renderer>();

	private static _textureCache = new Map<number, Map<string, PIXI.RenderTexture>>();

	public static injectRenderer(renderer: PIXI.Renderer, id: number) {
		this._renderers.set(id, renderer);
		this._textureCache.set(id, new Map<string, PIXI.RenderTexture>());
	}

	public static getComponentSprite(
		rendererId: number,
		scale: number,
		symbol: string,
		inputs: number,
		outputs: number,
		rotation: number
	): PIXI.Sprite {
		const sprite = new PIXI.Sprite(this.getTexture(rendererId, scale, inputs, outputs, rotation).clone());
		sprite.scale.x = 1 / scale;
		sprite.scale.y = 1 / scale;
		this.addSymbol(symbol, scale, rotation, sprite);
		return sprite;
	}

	public static updateComponentSprite(
		rendererId: number,
		scale: number,
		symbol: string,
		inputs: number,
		outputs: number,
		rotation: number,
		sprite: PIXI.Sprite
	) {
		sprite.texture = this.getTexture(rendererId, scale, inputs, outputs, rotation);
		sprite.anchor = sprite.texture.defaultAnchor;
		sprite.scale.x = 1 / scale;
		sprite.scale.y = 1 / scale;
		this.addSymbol(symbol, scale, rotation, sprite);
	}

	private static getTexture(rendererId: number, scale: number, inputs: number, outputs: number, rotation: number): PIXI.RenderTexture {
		const key = `${scale}:${inputs}:${outputs}${rotation}`;
		if (this._textureCache.get(rendererId).has(key)) {
			return this._textureCache.get(rendererId).get(key);
		} else {
			const graphics = new ComponentGraphics(scale, inputs, outputs, rotation);
			const tex = this._renderers.get(rendererId).generateTexture(
				graphics,
				PIXI.SCALE_MODES.NEAREST,
				Math.ceil(window.devicePixelRatio || 1)
			);
			if ((rotation === 0 && inputs > 0) || (rotation === 2 && outputs > 0)) {
				tex.defaultAnchor.x = (environment.gridPixelWidth / 2 * scale) / tex.width;
				tex.defaultAnchor.y = 0;
			} else if ((rotation === 1 && inputs > 0) || (rotation === 3 && outputs > 0)) {
				tex.defaultAnchor.y = (environment.gridPixelWidth / 2 * scale) / tex.height;
				tex.defaultAnchor.x = 0;
			}
			this._textureCache.get(rendererId).set(key, tex);
			return tex;
		}
	}

	private static addSymbol(symbol: string, scale: number, rotation: number, sprite: PIXI.Sprite) {
		sprite.removeChildren(0);
		const text = new PIXI.BitmapText(symbol, {
			font: {
				name: 'Nunito',
				size: (environment.gridPixelWidth + 4) * scale
			},
			tint: getStaticDI(ThemingService).getEditorColor('fontTint')
		});
		if (rotation === 0 || rotation === 2) {
			text.anchor = new PIXI.Point(1, 0.5);
		} else {
			text.anchor = new PIXI.Point(0.5, 1);
		}
		text.position.x = sprite.width / 2 * scale;
		text.position.y = sprite.height / 2 * scale;

		sprite.addChild(text);
	}

}
