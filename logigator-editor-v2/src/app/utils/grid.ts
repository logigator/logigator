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

export function alignToGrid(val: number): number {
	return fromGrid(toGrid(val));
}

export function alignToHalfGrid(val: number): number {
	return fromGrid(toHalfGrid(val));
}

export function fromGridPoint(point: Point, inline: boolean = false): Point {
	if (inline) {
		return point.set(fromGrid(point.x), fromGrid(point.y));
	}
	return new Point(fromGrid(point.x), fromGrid(point.y));
}

export function toGridPoint(point: Point, inline: boolean = false): Point {
	if (inline) {
		return point.set(toGrid(point.x), toGrid(point.y));
	}
	return new Point(toGrid(point.x), toGrid(point.y));
}

export function alignPointToGrid(point: Point, inline: boolean = false): Point {
	return fromGridPoint(toGridPoint(point, inline), true);
}

export function alignPointToHalfGrid(
	point: Point,
	inline: boolean = false
): Point {
	return fromGridPoint(toGridPoint(point, inline), true);
}
