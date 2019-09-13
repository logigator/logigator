import { Injectable } from '@angular/core';
import {ElementType} from '../../models/element-type';
import {wire} from '../../models/element-types/wire';
import {not} from '../../models/element-types/not';
import {and} from '../../models/element-types/and';
import {or} from '../../models/element-types/or';
import {xor} from '../../models/element-types/xor';

@Injectable({
	providedIn: 'root'
})
export class ElementProviderService {

	public static staticInstance: ElementProviderService;

	private _predefinedElements: Map<number, ElementType> = new Map([
		[0, wire],
		[1, not],
		[2, and],
		[3, or],
		[4, xor],
	]);

	private _userDefinedElements: Map<number, ElementType> = new Map<number, ElementType>();

	private _renderer: PIXI.Renderer;

	constructor() {
		ElementProviderService.staticInstance = this;
	}

	public getElementById(id: number): ElementType {
		if (this._predefinedElements.has(id)) {
			return this._predefinedElements.get(id);
		}
		return this._userDefinedElements.get(id);
	}

	public insertPixiRenderer(renderer: PIXI.Renderer) {
		this._renderer = renderer;
	}

	public generateTextureForElement(id: number) {
		let comp;
		if (this._predefinedElements.has(id)) {
			comp = this._predefinedElements.get(id);
		} else {
			comp = this._userDefinedElements.get(id);
		}
		comp.texture = comp.generateElementTexture(this._renderer, comp.symbol);
	}

	public getPreDefinedElements(): Map<number, ElementType> {
		return this._predefinedElements;
	}

	public getUserDefinedElements(): Map<number, ElementType> {
		return this._userDefinedElements;
	}

}
