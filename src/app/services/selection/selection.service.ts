import { Injectable } from '@angular/core';
import * as PIXI from 'pixi.js';
import {Project} from '../../models/project';
import {ProjectsService} from '../projects/projects.service';
import {CollisionFunctions} from '../../models/collision-functions';

@Injectable({
	providedIn: 'root'
})
export class SelectionService {

	public static staticInstance: SelectionService;

	private _selectedIds: Map<number, number[]> = new Map<number, number[]>();

	constructor(private projectsService: ProjectsService) {
		SelectionService.staticInstance = this;
	}

	public selectFromRect(project: Project, start: PIXI.Point, end: PIXI.Point): number[] {
		CollisionFunctions.correctPosOrder(start, end);
		this._selectedIds.set(project.id, []);
		const ids = this._selectedIds.get(project.id);
		const possibleChunkCoords = CollisionFunctions.inRectChunks(start, end);
		for (const chunk of project.currState.chunksFromCoords(possibleChunkCoords)) {
			for (const elem of chunk.elements) {
				if (CollisionFunctions.isRectInRectNoBorder(elem.pos, elem.endPos, start, end)) {
					if (!ids.find(id => id === elem.id))
						ids.push(elem.id);
				}
			}
		}
		return ids;
	}

	public selectComponent(id: number, projectId?: number): void {
		this._selectedIds.set(projectId === undefined ? this.projectsService.currProject.id : projectId, [id]);
	}

	public isSingleSelect(projectId?: number): boolean {
		return this._selectedIds.get(projectId === undefined ? this.projectsService.currProject.id : projectId).length === 1;
}

	public selectedIds(projectId?: number): number[] {
		return this._selectedIds.get(projectId === undefined ? this.projectsService.currProject.id : projectId) || [];
	}

	public clearSelection(projectId?: number) {
		this._selectedIds.delete(projectId === undefined ? this.projectsService.currProject.id : projectId);
	}
}
