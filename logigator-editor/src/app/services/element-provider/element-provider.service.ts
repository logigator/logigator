import {Injectable} from '@angular/core';
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
import {text} from '../../models/element-types/basic/text';
import {ElementTypeId} from '../../models/element-types/element-type-ids';
import {udcTemplate} from '../../models/element-types/udc-template';
import {rom} from '../../models/element-types/advanced/rom';
import {dFF} from '../../models/element-types/advanced/d-ff';
import {jkFF} from '../../models/element-types/advanced/jk-ff';
import {srFF} from '../../models/element-types/advanced/sr-ff';
import {led} from '../../models/element-types/io/led';
import {segmentDisplay} from '../../models/element-types/io/segment-display';
import {ledMatrix} from '../../models/element-types/io/led-matrix';
import {tunnel} from '../../models/element-types/basic/tunnel';
import {rng} from '../../models/element-types/advanced/rng';
import {ram} from '../../models/element-types/advanced/ram';
import {decoder} from '../../models/element-types/advanced/decoder';

@Injectable({
	providedIn: 'root'
})
export class ElementProviderService {

	private _elements: Map<number, ElementType> = new Map([
		// basic
		[wire.id, wire],
		[not.id, not],
		[and.id, and],
		[or.id, or],
		[xor.id, xor],
		[delay.id, delay],
		[clock.id, clock],
		[text.id, text],
		[tunnel.id, tunnel],

		// advanced
		[halfAdder.id, halfAdder],
		[fullAdder.id, fullAdder],
		[rom.id, rom],
		[dFF.id, dFF],
		[jkFF.id, jkFF],
		[srFF.id, srFF],
		[rng.id, rng],
		[ram.id, ram],
		[decoder.id, decoder],

		// plug
		[input.id, input],
		[output.id, output],
		[butt.id, butt],

		// io
		[button.id, button],
		[lever.id, lever],
		[led.id, led],
		[segmentDisplay.id, segmentDisplay],
		[ledMatrix.id, ledMatrix]
	]);

	constructor(private errorHandler: ErrorHandlingService) {}

	public static isCompileElement(id: number): boolean {
		return !(id === ElementTypeId.WIRE || id === ElementTypeId.BUTT || id === ElementTypeId.TEXT || id === ElementTypeId.TUNNEL);
	}

	public addElements(elements: Partial<ElementType>[], category: 'user' | 'local' | 'share') {
		for (const elem of elements) {
			this._elements.set(elem.id, {...udcTemplate, ...elem, category} as ElementType);
		}
	}

	public removeElement(id: number) {
		this._elements.delete(id);
	}

	public getElementById(id: number): ElementType {
		if (this._elements.has(id)) {
			return this._elements.get(id);
		}
		this.errorHandler.showErrorMessage('ERROR.PROJECTS.COMP_NOT_FOUND');
	}

	public hasElement(id: number) {
		return this._elements.has(id);
	}

	public isIoElement(id: number): boolean {
		return this._elements.has(id) && this._elements.get(id).category === 'io';
	}

	public isPlugElement(id: number): boolean {
		return this._elements.has(id) && this._elements.get(id).category === 'plug';
	}

	public isUserElement(id: number): boolean {
		return this._elements.has(id) && this._elements.get(id).category === 'user';
	}

	public isShareElement(id: number): boolean {
		return this._elements.has(id) && this._elements.get(id).category === 'share';
	}

	public isLocalElement(id: number): boolean {
		return this._elements.has(id) && this._elements.get(id).category === 'local';
	}

	public isCustomElement(id: number): boolean {
		if (!this._elements.has(id))
			return false;

		const category = this._elements.get(id).category;
		return category === 'user' || category === 'share' || category === 'local';
	}

	public canInspectWithPopup(id: number): boolean {
		return this._elements.has(id) && !!this._elements.get(id).elementInspectionComp;
	}

	public getElements(category: 'basic' | 'advanced' | 'plug' | 'io' | 'user' | 'local' | 'share'): ElementType[] {
		return [...this._elements.values()].filter(e => e.category === category);
	}

	public get basicElements(): ElementType[] {
		return this.getElements('basic');
	}

	public get advancedElements(): ElementType[] {
		return this.getElements('advanced');
	}

	public get plugElements(): ElementType[] {
		return this.getElements('plug');
	}

	public get ioElements(): ElementType[] {
		return this.getElements('io');
	}

	public get userDefinedElements(): ElementType[] {
		return this.getElements('user');
	}

	public get shareElements(): ElementType[] {
		return this.getElements('share');
	}

	public get localElements(): ElementType[] {
		return this.getElements('local');
	}
}
