import {Chunk} from './chunk';
import {ProjectModel} from './project-model';
import {Element, Elements} from './element';
import * as PIXI from 'pixi.js';
import {CollisionFunctions} from './collision-functions';
import {Action, ChangeType} from './action';

export class ProjectState {

	private _model: ProjectModel;

	private readonly _chunks: Chunk[][];

	private _highestTakenId = 0;

	public specialActions: Action[] = [];



	public constructor(model?: ProjectModel, highestId?: number) {
		this._model = model || {board: {elements: []}};
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



	private loadAllIntoChunks(): void {
		for (const element of this._model.board.elements) {
			this.loadIntoChunks(element);
		}
		// TODO test
		this.loadConnectionPoints(this._model.board.elements);
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
				elements: [],
				connectionPoints: []
			};
	}

	public loadIntoChunks(element: Element): void {
		const chunkCoords = CollisionFunctions.inRectChunks(element.pos, element.endPos);
		for (const coord of chunkCoords) {
			this.createChunk(coord.x, coord.y);
			if (!this._chunks[coord.x][coord.y].elements.find(e => e.id === element.id))
				this._chunks[coord.x][coord.y].elements.push(element);
		}
	}

	private removeFromChunks(element: Element): void {
		const chunkCoords = CollisionFunctions.inRectChunks(element.pos, element.endPos);
		for (const chunk of this.chunksFromCoords(chunkCoords)) {
			chunk.elements = chunk.elements.filter(elem => elem.id !== element.id);
		}
	}


	private addConnectionPoint(pos: PIXI.Point): void {
		if (this.wiresOnPoint(pos).length > 2)
			this.loadConIntoChunks(pos);
	}

	private removeConnectionPoint(pos: PIXI.Point): void {
		if (this.wiresOnPoint(pos).length < 3)
			this.removeConFromChunks(pos);
	}

	public loadConIntoChunks(con: PIXI.Point): void {
		const chunkCoords = CollisionFunctions.inRectChunks(con, con);
		for (const coord of chunkCoords) {
			this.createChunk(coord.x, coord.y);
			if (!this.chunkHasCon(this._chunks[coord.x][coord.y], con)) {
				this._chunks[coord.x][coord.y].connectionPoints.push(con.clone());
				this.specialActions.push({name: 'conWire', pos: con.clone()});
			}
		}
	}

	public removeConFromChunks(con: PIXI.Point): void {
		const chunkX = CollisionFunctions.gridPosToChunk(con.x);
		const chunkY = CollisionFunctions.gridPosToChunk(con.y);
		let conIndex = -1;
		for (let i = 0; i < this.chunk(chunkX, chunkY).connectionPoints.length; i++) {
			if (this.chunk(chunkX, chunkY).connectionPoints[i].equals(con))
				conIndex = i;
		}
		if (conIndex < 0)
			return;
		this.chunk(chunkX, chunkY).connectionPoints.splice(conIndex, 1);
		this.specialActions.push({name: 'dcoWire', pos: con.clone()});
	}

	public removeAllConnectionPoints(elements: Element[]): void {
		elements.forEach(elem => {
			this.removeConFromChunks(elem.pos);
			this.removeConFromChunks(elem.endPos);
		});
	}

	public loadConnectionPoints(elements: Element[], allRemoved?: boolean): void {
		if (!allRemoved) {
			elements.forEach(elem => {
				this.removeConnectionPoint(elem.pos);
				this.removeConnectionPoint(elem.endPos);
			});
		}
		elements.forEach(elem => {
			this.addConnectionPoint(elem.pos);
			this.addConnectionPoint(elem.endPos);
		});
	}

	public elementsInChunks(startPos: PIXI.Point, endPos: PIXI.Point): Element[] {
		const out: Element[] = [];
		const chunks = this.chunksFromCoords(CollisionFunctions.inRectChunks(startPos, endPos));
		for (const chunk of chunks) {
			for (const elem of chunk.elements) {
				if (!out.find(e => e.id === elem.id))
					out.push(elem);
			}
		}
		return out;
	}

	private chunkHasCon(chunk: Chunk, pos: PIXI.Point): boolean {
		return !!chunk.connectionPoints.find(cp => cp.equals(pos));
	}



	public isFreeSpace(startPos: PIXI.Point, endPos: PIXI.Point, isWire?: boolean, except?: Element[]): boolean {
		const others = this.elementsInChunks(startPos, endPos);
		for (const elem of others) {
			if (except && except.find(e => e.id === elem.id) || isWire && elem.typeId === 0)
				continue;
			if (isWire && CollisionFunctions.isRectInRectLightBorder(elem.pos, elem.endPos, startPos, endPos))
				return false;
			if (!isWire && elem.typeId === 0 && CollisionFunctions.isRectInRectLightBorder(startPos, endPos, elem.pos, elem.endPos)) {
				return false;
			}
			if (!isWire && CollisionFunctions.isRectInRectNoBorder(startPos, endPos, elem.pos, elem.endPos))
				return false;
		}
		return true;
	}

	public allSpacesFree(elements: Element[], dif: PIXI.Point, except?: Element[]): boolean {
		for (const elem of elements) {
			const newStartPos = new PIXI.Point(elem.pos.x + dif.x, elem.pos.y + dif.y);
			const newEndPos = new PIXI.Point(elem.endPos.x + dif.x, elem.endPos.y + dif.y);
			if (!this.isFreeSpace(newStartPos, newEndPos, elem.typeId === 0, except))
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
	public moveElement(element: Element, dif: PIXI.Point): boolean {
		this.removeFromChunks(element);
		Elements.move(element, dif);
		this.loadIntoChunks(element);
		return true;
	}

	public rotateComp(element: Element, rotation: number, endPos?: PIXI.Point): void {
		element.rotation = rotation;
		element.endPos = endPos || Elements.calcEndPos(element.pos, element.numInputs, element.numOutputs, rotation);
	}

	public setNumInputs(element: Element, numInputs: number, endPos?: PIXI.Point): void {
		element.numInputs = numInputs;
		element.endPos = endPos || Elements.calcEndPos(element.pos, numInputs, element.numOutputs, element.rotation);
	}



	public connectWires(wire0: Element, wire1: Element, intersection: PIXI.Point): Element[] {
		const out = this.splitWire(wire0, intersection);
		return out.concat(this.splitWire(wire1, intersection));
	}

	public disconnectWires(wires: Element[]): Element[] {
		const outWires: Element[] = [];
		const doneWires: Element[] = [];
		for (const wire0 of wires) {
			for (const wire1 of wires) {
				if (wire0 === wire1 || doneWires.find(w => w.id === wire0.id || w.id === wire1.id))
					continue;
				const merged = this.mergeWires(wire0, wire1, true);
				if (!merged || !merged.newElems[0])
					continue;
				outWires.push(merged.newElems[0]);
				doneWires.push(wire0, wire1);
			}
		}
		return outWires;
	}

	private splitWire(wire: Element, pos: PIXI.Point): Element[] {
		if (!CollisionFunctions.isPointOnWireNoEdge(wire, pos))
			return [wire];
		const newWire0 = Elements.genNewElement(0, wire.pos, pos);
		const newWire1 = Elements.genNewElement(0, pos, wire.endPos);
		this.removeElement(wire.id);
		this.addElement(newWire0, wire.id);
		this.addElement(newWire1);
		return [newWire0, newWire1];
	}



	private actionToBoard(elements: Element[], func: (elem: Element, other: Element) => ChangeType): ChangeType[] {
		const out: ChangeType[] = [];
		while (elements.length > 0) {
			const elem = elements.shift();
			if (elem.typeId !== 0)
				continue;
			const others = this.elementsInChunks(elem.pos, elem.endPos);
			for (const other of others) {
				if (elem.id === other.id)
					continue;
				const change = func(elem, other);
				if (change) {
					elements = elements.filter(e => e.id !== other.id);
					elements.push(...change.newElems);
					out.push(change);
					break;
				}
			}
		}
		return out;
	}

	public mergeToBoard(elements: Element[]): ChangeType[] {
		return this.actionToBoard(elements, this.mergeWires.bind(this));
	}

	public connectToBoard(elements: Element[]): ChangeType[] {
		return this.actionToBoard(elements, this.connectWithEdge.bind(this));
	}



	public mergeWires(wire0: Element, wire1: Element, doDisconnect?: boolean): ChangeType {
		if (wire0.id === wire1.id || !CollisionFunctions.doWiresOverlap(wire0, wire1))
			return null;
		if (!doDisconnect) {
			if (wire0.pos.equals(wire1.endPos) && this.wiresOnPoint(wire0.pos).length > 2 ||
				wire1.pos.equals(wire0.endPos) && this.wiresOnPoint(wire1.pos).length > 2)
				return null;
		}
		const newElem = Elements.genNewElement(0, undefined, undefined);
		newElem.id = wire0.id;
		if (CollisionFunctions.isVertical(wire0) && CollisionFunctions.isVertical(wire1) && wire0.pos.x === wire1.pos.x) {
			Elements.mergeCheckedWiresVertical(wire0, wire1, newElem);
		} else if (CollisionFunctions.isHorizontal(wire0) && CollisionFunctions.isHorizontal(wire1) && wire0.pos.y === wire1.pos.y) {
			Elements.mergeCheckedWiresHorizontal(wire0, wire1, newElem);
		} else {
			return null;
		}
		this.removeElement(wire0.id);
		this.removeElement(wire1.id);
		this.addElement(newElem, newElem.id);
		return {newElems: [newElem], oldElems: [wire0, wire1]};
	}

	private connectWithEdge(other: Element, elem: Element): ChangeType {
		if (other.typeId !== 0 || elem.typeId !== 0)
			return null;
		let pos: PIXI.Point;
		if (CollisionFunctions.isPointOnWireNoEdge(other, elem.pos))
			pos = elem.pos;
		else if (CollisionFunctions.isPointOnWireNoEdge(other, elem.endPos))
			pos = elem.endPos;
		else if (CollisionFunctions.isPointOnWireNoEdge(elem, other.pos))
			pos = other.pos;
		else if (CollisionFunctions.isPointOnWireNoEdge(elem, other.endPos))
			pos = other.endPos;
		else
			return null;
		return {newElems: this.connectWires(elem, other, pos), oldElems: [elem, other]};
	}

	public wiresOnPoint(pos: PIXI.Point): Element[] {
		const chunkX = CollisionFunctions.gridPosToChunk(pos.x);
		const chunkY = CollisionFunctions.gridPosToChunk(pos.y);
		const outWires: Element[] = [];
		for (const elem of this.elementsInChunk(chunkX, chunkY)) {
			if (elem.typeId === 0 && CollisionFunctions.isPointOnWire(elem, pos))
				outWires.push(elem);
		}
		return outWires;
	}



	public withWiresOnEdges(elements: Element[]): Element[] {
		const out = [...elements];
		for (const element of elements) {
			if (element.typeId !== 0) continue;
			const elemsOnPos = this.wiresOnPoint(element.pos);
			elemsOnPos.forEach(elem => {
				if (!out.includes(elem))
					out.push(elem);
			});
			const elemsOnEndPos = this.wiresOnPoint(element.endPos);
			elemsOnEndPos.forEach(elem => {
				if (!out.includes(elem))
					out.push(elem);
			});
		}
		return out;
	}



	public getElementById(elemId: number): Element {
		return this._model.board.elements.find(c => c.id === elemId);
	}

	public getElementsById(ids: number[]): Element[] {
		return this._model.board.elements.filter(e => ids.includes(e.id));
	}

	public copy(): ProjectState {
		// TODO copy _chunks
		// TODO make cleaner/faster
		const outModel: ProjectModel = {
			board: {
				elements: []
			}
		};
		for (const elem of this._model.board.elements)
			outModel.board.elements.push(Object.assign({}, elem));
		return new ProjectState(outModel, this._highestTakenId);
	}

	public elementsInChunk(x: number, y: number): Element[] {
		return this._chunks[x] && this._chunks[x][y] ? this._chunks[x][y].elements : [];
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

	public chunk(x: number, y: number): Chunk {
		return this._chunks[x] ? this._chunks[x][y] : null;
	}

	get chunks(): Chunk[][] {
		return this._chunks;
	}

	get model(): ProjectModel {
		return this._model;
	}
}
