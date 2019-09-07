import { Injectable } from '@angular/core';
import * as PIXI from 'pixi.js';
import {Project} from '../../models/project';

@Injectable({
	providedIn: 'root'
})
export class SelectionService {

	private _selectedIds: number[];

	constructor() { }

	public selectFromRect(project: Project, start: PIXI.Point, end: PIXI.Point): number[] {
		const possibleChunkCoords = Project.inRectChunks(start, end);
		for (const chunkCoord of possibleChunkCoords) {
			console.log(project.getChunks()[chunkCoord.x][chunkCoord.y].elements);
			for (const elem of project.getChunks()[chunkCoord.x][chunkCoord.y].elements) {
				if (elem.pos.x < end.x && elem.endPos.x > start.x && elem.pos.y < end.y && elem.endPos.y > start.y) {
					if (!this._selectedIds.find(id => id === elem.id))
						this._selectedIds.push(elem.id);
				}
			}
		}
		return this._selectedIds;
	}

	public selectComponent(id: number): void {
		this._selectedIds = [id];
	}

	public isSingleSelect(): boolean {
		return this._selectedIds.length === 1;
	}

	get selectedIds(): number[] {
		return this._selectedIds;
	}
}
