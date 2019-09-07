import {Chunk} from './chunk';
import {ProjectModel} from './project-model';
import {Element} from './element';
import {environment} from '../../environments/environment';
import * as PIXI from 'pixi.js';
import {Project} from './project';

export class ProjectState {

	private _model: ProjectModel;
	private _highestTakenId = 0;
	private _chunks: Chunk[][];

	public constructor(model?: ProjectModel, highestId?: number) {
		this._model = model || {id: 100, board: {elements: []}};
		this._highestTakenId = highestId || this.findHighestTakenId();
		this._chunks = [];
		this.loadAllIntoChunks();
	}

	private findHighestTakenId(): number {
		let out = 0;
		for (const elem of this.model.board.elements) {
			if (elem.id > out)
				out = elem.id;
		}
		return out;
	}

	public getNextId(): number {
		return ++this._highestTakenId;
	}

	public loadAllIntoChunks(): void {
		for (const element of this._model.board.elements) {
			this.loadIntoChunks(element);
		}
	}

	public loadIntoChunks(element: Element): void {
		const chunkX = Project.gridPosToChunk(element.pos.x);
		const chunkY = Project.gridPosToChunk(element.pos.y);
		this.createChunk(chunkX, chunkY);
		this._chunks[chunkX][chunkY].elements.push(element);
	}

	public removeFromChunks(element: Element): void {
		const chunkCoords = Project.inRectChunks(element.pos, element.endPos || element.pos);
		for (const chunk of this.chunksFromCoords(chunkCoords)) {
			chunk.elements = chunk.elements.filter(elem => elem.id !== element.id);
		}
	}

	private createChunk(x: number, y: number): void {
		if (this._chunks[x] && this._chunks[x][y])
			return;
		for (let i = 0; i <= x; i++)
			if (!this._chunks[i])
				this._chunks[i] = [];
		for (let i = 0; i <= y; i++)
			if (!this._chunks[x][y] && this._chunks[x][y] !== undefined)
				this._chunks[x].push(undefined);
		this._chunks[x][y] = {
			elements: []
		};
	}

	public addElement(elem: Element, id?: number): Element {
		elem.id = id || this.getNextId();
		this._model.board.elements.push(elem);
		this.loadIntoChunks(elem);
		return elem;
	}

	public removeElement(elementId: number): Element {
		const outElemIndex = this._model.board.elements.findIndex(c => c.id === elementId);
		if (outElemIndex < 0)
			return null;
		const outElem = this._model.board.elements[outElemIndex];
		this._model.board.elements.splice(outElemIndex, 1);
		this.removeFromChunks(outElem);
		return outElem;
	}

	public moveElement(elem: Element, dif: PIXI.Point): void {
		elem.pos.x += dif.x;
		elem.pos.y += dif.y;
	}

	public getElementById(elemId: number): Element {
		return this._model.board.elements.find(c => c.id === elemId);
	}

	public copy(): ProjectState {
		// TODO copy _chunks
		// TODO make cleaner/faster
		const outModel: ProjectModel = {
			id: this._model.id,
			board: {
				elements: []
			}
		};
		for (const elem of this._model.board.elements)
			outModel.board.elements.push(Object.assign({}, elem));
		return new ProjectState(outModel, this._highestTakenId);
	}

	public elementsInChunk(x: number, y: number): Element[] {
		return this._chunks[x][y].elements;
	}

	public chunksFromCoords(chunkCoords: {x: number, y: number}[]): Chunk[] {
		const out: Chunk[] = [];
		for (const coords of chunkCoords) {
			if (!this._chunks[coords.x] || !this._chunks[coords.x][coords.y])
				continue;
			out.push(this._chunks[coords.x][coords.y]);
		}
		return out;
	}

	get model(): ProjectModel {
		return this._model;
	}

	get chunks(): Chunk[][] {
		return this._chunks;
	}
}
