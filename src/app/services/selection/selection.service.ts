import { Injectable } from '@angular/core';
import * as PIXI from 'pixi.js';

@Injectable({
	providedIn: 'root'
})
export class SelectionService {

	constructor() { }

	public selectFromRect(start: PIXI.Point, end: PIXI.Point): number[] {
		return [];
	}

	public selectComponent(id: number): void {

	}
}
