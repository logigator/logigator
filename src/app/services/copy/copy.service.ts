import { Injectable } from '@angular/core';
import {Element, Elements} from '../../models/element';
import {ProjectsService} from '../projects/projects.service';
import {SelectionService} from '../selection/selection.service';
import * as PIXI from 'pixi.js';

@Injectable({
	providedIn: 'root'
})
export class CopyService {

	public static staticInstance: CopyService;

	private _copiedElements: Element[] = [];

	private _copiedConPoints: PIXI.Point[];

	private _sortedElements: Element[];

	constructor(private selection: SelectionService) {
		CopyService.staticInstance = this;
	}

	public copySelection() {
		const elementIds = this.selection.selectedIds();
		this.copyIds(elementIds);
		this.copyConPoints(this.selection.selectedConnections());
	}

	public copyIds(ids: number[]): Element[] {
		return this.copyElements(ProjectsService.staticInstance.currProject.currState.getElementsById(ids));
	}
	public copyElements(elements: Element[]): Element[] {
		this._copiedElements = new Array(elements.length);
		for (let i = 0; i < elements.length; i++) {
			this._copiedElements[i] = Elements.clone(elements[i]);
		}
		return this._copiedElements;
	}

	public copyConPoints(points: PIXI.Point[]): PIXI.Point[] {
		this._copiedConPoints = new Array(points.length);
		for (let i = 0; i < points.length; i++) {
			this._copiedConPoints[i] = points[i].clone();
		}
		return this._copiedConPoints;
	}

	get copiedElements(): Element[] {
		return this.copyElements(this._copiedElements);
	}

	get copiedConPoints(): PIXI.Point[] {
		return this.copyConPoints(this._copiedConPoints);
	}

	private sortSelection(): Element[] {
		return this._copiedElements.sort((a, b) => {
			if (a.pos.x < b.pos.x || a.pos.y < b.pos.y) return -1;
			if (a.pos.x > b.pos.x || a.pos.y > b.pos.y) return 1;
			return 0;
		});
	}

	public getCopiedElementsBoundingBox(): {start: PIXI.Point, end: PIXI.Point} {
		const sorted = this.sortSelection();
		return {
			start: this._sortedElements[0].pos.clone(),
			end: this._sortedElements[this._sortedElements.length - 1].endPos.clone()
		};
	}
}
