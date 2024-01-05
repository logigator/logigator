import { Point } from 'pixi.js';
import { environment } from '../../environments/environment';

export function fromGrid(val: number): number {
	return val * environment.gridPixelWidth;
}

export function fromGridPoint(point: Point): Point {
	return new Point(
		fromGrid(point.x),
		fromGrid(point.y)
	);
}

export function toGrid(val: number): number {
	return val / environment.gridPixelWidth;
}

export function toGridPoint(point: Point): Point {
	return new Point(
		toGrid(point.x),
		toGrid(point.y)
	);
}
