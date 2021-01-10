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
		delete out.wireEnds;
		delete out.plugIndex;
		out.options = out.options ? [...out.options] : undefined;
		return out;
	}

	public static cloneSetOptions(element: Element, options: number[]): Element {
		const clone = Elements.clone(element);
		clone.options = options;
		const elemType = getStaticDI(ElementProviderService).getElementById(element.typeId);
		if (elemType.onOptionsChanged) {
			elemType.onOptionsChanged(clone);
			clone.endPos = Elements.calcEndPos(clone);
		}
		return clone;
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
		delete element.wireEnds;
	}

	public static genNewElement(typeId: number, _pos: PIXI.Point, _endPos?: PIXI.Point): Element {
		const type = this.elementProviderService.getElementById(typeId);
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
			// plugIndex: this.elementProviderService.isPlugElement(typeId) ? 0 : undefined
			plugIndex: undefined
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
		delete element.wireEnds;
		return new PIXI.Point(element.pos.x + elemSize.x, element.pos.y + elemSize.y);
	}

	public static calcElemSize(element: Element, numInputs?: number, numOutputs?: number, rotation?: number): PIXI.Point {
		if (element.typeId === ElementTypeId.TEXT) {
			const type = this.elementProviderService.getElementById(element.typeId);
			return new PIXI.Point(type.width(element), type.height(element));
		}
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

	public static wireEnds(element: Element): PIXI.Point[] {
		if (element.typeId === ElementTypeId.WIRE)
			return [element.pos.clone(), element.endPos.clone()];
		if (element.wireEnds)
			return element.wireEnds.map(p => p.clone());
		const out = this.wireEndsWithChanges(element, element.rotation, element.numInputs, new PIXI.Point());
		element.wireEnds = out.map(p => p.clone());
		return out;
	}

	public static wireEndsWithChanges(element: Element, rotation: number, numInputs: number, dif: PIXI.Point): PIXI.Point[] {
		const pos = new PIXI.Point(element.pos.x + dif.x, element.pos.y + dif.y);
		const endPos = new PIXI.Point(element.endPos.x + dif.x, element.endPos.y + dif.y);
		if (element.typeId === ElementTypeId.WIRE)
			return [pos, endPos];
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

	public static wireEndsIfInOtherChunk(element: Element, rotation: number, numInputs: number, dif: PIXI.Point): PIXI.Point[] {
		if ((element.pos.x + dif.x) % 16 > 0 && (element.pos.y + dif.y) % 16 > 0 && (element.endPos.x + dif.x) % 16 < 15 && (element.endPos.y + dif.y) % 16 < 15) {
			return [];
		} else {
			return Elements.wireEndsWithChanges(element, rotation, numInputs, dif);
		}
	}

	public static allWireEnds(elements: Element[], startMap?: Map<number, Set<number>>): Map<number, Set<number>> {
		const out = startMap || new Map<number, Set<number>>();
		for (const elem of elements) {
			for (const wireEnd of Elements.wireEnds(elem)) {
				if (out.has(wireEnd.x)) {
					out.get(wireEnd.x).add(wireEnd.y);
				} else {
					out.set(wireEnd.x, new Set<number>([wireEnd.y]));
				}
			}
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

	public static isHorizontalElem(elem: Element): boolean {
		return elem.typeId === ElementTypeId.WIRE ? Elements.isHorizontal(elem) : elem.rotation % 2 === 0;
	}

	public static isSameDirection(elem0: Element, elem1: Element): boolean {
		return Elements.isHorizontalElem(elem0) === Elements.isHorizontalElem(elem1);
	}

	public static elementType(typeId: number): ElementType {
		return this.elementProviderService.getElementById(typeId);
	}

	private static get elementProviderService(): ElementProviderService {
		if (!this._elementProviderService) {
			this._elementProviderService = getStaticDI(ElementProviderService);
		}
		return this._elementProviderService;
	}
}
