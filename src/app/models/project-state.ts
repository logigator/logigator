import {Chunk} from './chunk';
import {ProjectModel} from './project-model';
import {Element} from './element';
import * as PIXI from 'pixi.js';
import {Project} from './project';
import {CollisionFunctions} from './collision-functions';

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
		const chunkCoords = CollisionFunctions.inRectChunks(element.pos, element.endPos);
		for (const coord of chunkCoords) {
			this.createChunk(coord.x, coord.y);
			if (!this._chunks[coord.x][coord.y].elements.find(e => e.id === element.id))
				this._chunks[coord.x][coord.y].elements.push(element);
		}
	}

	public removeFromChunks(element: Element): void {
		const chunkCoords = CollisionFunctions.inRectChunks(element.pos, element.endPos);
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
		if (!this._chunks[x][y])
			this._chunks[x][y] = {
				elements: []
			};
	}

	// TODO not check elements twice
	public isFreeSpace(startPos: PIXI.Point, endPos: PIXI.Point, isWire?: boolean, except?: Element[]): boolean {
		const chunks = this.chunksFromCoords(CollisionFunctions.inRectChunks(startPos, endPos));
		for (const chunk of chunks) {
			for (const elem of chunk.elements) {
				if (except && except.find(e => e.id === elem.id) || isWire && elem.typeId === 0)
					continue;
				if (CollisionFunctions.isRectInRect(startPos, endPos, elem.pos, elem.endPos))
					return false;
			}
		}
		return true;
	}

	public allSpacesFree(elements: Element[], dif: PIXI.Point): boolean {
		for (const elem of elements) {
			const newStartPos = new PIXI.Point(elem.pos.x + dif.x, elem.pos.y + dif.y);
			const newEndPos = new PIXI.Point(elem.endPos.x + dif.x, elem.endPos.y + dif.y);
			if (!this.isFreeSpace(newStartPos, newEndPos, elem.typeId === 0, elements))
				return false;
		}
		return true;
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

	// when except param is undefined it will not check for collision
	public moveElement(element: Element, dif: PIXI.Point, except?: Element[]): boolean {
		this.removeFromChunks(element);
		element.pos.x += dif.x;
		element.pos.y += dif.y;
		element.endPos.x += dif.x;
		element.endPos.y += dif.y;
		if (except && !this.isFreeSpace(element.pos, element.endPos, element.typeId === 0, except)) {
			element.pos.x -= dif.x;
			element.pos.y -= dif.y;
			element.endPos.x -= dif.x;
			element.endPos.y -= dif.y;
			this.loadIntoChunks(element);
			return false;
		}
		this.loadIntoChunks(element);
		return true;
	}

	public connectWires(wire0: Element, wire1: Element, intersection: PIXI.Point): Element[] {
		const out = this.splitWire(wire0, intersection);
		return out.concat(this.splitWire(wire1, intersection));
	}

	private splitWire(wire: Element, pos: PIXI.Point): Element[] {
		if (!CollisionFunctions.isPointOnWireNoEdge(wire, pos))
			return [wire];
		const newWire0 = Project.genNewElement(0, wire.pos, pos);
		const newWire1 = Project.genNewElement(0, pos, wire.endPos);
		this.removeElement(wire.id);
		this.addElement(newWire0);
		this.addElement(newWire1);
		return [newWire0, newWire1];
	}

	public disconnectWires(wires: Element[]): Element[] {
		const outWires: Element[] = [];
		const doneWires: Element[] = [];
		for (const wire0 of wires) {
			for (const wire1 of wires) {
				if (wire0 === wire1 || doneWires.find(w => w.id === wire0.id || w.id === wire1.id))
					continue;
				const merged = this.mergeWires(wire0, wire1);
				if (!merged || !merged.newElem)
					continue;
				outWires.push(merged.newElem);
				doneWires.push(wire0, wire1);
			}
		}
		return outWires;
	}

	public mergeToBoard(elements: Element[]): {newElem: Element, oldElems: Element[]}[] {
		const out: {newElem: Element, oldElems: Element[]}[] = [];
		for (const elem of elements) {
			if (elem.typeId !== 0)
				continue;
			const chunks = this.chunksFromCoords(CollisionFunctions.inRectChunks(elem.pos, elem.endPos));
			const doneOthers: Element[] = [];
			for (const chunk of chunks) {
				for (const other of chunk.elements) {
					if (!doneOthers.find(e => e.id === other.id) && elem.id !== other.id) {
						const changes = this.mergeWires(elem, other);
						if (changes) {
							out.push(changes);
							doneOthers.push(other);
						}
					}
				}
			}
		}
		return out;
	}

	public mergeWires(wire0: Element, wire1: Element): {newElem: Element, oldElems: Element[]} {
		if (!(CollisionFunctions.isPointOnWire(wire0, wire1.pos) ||
			CollisionFunctions.isPointOnWire(wire0, wire1.endPos) ||
			wire0.id === wire1.id)) {
			return null;
		}
		const newElem = Project.genNewElement(0, undefined, undefined);
		newElem.id = wire0.id;
		if (CollisionFunctions.isVertical(wire0) && CollisionFunctions.isVertical(wire1) && wire0.pos.x === wire1.pos.x) {
			const start = Math.min(wire0.pos.y, wire0.endPos.y, wire1.pos.y, wire1.endPos.y);
			const end = Math.max(wire0.pos.y, wire0.endPos.y, wire1.pos.y, wire1.endPos.y);
			newElem.pos = new PIXI.Point(wire0.pos.x, start);
			newElem.endPos = new PIXI.Point(wire0.pos.x, end);
		} else if (CollisionFunctions.isHorizontal(wire0) && CollisionFunctions.isHorizontal(wire1) && wire0.pos.y === wire1.pos.y) {
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
		return {newElem, oldElems: [wire0, wire1]};
	}

	public wiresOnPoint(pos: PIXI.Point): Element[] {
		const chunkX = CollisionFunctions.gridPosToChunk(pos.x);
		const chunkY = CollisionFunctions.gridPosToChunk(pos.y);
		const outWires: Element[] = [];
		for (const elem of this._chunks[chunkX][chunkY].elements) {
			if (elem.typeId === 0 && CollisionFunctions.isPointOnWire(elem, pos))
				outWires.push(elem);
		}
		return outWires;
	}

	public getElementById(elemId: number): Element {
		return this._model.board.elements.find(c => c.id === elemId);
	}

	public getElementsById(ids: number[]): Element[] {
		return this._model.board.elements.filter(e => ids.find(id => id === e.id));
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
