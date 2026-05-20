import { environment } from '../../environments/environment';
import { Point } from 'pixi.js';

export function fromGrid(val: number): number {
	return val * environment.gridSize;
}

export function roundToGrid(point: Point, inline = false): Point {
	if (inline) {
		return point.set(Math.round(point.x), Math.round(point.y));
	}
	return new Point(Math.round(point.x), Math.round(point.y));
}

export function roundToHalfGrid(point: Point, inline = false): Point {
	const r = (n: number) => Math.floor(n) + 0.5;
	if (inline) {
		return point.set(r(point.x), r(point.y));
	}
	return new Point(r(point.x), r(point.y));
}
