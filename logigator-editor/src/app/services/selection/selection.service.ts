// @ts-strict-ignore
import { Injectable, NgZone } from '@angular/core';
import { Project } from '../../models/project';
import { ProjectsService } from '../projects/projects.service';
import { CollisionFunctions } from '../../models/collision-functions';
import * as PIXI from 'pixi.js';
import { Elements } from '../../models/elements';
import { Action } from '../../models/action';
import { Element } from '../../models/element';
import { ElementTypeId } from '../../models/element-types/element-type-ids';

@Injectable({
	providedIn: 'root'
})
export class SelectionService {
	private _selectedIds: Map<number, number[]> = new Map<number, number[]>();
	private _selectedConnections: Map<number, PIXI.Point[]> = new Map<
		number,
		PIXI.Point[]
	>();

	constructor(
		private projectsService: ProjectsService,
		private ngZone: NgZone
	) {}

	public selectFromRect(
		project: Project,
		start: PIXI.Point,
		end: PIXI.Point
	): number[] {
		return this.ngZone.run(() => {
			this.clearForSelect(project, start, end);
			const cons = this._selectedConnections.get(project.id);
			const ids = new Set<number>();
			const possibleChunkCoords = CollisionFunctions.inRectChunks(start, end);
			for (const chunkCoord of possibleChunkCoords) {
				const chunk = project.currState.chunksFromCoords([chunkCoord])[0];
				if (!chunk) continue;
				const chunkPos = CollisionFunctions.chunkToPoints(
					new PIXI.Point(chunkCoord.x, chunkCoord.y)
				);
				if (
					CollisionFunctions.isRectFullyInRect(
						chunkPos.start,
						chunkPos.end,
						start,
						end
					)
				) {
					chunk.elements.forEach((elem) => {
						if (elem.typeId !== ElementTypeId.TEXT) ids.add(elem.id);
					});
					chunk.connectionPoints.forEach((con) => cons.push(con));
				} else {
					for (const elem of chunk.elements) {
						if (CollisionFunctions.isElementInFloatRect(elem, start, end)) {
							ids.add(elem.id);
						}
					}
					for (const con of chunk.connectionPoints) {
						if (CollisionFunctions.isConPointInRect(con, start, end)) {
							cons.push(con);
						}
					}
				}
			}
			const idsArr = [...ids];
			this._selectedIds.set(project.id, idsArr);
			return idsArr;
		});
	}

	public cutFromRect(
		project: Project,
		start: PIXI.Point,
		end: PIXI.Point
	): Action[] {
		return this.ngZone.run(() => {
			this.clearForSelect(project, start, end);
			const out: Action[] = [];
			const cons = this._selectedConnections.get(project.id);
			const ids = new Set<number>();
			const possibleChunkCoords = CollisionFunctions.inRectChunks(start, end);
			for (const chunk of project.currState.chunksFromCoords(
				possibleChunkCoords
			)) {
				for (const elem of chunk.elements) {
					if (elem.typeId === ElementTypeId.WIRE) {
						this.splitAndSelectWire(elem, start, end, ids, project, out);
					} else if (elem.typeId === ElementTypeId.TEXT) {
						if (CollisionFunctions.isElementInFloatRect(elem, start, end)) {
							ids.add(elem.id);
						}
					} else {
						if (
							CollisionFunctions.isRectFullyInRect(
								elem.pos,
								elem.endPos,
								start,
								end
							)
						) {
							ids.add(elem.id);
						}
					}
				}
				for (const con of chunk.connectionPoints) {
					if (CollisionFunctions.isConPointInRect(con, start, end)) {
						cons.push(con);
					}
				}
			}
			this._selectedIds.set(project.id, [...ids]);

			out.push(...project.currState.specialActions);
			if (out.length > 0) project.newState(out, true);

			return out;
		});
	}

	public cancelCut(project: Project): void {
		project.cancelLastStep();
	}

	private splitAndSelectWire(
		element: Element,
		start: PIXI.Point,
		end: PIXI.Point,
		ids: Set<number>,
		project: Project,
		out: Action[]
	) {
		const cuttingPoses = CollisionFunctions.rectCuttingPoints(
			element,
			start,
			end
		);
		if (cuttingPoses === undefined) return;
		let elems: Element[] = [element];
		for (const cuttingPos of cuttingPoses) {
			for (const elem of elems) {
				const splitted = project.splitWire(elem, cuttingPos);
				elems = [...splitted.elements];
				out.push(...splitted.actions);
			}
		}
		for (const e of elems) {
			if (CollisionFunctions.isElementInFloatRect(e, start, end)) {
				ids.add(e.id);
			}
		}
	}

	private clearForSelect(project: Project, start: PIXI.Point, end: PIXI.Point) {
		Elements.correctPosOrder(start, end);
		this._selectedIds.set(project.id, []);
		this._selectedConnections.set(project.id, []);
	}

	public selectComponent(id: number, projectId?: number): void {
		this.ngZone.run(() => {
			this._selectedIds.set(projectId ?? this.projectsService.currProject.id, [
				id
			]);
		});
	}

	public isSingleSelect(projectId?: number): boolean {
		const id = projectId ?? this.projectsService.currProject?.id;
		if (this._selectedIds.has(id)) {
			return this._selectedIds.get(id).length === 1;
		}
		return false;
	}

	public selectedIds(projectId?: number): number[] {
		const id = projectId ?? this.projectsService.currProject?.id;
		if (this._selectedIds.has(id)) {
			return this._selectedIds.get(id);
		}
		return [];
	}

	public selectedConnections(projectId?: number): PIXI.Point[] {
		const id = projectId ?? this.projectsService.currProject?.id;
		if (this._selectedConnections.has(id)) {
			return this._selectedConnections.get(id);
		}
		return [];
	}

	public clearSelection(projectId?: number) {
		this.ngZone.run(() => {
			this._selectedIds.delete(
				projectId ?? this.projectsService.currProject.id
			);
			this._selectedConnections.delete(
				projectId ?? this.projectsService.currProject.id
			);
		});
	}
}
