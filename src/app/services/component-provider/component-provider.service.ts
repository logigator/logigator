import { Injectable } from '@angular/core';
import {ComponentType} from '../../models/component-type';
import {wire} from '../../models/component-types/wire';
import {not} from '../../models/component-types/not';
import {and} from '../../models/component-types/and';
import {or} from '../../models/component-types/or';
import {xor} from '../../models/component-types/xor';

@Injectable({
	providedIn: 'root'
})
export class ComponentProviderService {

	private _components: Map<number, ComponentType> = new Map([
		[0, wire],
		[1, not],
		[2, and],
		[3, or],
		[4, xor],
	]);

	private _renderer: PIXI.Renderer;

	constructor() { }

	public getComponentById(id: number): ComponentType {
		return this._components.get(id);
	}

	public insertPixiRenderer(renderer: PIXI.Renderer) {
		this._renderer = renderer;
	}

	public generateTextureForComponent(id: number) {
		const comp = this._components.get(id);
		comp.texture = comp.generateComponentTexture(this._renderer, comp.symbol);
	}

	public getAllComponents(): Map<number, ComponentType> {
		return this._components;
	}

}
