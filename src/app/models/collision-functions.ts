import {Element} from './element';
import * as PIXI from 'pixi.js';
import {Project} from './project';
import {environment} from '../../environments/environment';

export abstract class CollisionFunctions {

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

	public static isHorizontal(wire: Element): boolean {
		return wire.pos.y === wire.endPos.y;
	}

	public static isVertical(wire: Element): boolean {
		return wire.pos.x === wire.endPos.x;
	}

	public static inRectChunks(_startPos: PIXI.Point, _endPos: PIXI.Point): {x: number, y: number}[] {
		const startPos = _startPos.clone();
		const endPos = _endPos.clone();
		CollisionFunctions.correctPosOrder(startPos, endPos);
		const out: {x: number, y: number}[] = [];
		const startChunkX = CollisionFunctions.gridPosToChunk(startPos.x);
		const startChunkY = CollisionFunctions.gridPosToChunk(startPos.y);
		const endChunkX = CollisionFunctions.gridPosToChunk(endPos.x);
		const endChunkY = CollisionFunctions.gridPosToChunk(endPos.y);
		for (let x = startChunkX; x <= endChunkX; x++)
			for (let y = startChunkY; y <= endChunkY; y++)
				// if ((x < endChunkX || endPos.x % environment.chunkSize !== 0) && (y < endChunkY || endPos.y % environment.chunkSize !== 0))
				out.push({x, y});
		return out;
	}

	public static isRectInRect(startPos0: PIXI.Point, endPos0: PIXI.Point, startPos1: PIXI.Point, endPos1: PIXI.Point): boolean {
		return startPos0.x <= endPos1.x && startPos0.y <= endPos1.y &&
			endPos0.x >= startPos1.x && endPos0.y >= startPos1.y;
	}

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

	public static gridPosToChunk(pos: number): number {
		return Math.floor(pos / environment.chunkSize);
	}
}
