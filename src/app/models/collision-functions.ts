import {Element, Elements} from './element';
import * as PIXI from 'pixi.js';
import {Project} from './project';
import {environment} from '../../environments/environment';

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

	public static isHorizontal(wire: Element): boolean {
		return wire.pos.y === wire.endPos.y;
	}

	public static isVertical(wire: Element): boolean {
		return wire.pos.x === wire.endPos.x;
	}

	public static inRectChunks(_startPos: PIXI.Point, _endPos: PIXI.Point, wireEnds?: PIXI.Point[]): {x: number, y: number}[] {
		const startPos = _startPos.clone();
		const endPos = _endPos.clone();
		Elements.correctPosOrder(startPos, endPos);
		const out: {x: number, y: number}[] = [];
		const startChunkX = CollisionFunctions.gridPosToChunk(startPos.x);
		const startChunkY = CollisionFunctions.gridPosToChunk(startPos.y);
		const endChunkX = CollisionFunctions.gridPosToChunk(endPos.x);
		const endChunkY = CollisionFunctions.gridPosToChunk(endPos.y);
		for (let x = startChunkX; x <= endChunkX; x++)
			for (let y = startChunkY; y <= endChunkY; y++)
				out.push({x, y});
		if (wireEnds) {
			wireEnds.forEach(wireEnd => {
				const chunkX = CollisionFunctions.gridPosToChunk(wireEnd.x);
				const chunkY = CollisionFunctions.gridPosToChunk(wireEnd.y);
				if (!out.find(c => c.x === chunkX && c.y === chunkY))
					out.push({x: chunkX, y: chunkY});
			});
		}
		return out;
	}

	public static isRectOnRect(startPos0: PIXI.Point, endPos0: PIXI.Point, startPos1: PIXI.Point, endPos1: PIXI.Point): boolean {
		return startPos0.x <= endPos1.x && startPos0.y <= endPos1.y &&
			endPos0.x >= startPos1.x && endPos0.y >= startPos1.y;
	}

	public static isRectInRectLightBorder(startPos0: PIXI.Point, endPos0: PIXI.Point, startPos1: PIXI.Point, endPos1: PIXI.Point): boolean {
		return startPos0.x <= endPos1.x && startPos0.y <= endPos1.y &&
			endPos0.x > startPos1.x && endPos0.y > startPos1.y;
	}

	public static isElementInFloatRect(element: Element, startPos: PIXI.Point, endPos: PIXI.Point): boolean {
		if (element.typeId !== 0) {
			return CollisionFunctions.isRectInRectLightBorder(element.pos, element.endPos, startPos, endPos);
		} else {
			return element.pos.x + 0.5 <= endPos.x && element.pos.y + 0.5 <= endPos.y &&
				element.endPos.x + 0.5 > startPos.x && element.endPos.y + 0.5 > startPos.y;
		}
	}

	public static isRectInRectNoBorder(startPos0: PIXI.Point, endPos0: PIXI.Point, startPos1: PIXI.Point, endPos1: PIXI.Point): boolean {
		return startPos0.x < endPos1.x && startPos0.y < endPos1.y &&
			endPos0.x > startPos1.x && endPos0.y > startPos1.y;
	}

	public static isPointInRect(pos: PIXI.Point, startPos: PIXI.Point, endPos: PIXI.Point): boolean {
		return pos.x >= startPos.x && pos.x < endPos.x && pos.y >= startPos.y && pos.y < endPos.y;
	}

	public static gridPosToChunk(pos: number): number {
		return Math.floor(pos / environment.chunkSize);
	}

	public static distance(p1: PIXI.Point, p2: PIXI.Point): number {
		return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
	}
}
