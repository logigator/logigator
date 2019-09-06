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

	private _elements: Map<number, ElementType> = new Map([
		[0, wire],
		[1, not],
		[2, and],
		[3, or],
		[4, xor],
	]);

	private _renderer: PIXI.Renderer;

	constructor() { }

	public getComponentById(id: number): ElementType {
		return this._elements.get(id);
	}

	public insertPixiRenderer(renderer: PIXI.Renderer) {
		this._renderer = renderer;
	}

	public generateTextureForElement(id: number) {
		const comp = this._elements.get(id);
		comp.texture = comp.generateElementTexture(this._renderer, comp.symbol);
	}

	public getAllElements(): Map<number, ElementType> {
		return this._elements;
	}

}
