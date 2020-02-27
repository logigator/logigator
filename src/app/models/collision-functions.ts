import {Element} from './element';
import * as PIXI from 'pixi.js';
import {environment} from '../../environments/environment';
import {Elements} from './elements';
import {ElementTypeId} from './element-types/element-type-ids';

export abstract class CollisionFunctions {

	public static doWiresOverlap(wire0: Element, wire1: Element): boolean {
		return CollisionFunctions.isPointOnWire(wire0, wire1.pos) ||
			CollisionFunctions.isPointOnWire(wire0, wire1.endPos) ||
			CollisionFunctions.isPointOnWire(wire1, wire0.pos) ||
			CollisionFunctions.isPointOnWire(wire1, wire0.endPos);
	}

	public static isPointOnWire(wire: Element, point: PIXI.Point): boolean {
		return point.y === wire.pos.y && point.y === wire.endPos.y &&
			(point.x >= wire.pos.x && point.x <= wire.endPos.x || point.x <= wire.pos.x && point.x >= wire.endPos.x)
			||
			point.x === wire.pos.x && point.x === wire.endPos.x &&
			(point.y >= wire.pos.y && point.y <= wire.endPos.y || point.y <= wire.pos.y && point.y >= wire.endPos.y);
	}

	public static isPointOnWireNoEdge(wire: Element, point: PIXI.Point): boolean {
		return point.y === wire.pos.y && point.y === wire.endPos.y &&
			(point.x > wire.pos.x && point.x < wire.endPos.x || point.x < wire.pos.x && point.x > wire.endPos.x)
			||
			point.x === wire.pos.x && point.x === wire.endPos.x &&
			(point.y > wire.pos.y && point.y < wire.endPos.y || point.y < wire.pos.y && point.y > wire.endPos.y);
	}

	public static elemHasWirePoint(elem: Element, pos: PIXI.Point): boolean {
		for (const endPoint of Elements.wireEnds(elem)) {
			if (pos.equals(endPoint))
				return true;
		}
		return false;
	}

	public static wirePointIndex(elem: Element, pos: PIXI.Point): number {
		let index = 0;
		for (const endPoint of Elements.wireEnds(elem)) {
			if (pos.equals(endPoint))
				return index;
			index++;
		}
		return -1;
	}

	public static inRectChunks(_startPos: PIXI.Point, _endPos: PIXI.Point, wireEnds?: PIXI.Point[]): {x: number, y: number}[] {
		const startPos = _startPos.clone();
		const endPos = _endPos.clone();
		Elements.correctPosOrder(startPos, endPos);
		const out: {x: number, y: number}[] = [];
		const startChunk = CollisionFunctions.gridPosToChunk(startPos);
		const endChunk = CollisionFunctions.gridPosToChunk(endPos);
		for (let x = startChunk.x; x <= endChunk.x; x++)
			for (let y = startChunk.y; y <= endChunk.y; y++)
				out.push({x, y});
		if (wireEnds) {
			wireEnds.forEach(wireEnd => {
				const chunk = CollisionFunctions.gridPosToChunk(wireEnd);
				if (!out.find(c => c.x === chunk.x && c.y === chunk.y))
					out.push({x: chunk.x, y: chunk.y});
			});
		}
		return out;
	}

	public static isRectOnRect(startPos0: PIXI.Point, endPos0: PIXI.Point, startPos1: PIXI.Point, endPos1: PIXI.Point): boolean {
		return startPos0.x <= endPos1.x && startPos0.y <= endPos1.y &&
			endPos0.x >= startPos1.x && endPos0.y >= startPos1.y;
	}

	public static isRectFullyInRect(startPos0: PIXI.Point, endPos0: PIXI.Point, startPos1: PIXI.Point, endPos1: PIXI.Point): boolean {
		return startPos0.x >= startPos1.x && startPos0.y >= startPos1.y &&
			endPos0.x <= endPos1.x && endPos0.y <= endPos1.y;
	}

	public static isRectInRectLightBorder(startPos0: PIXI.Point, endPos0: PIXI.Point, startPos1: PIXI.Point, endPos1: PIXI.Point): boolean {
		return startPos0.x <= endPos1.x && startPos0.y <= endPos1.y &&
			endPos0.x > startPos1.x && endPos0.y > startPos1.y;
	}

	public static isElementInFloatRect(element: Element, startPos: PIXI.Point, endPos: PIXI.Point): boolean {
		if (element.typeId !== ElementTypeId.WIRE && element.typeId !== ElementTypeId.TEXT) {
			return CollisionFunctions.isRectInRectLightBorder(element.pos, element.endPos, startPos, endPos);
		} else {
			return element.pos.x + 0.5 <= endPos.x && element.pos.y + 0.5 <= endPos.y &&
				element.endPos.x + 0.5 > startPos.x && element.endPos.y + 0.5 > startPos.y;
		}
	}

	public static rectCuttingPoints(element: Element, startPos: PIXI.Point, endPos: PIXI.Point): PIXI.Point[] {
		if (Elements.isHorizontal(element)) {
			if (!(element.pos.y > startPos.y - 0.5 && element.pos.y < endPos.y - 0.5))
				return undefined;
			return [
				new PIXI.Point(Math.floor(startPos.x - 0.5), element.pos.y),
				new PIXI.Point(Math.ceil(endPos.x - 0.5), element.pos.y)
			];
		} else {
			if (!(element.pos.x > startPos.x - 0.5 && element.pos.x < endPos.x - 0.5))
				return undefined;
			return [
				new PIXI.Point(element.pos.x, Math.floor(startPos.y - 0.5)),
				new PIXI.Point(element.pos.x, Math.ceil(endPos.y - 0.5))
			];
		}
	}

	public static numWireEndInRect(element: Element, startPos: PIXI.Point, endPos: PIXI.Point): number {
		return (CollisionFunctions.isWireEndInRect(element.pos, startPos, endPos) ? 0 : 1) +
			(CollisionFunctions.isWireEndInRect(element.endPos, startPos, endPos) ? 0 : 1);

	}

	public static isRectInRectNoBorder(startPos0: PIXI.Point, endPos0: PIXI.Point, startPos1: PIXI.Point, endPos1: PIXI.Point): boolean {
		return startPos0.x < endPos1.x && startPos0.y < endPos1.y &&
			endPos0.x > startPos1.x && endPos0.y > startPos1.y;
	}

	public static isPointInRect(pos: PIXI.Point, startPos: PIXI.Point, endPos: PIXI.Point): boolean {
		return pos.x >= startPos.x && pos.x < endPos.x && pos.y >= startPos.y && pos.y < endPos.y;
	}

	public static isWireEndInRect(pos: PIXI.Point, startPos: PIXI.Point, endPos: PIXI.Point): boolean {
		return pos.x + 0.5 >= startPos.x && pos.x + 0.5 < endPos.x && pos.y + 0.5 >= startPos.y && pos.y + 0.5 < endPos.y;
	}

	public static gridPosToChunk(pos: PIXI.Point): PIXI.Point {
		return new PIXI.Point(Math.floor(pos.x / environment.chunkSize), Math.floor(pos.y / environment.chunkSize));
	}

	public static chunkToPoints(c: PIXI.Point): {start: PIXI.Point, end: PIXI.Point} {
		return {
			start: new PIXI.Point(c.x * environment.chunkSize, c.y * environment.chunkSize),
			end: new PIXI.Point((c.x + 1) * environment.chunkSize, (c.y + 1) * environment.chunkSize)
		};
	}

	public static distance(p1: PIXI.Point, p2: PIXI.Point): number {
		return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
	}

	public static lineOverElem(element: Element, from: PIXI.Point, to: PIXI.Point): boolean {
		return element.typeId === ElementTypeId.WIRE
			? CollisionFunctions.lineCollide(element.pos.x + 0.5, element.pos.y + 0.5,
				element.endPos.x + 0.5, element.endPos.y + 0.5, from.x, from.y, to.x, to.y)
			: CollisionFunctions.lineOverRect(element.pos, element.endPos, from, to);
	}

	// don't blame me
	public static lineOverRect(r1: PIXI.Point, r2: PIXI.Point, l1: PIXI.Point, l2: PIXI.Point): boolean {
		return CollisionFunctions.lineCollide(r1.x, r1.y, r2.x, r1.y, l1.x, l1.y, l2.x, l2.y) ||
		CollisionFunctions.lineCollide(r2.x, r1.y, r2.x, r2.y, l1.x, l1.y, l2.x, l2.y) ||
		CollisionFunctions.lineCollide(r2.x, r2.y, r1.x, r2.y, l1.x, l1.y, l2.x, l2.y) ||
		CollisionFunctions.lineCollide(r1.x, r2.y, r1.x, r1.y, l1.x, l1.y, l2.x, l2.y);
	}

	public static lineCollidePoint(p1: PIXI.Point, p2: PIXI.Point, p3: PIXI.Point, p4: PIXI.Point): boolean {
		const uA = ((p4.x-p3.x)*(p1.y-p3.y) - (p4.y-p3.y)*(p1.x-p3.x)) /
			((p4.y-p3.y)*(p2.x-p1.x) - (p4.x-p3.x)*(p2.y-p1.y));
		const uB = ((p2.x-p1.x)*(p1.y-p3.y) - (p2.y-p1.y)*(p1.x-p3.x)) /
			((p4.y-p3.y)*(p2.x-p1.x) - (p4.x-p3.x)*(p2.y-p1.y));

		return uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1;
	}

	public static lineCollide(x1, y1, x2, y2, x3, y3, x4, y4): boolean {
		// calculate the direction of the lines
		const uA = ((x4-x3)*(y1-y3) - (y4-y3)*(x1-x3)) / ((y4-y3)*(x2-x1) - (x4-x3)*(y2-y1));
		const uB = ((x2-x1)*(y1-y3) - (y2-y1)*(x1-x3)) / ((y4-y3)*(x2-x1) - (x4-x3)*(y2-y1));

		return uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1;
		// if uA and uB are between 0-1, lines are colliding
		// if (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1) {
		// optionally, draw a circle where the lines meet
		// const intersectionX = p1.x + (uA * (p2.x-p1.x));
		// const intersectionY = p1.y + (uA * (p2.y-p1.y));

		// return true;
		// }
		// return false;
	}
}
