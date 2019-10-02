import { Injectable } from '@angular/core';
import {ElementType} from '../../models/element-type';
import {wire} from '../../models/element-types/wire';
import {not} from '../../models/element-types/not';
import {and} from '../../models/element-types/and';
import {or} from '../../models/element-types/or';
import {xor} from '../../models/element-types/xor';
import {ErrorHandlingService} from '../error-handling/error-handling.service';

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
		[4, xor],
	]);

	private _ioElements: Map<number, ElementType> = new Map<number, ElementType>();

	private _userDefinedElements: Map<number, ElementType> = new Map<number, ElementType>();

	constructor(private errorHandler: ErrorHandlingService) {
		ElementProviderService.staticInstance = this;
	}

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

	public getElementById(id: number): ElementType {
		if (this._basicElements.has(id)) {
			return this._basicElements.get(id);
		} else if (this._ioElements.has(id)) {
			return this._ioElements.get(id);
		} else if (this._userDefinedElements.has(id)) {
			return this._userDefinedElements.get(id);
		}
		this.errorHandler.showErrorMessage('Component not found, project might be corrupted');
	}

	public get basicElements(): Map<number, ElementType> {
		return this._basicElements;
	}

	public get ioElements(): Map<number, ElementType> {
		return this._ioElements;
	}

	public get userDefinedElements(): Map<number, ElementType> {
		return this._userDefinedElements;
	}

}
