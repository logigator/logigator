import { Injectable } from '@angular/core';
import { Element } from '../../models/element';
import { Elements } from '../../models/elements';
import { ProjectsService } from '../projects/projects.service';
import { SelectionService } from '../selection/selection.service';
import * as PIXI from 'pixi.js';

@Injectable({
	providedIn: 'root'
})
export class CopyService {
	private _copiedElements: Element[] = [];
	private _copiedConPoints: PIXI.Point[] = [];

	constructor(
		private selection: SelectionService,
		private projects: ProjectsService
	) {}

	public copySelection() {
		const elementIds = this.selection.selectedIds();
		if (elementIds.length === 0) return;
		this.copyIds(elementIds);
		this.copyConPoints(this.selection.selectedConnections());
	}

	public copyIds(ids: number[]): Element[] {
		return this.copyElements(
			this.projects.currProject.currState.getElementsById(ids)
		);
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
		this.copyElements(this.copiedElements); // wtf i dont know why
		const bounds = new PIXI.Bounds();
		for (let i = 0; i < this._copiedElements.length; i++) {
			bounds.addPoint(this._copiedElements[i].pos);
			bounds.addPoint(this._copiedElements[i].endPos);
		}
		return bounds.getRectangle(PIXI.Rectangle.EMPTY);
	}
}
