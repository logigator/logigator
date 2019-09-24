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
	private _copiedConPoints: PIXI.Point[] = [];

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

	public getCopiedElementsBoundingBox(): PIXI.Rectangle {
		const bounds = new PIXI.Bounds();
		for (let i = 0; i < this._copiedElements.length; i++) {
			bounds.addPoint(this._copiedElements[i].pos);
			bounds.addPoint(this.copiedElements[i].endPos);
		}
		return bounds.getRectangle(PIXI.Rectangle.EMPTY);
	}
}
