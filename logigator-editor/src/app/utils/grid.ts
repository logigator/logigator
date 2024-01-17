import { environment } from '../../environments/environment';
import { Point } from 'pixi.js';

export function fromGrid(val: number): number {
	return val * environment.gridSize;
}

export function toGrid(val: number): number {
	return Math.round(val / environment.gridSize);
}

export function toHalfGrid(val: number): number {
	return Math.round(val / environment.gridSize + 0.5) - 0.5;
}

export function fromGridPoint(point: Point): Point {
	return new Point(fromGrid(point.x), fromGrid(point.y));
}

export function toGridPoint(point: Point): Point {
	return new Point(toGrid(point.x), toGrid(point.y));
}

export function alignToGrid(val: number): number {
	return fromGrid(toGrid(val));
}

export function alignPointToGrid(point: Point): Point {
	return fromGridPoint(toGridPoint(point));
}
