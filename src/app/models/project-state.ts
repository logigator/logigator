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
		const chunkCoords = Project.inRectChunks(element.pos, element.endPos || element.pos);
		for (const coord of chunkCoords) {
			this.createChunk(coord.x, coord.y);
			this._chunks[coord.x][coord.y].elements.push(element);
		}
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
		// TODO check if something is there
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
		// TODO check if something is there
		elem.pos.x += dif.x;
		elem.pos.y += dif.y;
	}

	public connectWires(wire0: Element, wire1: Element, intersection: PIXI.Point): Element[] {
		const out = this.splitWire(wire0, intersection);
		return out.concat(this.splitWire(wire1, intersection));
	}

	private splitWire(wire: Element, pos: PIXI.Point): Element[] {
		if (!Project.isPointOnWireNoEdge(wire, pos))
			return [wire];
		const newWire = {
			id: -1,
			typeId: 0,
			inputs: [],
			outputs: [],
			pos,
			endPos: wire.endPos
		};
		wire.endPos = pos;
		this.addElement(newWire);
		return [wire, newWire];
	}

	public disconnectWires(wires: Element[]): Element[] {
		const outWires: Element[] = [];
		for (const wire0 of wires) {
			for (const wire1 of wires) {
				if (wire0 === wire1)
					continue;
				const merged = this.mergeWires(wire0, wire1);
				if (!merged)
					continue;
				outWires.push(merged);
			}
		}
		return outWires;
	}

	public mergeWires(wire0: Element, wire1: Element): Element {
		if (!(Project.isPointOnWire(wire0, wire1.pos) || Project.isPointOnWire(wire0, wire1.endPos))) {
			return null;
		}
		const newElem: Element = {
			id: wire0.id,
			typeId: 0,
			inputs: [],
			outputs: [],
			pos: undefined,
			endPos: undefined
		};
		if (Project.isVertical(wire0) && Project.isVertical(wire1) && wire0.pos.x === wire1.pos.x) {
			const start = Math.min(wire0.pos.y, wire0.endPos.y, wire1.pos.y, wire1.endPos.y);
			const end = Math.max(wire0.pos.y, wire0.endPos.y, wire1.pos.y, wire1.endPos.y);
			newElem.pos = new PIXI.Point(wire0.pos.x, start);
			newElem.endPos = new PIXI.Point(wire0.pos.x, end);
		} else if (Project.isHorizontal(wire0) && Project.isHorizontal(wire1) && wire0.pos.y === wire1.pos.y) {
			const start = Math.min(wire0.pos.x, wire0.endPos.x, wire1.pos.x, wire1.endPos.x);
			const end = Math.max(wire0.pos.x, wire0.endPos.x, wire1.pos.x, wire1.endPos.x);
			newElem.pos = new PIXI.Point(start, wire0.pos.y);
			newElem.endPos = new PIXI.Point(end, wire0.pos.y);
		} else {
			return null;
		}
		this.removeElement(wire0.id);
		this.removeElement(wire1.id);
		this.addElement(newElem, newElem.id);
		return newElem;
	}

	public wiresOnPoint(pos: PIXI.Point): Element[] {
		const chunkX = Project.gridPosToChunk(pos.x);
		const chunkY = Project.gridPosToChunk(pos.y);
		const outWires: Element[] = [];
		for (const elem of this._chunks[chunkX][chunkY].elements) {
			if (elem.typeId === 0 && Project.isPointOnWire(elem, pos))
				outWires.push(elem);
		}
		return outWires;
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
