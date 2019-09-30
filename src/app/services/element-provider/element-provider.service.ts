import { Injectable } from '@angular/core';
import {ElementType} from '../../models/element-type';
import {wire} from '../../models/element-types/basic/wire';
import {not} from '../../models/element-types/basic/not';
import {and} from '../../models/element-types/basic/and';
import {or} from '../../models/element-types/basic/or';
import {xor} from '../../models/element-types/basic/xor';
import {input} from '../../models/element-types/plug/input';
import {output} from '../../models/element-types/plug/output';
import {button} from '../../models/element-types/io/button';
import {lever} from '../../models/element-types/io/lever';

@Injectable({
	providedIn: 'root'
})
export class ElementProviderService {

	public static staticInstance: ElementProviderService;

	private _basicElements: Map<number, ElementType> = new Map([
		[0, wire],
		[1, not],
		[2, and],
		[3, or],
		[4, xor]
	]);

	private _plugElements: Map<number, ElementType> = new Map([
		[10, input],
		[11, output]
	]);

	private _ioElements: Map<number, ElementType> = new Map([
		[20, button],
		[21, lever]
	]);

	private _userDefinedElements: Map<number, ElementType> = new Map<number, ElementType>();

	constructor() {
		ElementProviderService.staticInstance = this;
	}

	public setUserDefinedTypes(elements: Map<number, ElementType>) {
		this._userDefinedElements = elements;
	}

	public getElementById(id: number): ElementType {
		if (this._basicElements.has(id)) {
			return this._basicElements.get(id);
		} else if (this._plugElements.has(id)) {
			return this._plugElements.get(id);
		} else if (this._ioElements.has(id)) {
			return this._ioElements.get(id);
		} else if (this._userDefinedElements.has(id)) {
			return this._userDefinedElements.get(id);
		}
		throw Error('Component not found. Project might be corrupted');
	}

	public get basicElements(): Map<number, ElementType> {
		return this._basicElements;
	}

	public get plugElements(): Map<number, ElementType> {
		return this._plugElements;
	}

	public get ioElements(): Map<number, ElementType> {
		return this._ioElements;
	}

	public get userDefinedElements(): Map<number, ElementType> {
		return this._userDefinedElements;
	}
}
