import { Injectable } from '@angular/core';
import * as PIXI from 'pixi.js';
import {Project} from '../../models/project';
import {ProjectsService} from '../projects/projects.service';

@Injectable({
	providedIn: 'root'
})
export class SelectionService {

	private _selectedIds: Map<number, number[]> = new Map<number, number[]>();

	constructor(private projectsService: ProjectsService) { }

	public selectFromRect(project: Project, start: PIXI.Point, end: PIXI.Point): number[] {
		const possibleChunkCoords = Project.inRectChunks(start, end);
		const ids = this._selectedIds.get(project.id);
		for (const chunkCoord of possibleChunkCoords) {
			console.log(project.getChunks()[chunkCoord.x][chunkCoord.y].elements);
			for (const elem of project.getChunks()[chunkCoord.x][chunkCoord.y].elements) {
				if (elem.endPos) {
					if (elem.pos.x < end.x && elem.endPos.x > start.x && elem.pos.y < end.y && elem.endPos.y > start.y) {
						if (!ids.find(id => id === elem.id))
							ids.push(elem.id);
					}
				} else { // TODO make endPos mandatory
					if (elem.pos.x < end.x && elem.pos.y < end.y) {
						if (!ids.find(id => id === elem.id))
							ids.push(elem.id);
					}
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
		return this._selectedIds.get(projectId || this.projectsService.currProject.id);
	}
}
