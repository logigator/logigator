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
import {delay} from '../../models/element-types/basic/delay';
import {clock} from '../../models/element-types/basic/clock';
import {halfAdder} from '../../models/element-types/advanced/half-adder';
import {fullAdder} from '../../models/element-types/advanced/full-adder';
import {environment} from '../../../environments/environment';
import {text} from '../../models/element-types/basic/text';

@Injectable({
	providedIn: 'root'
})
export class ElementProviderService {

	private _basicElements: Map<number, ElementType> = new Map([
		[0, wire],
		[1, not],
		[2, and],
		[3, or],
		[4, xor],
		[5, delay],
		[6, clock],
		[7, text]
	]);

	private _advancedElements: Map<number, ElementType> = new Map([
		[10, halfAdder],
		[11, fullAdder]
	]);

	private _plugElements: Map<number, ElementType> = new Map([
		[100, input],
		[101, output],
		[102, butt]
	]);

	private _ioElements: Map<number, ElementType> = new Map([
		[200, button],
		[201, lever]
	]);

	private _userDefinedElements: Map<number, ElementType> = new Map<number, ElementType>();

	constructor(private errorHandler: ErrorHandlingService) {}

	public setUserDefinedTypes(elements: Map<number, ElementType>) {
		for (const elem of elements.values()) {
			elem.width = environment.componentWidth;
		}
		this._userDefinedElements = elements;
	}

	public addUserDefinedElement(element: ElementType, id: number) {
		element.width = environment.componentWidth;
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
		} else if (this._advancedElements.has(id)) {
			return this._advancedElements.get(id);
		} else if (this._plugElements.has(id)) {
			return this._plugElements.get(id);
		} else if (this._ioElements.has(id)) {
			return this._ioElements.get(id);
		} else if (this._userDefinedElements.has(id)) {
			return this._userDefinedElements.get(id);
		}
		this.errorHandler.showErrorMessage('ERROR.PROJECTS.COMP_NOT_FOUND');
	}

	public hasElement(id: number) {
		return this._basicElements.has(id) ||
			this._advancedElements.has(id) ||
			this._plugElements.has(id) ||
			this._ioElements.has(id) ||
			this._userDefinedElements.has(id);
	}

	public isBasicElement(id: number): boolean {
		return this._basicElements.has(id);
	}

	public isAdvancedElement(id: number): boolean {
		return this._advancedElements.has(id);
	}

	public isSimpleElement(id: number): boolean {
		return this.isBasicElement(id) || this.isAdvancedElement(id);
	}

	public isDelayElement(id: number): boolean {
		return this._basicElements.has(id) && id === 5;
	}

	public isIoElement(id: number): boolean {
		return this._ioElements.has(id);
	}

	public isPlugElement(id: number): boolean {
		return this._plugElements.has(id);
	}

	public isInputElement(id: number): boolean {
		return this._plugElements.has(id) && id === 100;
	}

	public isOutputElement(id: number): boolean {
		return this._plugElements.has(id) && id === 101;
	}

	public isButtonElement(id: number): boolean {
		return this._ioElements.has(id) && id === 200;
	}

	public isLeverElement(id: number): boolean {
		return this._ioElements.has(id) && id === 201;
	}

	public isUserElement(id: number): boolean {
		return this._userDefinedElements.has(id);
	}

	public isHiddenElement(id: number): boolean {
		return id === 0 || id === 102 || id === 7;
	}

	public shouldShowSettingsBox(id: number): boolean {
		return id !== 0;
	}

	public get basicElements(): Map<number, ElementType> {
		return this._basicElements;
	}

	get advancedElements(): Map<number, ElementType> {
		return this._advancedElements;
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
