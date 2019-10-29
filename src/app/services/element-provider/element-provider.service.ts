import { Injectable } from '@angular/core';
import {wire} from '../../models/element-types/basic/wire';
import {not} from '../../models/element-types/basic/not';
import {and} from '../../models/element-types/basic/and';
import {or} from '../../models/element-types/basic/or';
import {xor} from '../../models/element-types/basic/xor';
import {input} from '../../models/element-types/plug/input';
import {output} from '../../models/element-types/plug/output';
import {button} from '../../models/element-types/io/button';
import {lever} from '../../models/element-types/io/lever';
import {butt} from '../../models/element-types/plug/butt';
import {ErrorHandlingService} from '../error-handling/error-handling.service';
import {ElementType} from '../../models/element-types/element-type';

@Injectable({
	providedIn: 'root'
})
export class ElementProviderService {

	private _basicElements: Map<number, ElementType> = new Map([
		[0, wire],
		[1, not],
		[2, and],
		[3, or],
		[4, xor]
	]);

	private _plugElements: Map<number, ElementType> = new Map([
		[10, input],
		[11, output],
		[12, butt]
	]);

	private _ioElements: Map<number, ElementType> = new Map([
		[20, button],
		[21, lever]
	]);

	private _userDefinedElements: Map<number, ElementType> = new Map<number, ElementType>();

	constructor(private errorHandler: ErrorHandlingService) {}

	public setUserDefinedTypes(elements: Map<number, ElementType>) {
		this._userDefinedElements = elements;
	}

	public addUserDefinedElement(element: ElementType, id: number) {
		this._userDefinedElements.set(id, element);
	}

	public clearElementsFromFile() {
		for (const key of this.userDefinedElements.keys()) {
			if (key < 1000 && key >= 500) this.userDefinedElements.delete(key);
		}
	}

	public clearUserDefinedElements() {
		this.userDefinedElements.clear();
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
		this.errorHandler.showErrorMessage('Component not found, project might be corrupted');
	}

	public isBasicElement(id: number): boolean {
		return this._basicElements.has(id);
	}

	public isIoElement(id: number): boolean {
		return this._ioElements.has(id);
	}

	public isPlugElement(id: number): boolean {
		return this._plugElements.has(id);
	}

	public isInputElement(id: number): boolean {
		return this._plugElements.has(id) && id === 10;
	}

	public isOutputElement(id: number): boolean {
		return this._plugElements.has(id) && id === 11;
	}

	public isButtonElement(id: number): boolean {
		return this._ioElements.has(id) && id === 20;
	}

	public isLeverElement(id: number): boolean {
		return this._ioElements.has(id) && id === 21;
	}

	public isUserElement(id: number): boolean {
		return this._userDefinedElements.has(id);
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
