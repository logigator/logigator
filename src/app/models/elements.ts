import * as PIXI from 'pixi.js';
import {getStaticDI} from './get-di';
import {ElementProviderService} from '../services/element-provider/element-provider.service';
import {environment} from '../../environments/environment';
import {ActionType} from './action';
import {Element} from './element';
import {ElementType} from './element-types/element-type';
import {ElementTypeId} from './element-types/element-type-ids';

export abstract class Elements {

	private static _elementProviderService: ElementProviderService;

	public static correctPosOrder(startPos: PIXI.Point, endPos: PIXI.Point): void {
		if (startPos.x > endPos.x) {
			const startX = startPos.x;
			startPos.x = endPos.x;
			endPos.x = startX;
		}
		if (startPos.y > endPos.y) {
			const startY = startPos.y;
			startPos.y = endPos.y;
			endPos.y = startY;
		}
	}

	public static clone(element: Element): Element {
		const out = {...element};
		out.pos = element.pos.clone();
		if (element.endPos)
			out.endPos = element.endPos.clone();
		out.options = out.options ? [...out.options] : undefined;
		return out;
	}

	public static equals(elem0: Element, elem1: Element): boolean {
		for (const k in elem0) {
			if (k === 'id' || k === 'plugIndex') continue;
			if (elem0[k] && elem0[k].x !== undefined && elem0[k].y !== undefined) {
				if (!(elem0[k].x === elem1[k].x && elem0[k].y === elem1[k].y))
					return false;
			} else {
				const v0 = elem0[k] === undefined || elem0[k] === null ? undefined : elem0[k];
				const v1 = elem1[k] === undefined || elem1[k] === null ? undefined : elem1[k];
				if (v0 !== v1)
					return false;
			}
		}
		return true;
	}

	public static move(element: Element, dif: PIXI.Point): void {
		element.pos.x += dif.x;
		element.pos.y += dif.y;
		element.endPos.x += dif.x;
		element.endPos.y += dif.y;
	}

	public static genNewElement(typeId: number, _pos: PIXI.Point, _endPos?: PIXI.Point): Element {
		const type = getStaticDI(ElementProviderService).getElementById(typeId);
		const pos = _pos ? _pos.clone() : undefined;
		const endPos = _endPos ? _endPos.clone() : undefined;
		if (pos && endPos)
			Elements.correctPosOrder(pos, endPos);
		return {
			id: -1,
			typeId,
			numInputs: type.numInputs,
			numOutputs: type.numOutputs,
			pos,
			endPos,
			rotation: type.rotation,
			options: type.options ? [...type.options] : undefined,
			plugIndex: getStaticDI(ElementProviderService).isPlugElement(typeId) ? 0 : undefined
		};
	}

	public static gen2Wires(_pos: PIXI.Point, _cornerPos: PIXI.Point, _endPos: PIXI.Point): {wire0: Element, wire1: Element} {
		const wire0 = Elements.genNewElement(0, _pos, _cornerPos);
		const wire1 = Elements.genNewElement(0, _cornerPos, _endPos);
		Elements.correctPosOrder(wire0.pos, wire0.endPos);
		Elements.correctPosOrder(wire1.pos, wire1.endPos);
		return {wire0, wire1};
	}

	public static calcEndPos(element: Element, numInputs?: number, numOutputs?: number, rotation?: number): PIXI.Point {
		const elemSize = this.calcElemSize(element, numInputs, numOutputs, rotation);
		return new PIXI.Point(element.pos.x + elemSize.x, element.pos.y + elemSize.y);
	}

	public static calcElemSize(element: Element, numInputs?: number, numOutputs?: number, rotation?: number): PIXI.Point {
		const elemType = Elements.elementType(element.typeId);
		rotation = rotation === undefined || rotation == null ? element.rotation : rotation;
		const elemToCalc = {...element, ...{rotation}};
		if (numInputs !== undefined && numInputs !== null)
			elemToCalc.numInputs = numInputs;
		if (numOutputs !== undefined && numOutputs !== null)
			elemToCalc.numOutputs = numOutputs;
		if (rotation % 2 === 0) {
			return new PIXI.Point(elemType.width(elemToCalc), elemType.height(elemToCalc));
		} else {
			return new PIXI.Point(elemType.height(elemToCalc), elemType.width(elemToCalc));
		}
	}

	public static calcPixelElementSize(element: Element): PIXI.Point {
		const gridSize = Elements.calcElemSize(element);
		return new PIXI.Point(gridSize.x * environment.gridPixelWidth, gridSize.y * environment.gridPixelWidth);
	}

	public static otherWirePos(wire: Element, pos: PIXI.Point): PIXI.Point {
		return wire.pos.equals(pos) ? wire.endPos : wire.pos;
	}

	public static addActionName(elem: Element): ActionType {
		return elem.typeId === ElementTypeId.WIRE ? 'addWire' : 'addComp';
	}

	public static remActionName(elem: Element): ActionType {
		return elem.typeId === ElementTypeId.WIRE ? 'remWire' : 'remComp';
	}

	public static mergeCheckedWiresVertical(wire0: Element, wire1: Element, newElem) {
		const start = Math.min(wire0.pos.y, wire0.endPos.y, wire1.pos.y, wire1.endPos.y);
		const end = Math.max(wire0.pos.y, wire0.endPos.y, wire1.pos.y, wire1.endPos.y);
		newElem.pos = new PIXI.Point(wire0.pos.x, start);
		newElem.endPos = new PIXI.Point(wire0.pos.x, end);
	}

	public static mergeCheckedWiresHorizontal(wire0: Element, wire1: Element, newElem) {
		const start = Math.min(wire0.pos.x, wire0.endPos.x, wire1.pos.x, wire1.endPos.x);
		const end = Math.max(wire0.pos.x, wire0.endPos.x, wire1.pos.x, wire1.endPos.x);
		newElem.pos = new PIXI.Point(start, wire0.pos.y);
		newElem.endPos = new PIXI.Point(end, wire0.pos.y);
	}

	public static wireEnds(element: Element, rotation?: number, numInputs?: number, dif?: PIXI.Point): PIXI.Point[] {
		const pos = dif ? new PIXI.Point(element.pos.x + dif.x, element.pos.y + dif.y) : element.pos;
		const endPos = dif ? new PIXI.Point(element.endPos.x + dif.x, element.endPos.y + dif.y) : element.endPos;
		if (element.typeId === ElementTypeId.WIRE)
			return [pos, endPos];
		if (rotation === undefined)
			rotation = element.rotation;
		if (numInputs === undefined)
			numInputs = element.numInputs;
		const ignoreOutputs = Elements.elementType(element.typeId).ignoreOutputs;
		const out: PIXI.Point[] = new Array(numInputs + (ignoreOutputs ? 0 : element.numOutputs));
		switch (rotation) {
			case 0:
				for (let i = 0; i < numInputs; i++)
					out[i] = new PIXI.Point(pos.x - 1, pos.y + i);
				if (ignoreOutputs)
					break;
				for (let i = 0; i < element.numOutputs; i++)
					out[numInputs + i] = new PIXI.Point(endPos.x, pos.y + i);
				break;
			case 1:
				for (let i = 0; i < numInputs; i++)
					out[i] = new PIXI.Point(endPos.x - 1 - i, pos.y - 1);
				if (ignoreOutputs)
					break;
				for (let i = 0; i < element.numOutputs; i++)
					out[numInputs + i] = new PIXI.Point(endPos.x - 1 - i, endPos.y);
				break;
			case 2:
				for (let i = 0; i < numInputs; i++)
					out[i] = new PIXI.Point(endPos.x, endPos.y - 1 - i);
				if (ignoreOutputs)
					break;
				for (let i = 0; i < element.numOutputs; i++)
					out[numInputs + i] = new PIXI.Point(pos.x - 1, endPos.y - 1 - i);
				break;
			case 3:
				for (let i = 0; i < numInputs; i++)
					out[i] = new PIXI.Point(pos.x + i, endPos.y);
				if (ignoreOutputs)
					break;
				for (let i = 0; i < element.numOutputs; i++)
					out[numInputs + i] = new PIXI.Point(pos.x + i, pos.y - 1);
				break;
		}
		return out;
	}

	public static isInput(element: Element, pos: PIXI.Point): boolean {
		switch (element.rotation) {
			case 0:
				return pos.x < element.pos.x;
			case 1:
				return pos.y < element.pos.y;
			case 2:
				return pos.x >= element.endPos.x;
			case 3:
				return pos.y >= element.endPos.y;
		}
	}

	public static removeDuplicates(elements: Element[]): void {
		for (let i = 0; i < elements.length - 1; i++) {
			for (let j = i + 1; j < elements.length; j++) {
				if (elements[i].id === elements[j].id) {
					elements.splice(j, 1);
				}
			}
		}
	}

	public static wireEndIndex(element: Element, pos: PIXI.Point): number {
		const wireEnds = this.wireEnds(element);
		for (let i = 0; i < wireEnds.length; i++) {
			if (wireEnds[i].equals(pos)) {
				return i;
			}
		}
		return -1;
	}

	public static isHorizontal(wire: Element): boolean {
		return wire.pos.y === wire.endPos.y;
	}

	public static isVertical(wire: Element): boolean {
		return wire.pos.x === wire.endPos.x;
	}

	public static isSameDirection(elem0: Element, elem1: Element): boolean {
		const comp = elem0.typeId === 0 ? elem1 : elem0;
		const wire = elem0.typeId === 0 ? elem0 : elem1;
		// comp still might be a wire, because it is not tested that well
		if (comp.typeId === 0)
			return false;
		if (comp.rotation % 2 === 0)
			return Elements.isHorizontal(wire);
		else
			return Elements.isVertical(wire);
	}

	public static elementType(typeId: number): ElementType {
		if (this._elementProviderService) {
			return this._elementProviderService.getElementById(typeId);
		} else {
			this._elementProviderService = getStaticDI(ElementProviderService);
			return this._elementProviderService.getElementById(typeId);
		}
	}
}
