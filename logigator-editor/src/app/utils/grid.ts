import { environment } from '../../environments/environment';

export function fromGrid(val: number): number {
	return val * environment.gridSize;
}

export function toGrid(val: number): number {
	return val / environment.gridSize;
}

export function alignToGrid(val: number): number {
	return fromGrid(Math.round(toGrid(val)));
}
