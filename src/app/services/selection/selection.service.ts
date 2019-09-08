import { Injectable } from '@angular/core';
import * as PIXI from 'pixi.js';
import {Project} from '../../models/project';
import {ProjectsService} from '../projects/projects.service';
import {CollisionFunctions} from '../../models/collision-functions';

@Injectable({
	providedIn: 'root'
})
export class SelectionService {

	private _selectedIds: Map<number, number[]> = new Map<number, number[]>();

	constructor(private projectsService: ProjectsService) { }

	public selectFromRect(project: Project, start: PIXI.Point, end: PIXI.Point): number[] {
		CollisionFunctions.correctPosOrder(start, end);
		this._selectedIds.set(project.id, []);
		const ids = this._selectedIds.get(project.id);
		const possibleChunkCoords = CollisionFunctions.inRectChunks(start, end);
		for (const chunk of project.currState.chunksFromCoords(possibleChunkCoords)) {
			for (const elem of chunk.elements) {
				if (CollisionFunctions.isRectInRect(elem.pos, elem.endPos, start, end)) {
					if (!ids.find(id => id === elem.id))
						ids.push(elem.id);
				}
			}
		}
		return ids;
	}

	public selectComponent(id: number, projectId?: number): void {
		this._selectedIds.set(projectId || this.projectsService.currProject.id, [id]);
	}

	public isSingleSelect(projectId?: number): boolean {
		return this._selectedIds.get(projectId || this.projectsService.currProject.id).length === 1;
	}

	public selectedIds(projectId?: number): number[] {
		return this._selectedIds.get(projectId || this.projectsService.currProject.id) || [];
	}

	public clearSelection(projectId?: number) {
		this._selectedIds.delete(projectId || this.projectsService.currProject.id);
	}
}
