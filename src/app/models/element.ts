import * as PIXI from 'pixi.js';
import {CollisionFunctions} from './collision-functions';
import {environment} from '../../environments/environment';
import {ElementProviderService} from '../services/element-provider/element-provider.service';

export interface Element {
	id: number;
	typeId: number;
	numInputs: number;
	numOutputs: number;

	pos: PIXI.Point;
	endPos: PIXI.Point;
	rotation?: number;
}

export class Elements {

	public static clone(element: Element): Element {
		const out = {...element};
		out.pos = element.pos.clone();
		out.endPos = element.endPos.clone();
		return out;
	}

	public static move(element: Element, dif: PIXI.Point): void {
		element.pos.x += dif.x;
		element.pos.y += dif.y;
		element.endPos.x += dif.x;
		element.endPos.y += dif.y;
	}

	public static genNewElement(typeId: number, _pos: PIXI.Point, _endPos: PIXI.Point): Element {
		const type = ElementProviderService.staticInstance.getElementById(typeId);
		const pos = _pos ? _pos.clone() : undefined;
		const endPos = _endPos ? _endPos.clone() : undefined;
		if (pos && endPos)
			CollisionFunctions.correctPosOrder(pos, endPos);
		return {
			id: -1,
			typeId,
			numInputs: type.numInputs,
			numOutputs: type.numOutputs,
			pos,
			endPos,
			rotation: type.rotation
		};
	}

	public static gen2Wires(_pos: PIXI.Point, _cornerPos: PIXI.Point, _endPos: PIXI.Point): {wire0: Element, wire1: Element} {
		const wire0 = Elements.genNewElement(0, _pos, _cornerPos);
		const wire1 = Elements.genNewElement(0, _cornerPos, _endPos);
		CollisionFunctions.correctPosOrder(wire0.pos, wire0.endPos);
		CollisionFunctions.correctPosOrder(wire1.pos, wire1.endPos);
		return {wire0, wire1};
	}

	public static calcEndPos(pos: PIXI.Point, numInputs: number, numOutputs: number, rotation?: number): PIXI.Point {
		if (rotation === undefined) rotation = 0;
		if (rotation % 2 === 0) {
			return new PIXI.Point(pos.x + environment.componentWidth,
				pos.y + Math.max(numInputs, numOutputs));
		} else {
			return new PIXI.Point(pos.x + Math.max(numInputs, numOutputs),
				pos.y + environment.componentWidth);
		}
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
		if (element.id === 0)
			return [element.pos, element.endPos];
		const out: PIXI.Point[] = [];
		if (element.rotation === 0) {
			for (let i = 0; i < element.numInputs; i++)
				out.push(new PIXI.Point(element.pos.x - 1, element.pos.y + i));
			for (let i = 0; i < element.numOutputs; i++)
				out.push(new PIXI.Point(element.endPos.x, element.pos.y + i));
		}
		if (element.rotation === 1) {
			for (let i = 0; i < element.numInputs; i++)
				out.push(new PIXI.Point(element.endPos.x - 1 - i, element.pos.y - 1));
			for (let i = 0; i < element.numOutputs; i++)
				out.push(new PIXI.Point(element.endPos.x - 1 - i, element.endPos.y));
		}
		if (element.rotation === 2) {
			for (let i = 0; i < element.numInputs; i++)
				out.push(new PIXI.Point(element.endPos.x, element.endPos.y - 1 - i));
			for (let i = 0; i < element.numOutputs; i++)
				out.push(new PIXI.Point(element.pos.x - 1, element.endPos.y - 1 - i));
		}
		if (element.rotation === 3) {
			for (let i = 0; i < element.numInputs; i++)
				out.push(new PIXI.Point(element.pos.x + i, element.endPos.y));
			for (let i = 0; i < element.numOutputs; i++)
				out.push(new PIXI.Point(element.pos.x + i, element.pos.y - 1));
		}
		return out;
	}
}
