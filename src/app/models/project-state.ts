import {Chunk} from './chunk';
import {Element} from './element';
import {Elements} from './elements';
import * as PIXI from 'pixi.js';
import {CollisionFunctions} from './collision-functions';
import {Action, ChangeType} from './action';
import {WireEndOnElem} from '../services/simulation/state-compiler/compiler-types';
import {ElementTypeId} from './element-types/element-type-ids';
import {getStaticDI} from './get-di';
import {ElementProviderService} from '../services/element-provider/element-provider.service';

export class ProjectState {

	private readonly _model: Map<number, Element>;

	private readonly _chunks: Chunk[][];

	private _highestTakenId = 0;

	public specialActions: Action[] = [];

	public numInputs = 0;
	public numOutputs = 0;

	private _outputPlugs: Element[];
	private _inputPlugs: Element[];

	public constructor(elements?: Element[], highestId?: number) {
		if (elements) {
			this._model = new Map<number, Element>(elements.map(e => [e.id, e]));
		} else {
			this._model = new Map<number, Element>();
		}
		this._highestTakenId = highestId || this.findHighestTakenId();
		this._chunks = [];
		this._outputPlugs = [];
		this._inputPlugs = [];
		this.calcAllEndPos();
		this.loadAllIntoChunks();
		this.inputOutputCount();
	}



	private findHighestTakenId(): number {
		let out = 0;
		for (const elem of this._model.values()) {
			if (elem.id > out)
				out = elem.id;
		}
		return out;
	}

	public getNextId(): number {
		return ++this._highestTakenId;
	}


	private calcAllEndPos() {
		for (const element of this.allElements) {
			if (element.typeId === ElementTypeId.WIRE) continue;
			element.endPos = Elements.calcEndPos(element);
		}
	}


	private loadAllIntoChunks(): void {
		for (const element of this._model.values()) {
			this.loadIntoChunks(element);
		}
		this.loadConnectionPoints(this.allElements);
		this.specialActions = [];
	}

	private createChunk(x: number, y: number): void {
		if (this._chunks[x] && this._chunks[x][y] || x < 0 || y < 0)
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
		const chunkCoords = CollisionFunctions.inRectChunks(element.pos, element.endPos, Elements.wireEnds(element));
		for (const coord of chunkCoords) {
			this.createChunk(coord.x, coord.y);
			if (!this._chunks[coord.x][coord.y].elements.find(e => e.id === element.id))
				this._chunks[coord.x][coord.y].elements.push(element);
		}
	}

	private removeFromChunks(element: Element): void {
		const chunkCoords = CollisionFunctions.inRectChunks(element.pos, element.endPos, Elements.wireEnds(element));
		for (const chunk of this.chunksFromCoords(chunkCoords)) {
			chunk.elements = chunk.elements.filter(elem => elem.id !== element.id);
		}
	}


	private addConnectionPoint(pos: PIXI.Point): void {
		if (this.elemsOnPoint(pos).length > 2)
			this.loadConIntoChunks(pos);
	}

	private removeConnectionPoint(pos: PIXI.Point): void {
		if (this.elemsOnPoint(pos).length < 3)
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
		const chunk = this.chunk(CollisionFunctions.gridPosToChunk(con));
		if (!chunk)
			return;
		let conIndex = -1;
		for (let i = 0; i < chunk.connectionPoints.length; i++) {
			if (chunk.connectionPoints[i].equals(con))
				conIndex = i;
		}
		if (conIndex < 0)
			return;
		chunk.connectionPoints.splice(conIndex, 1);
		this.specialActions.push({name: 'dcoWire', pos: con.clone()});
	}

	public removeAllConnectionPoints(elements: Element[]): void {
		elements.forEach(elem => {
			for (const pos of this.wireEnds(elem)) {
				this.removeConFromChunks(pos);
			}
		});
	}

	public loadConnectionPoints(elements: Element[], allRemoved?: boolean): void {
		if (!allRemoved) {
			elements.forEach(elem => {
				for (const pos of Elements.wireEnds(elem))
					this.removeConnectionPoint(pos);
			});
		}
		elements.forEach(elem => {
			for (const pos of Elements.wireEnds(elem))
				this.addConnectionPoint(pos);
		});
	}

	public elementsInChunks(startPos: PIXI.Point, endPos: PIXI.Point): Element[] {
		const chunks = this.chunksFromCoords(CollisionFunctions.inRectChunks(startPos, endPos));
		if (chunks.length === 1) {
			return chunks[0].elements;
		}
		const out = new Set<Element>();
		for (const chunk of chunks) {
			for (const elem of chunk.elements) {
				out.add(elem);
			}
		}
		return [...out];
	}

	private chunkHasCon(chunk: Chunk, pos: PIXI.Point): boolean {
		return !!chunk.connectionPoints.find(cp => cp.equals(pos));
	}



	public isFreeSpace(startPos: PIXI.Point, endPos: PIXI.Point, isWire?: boolean, wireEnds?: PIXI.Point[], except?: Element[]): boolean {
		const others = this.elementsInChunks(startPos, endPos);
		for (const elem of others) {
			if (except && except.find(e => e.id === elem.id) || isWire && elem.typeId === ElementTypeId.WIRE)
				continue;
			if (isWire && CollisionFunctions.isRectInRectLightBorder(elem.pos, elem.endPos, startPos, endPos))
				return false;
			if (!isWire && elem.typeId === ElementTypeId.WIRE &&
				CollisionFunctions.isRectInRectLightBorder(startPos, endPos, elem.pos, elem.endPos)) {
				return false;
			}
			if (!isWire && CollisionFunctions.isRectInRectNoBorder(startPos, endPos, elem.pos, elem.endPos))
				return false;
			if (wireEnds) {
				for (const pos of wireEnds) {
					if (CollisionFunctions.isPointInRect(pos, elem.pos, elem.endPos))
						return false;
				}
			}
			if (!isWire && elem.typeId !== 0) {
				for (const pos of Elements.wireEnds(elem)) {
					if (CollisionFunctions.isPointInRect(pos, startPos, endPos))
						return false;
				}
			}
		}
		return !(startPos.x < 0 || startPos.y < 0);
	}

	public allSpacesFree(elements: Element[], dif: PIXI.Point, except?: Element[]): boolean {
		for (const elem of elements) {
			const newStartPos = new PIXI.Point(elem.pos.x + dif.x, elem.pos.y + dif.y);
			const newEndPos = new PIXI.Point(elem.endPos.x + dif.x, elem.endPos.y + dif.y);
			if (!this.isFreeSpace(newStartPos, newEndPos, elem.typeId === ElementTypeId.WIRE,
				Elements.wireEnds(elem, undefined, undefined, dif), except))
				return false;
		}
		return true;
	}

	public withoutToEmptyChunk(elements: Element[], dif: PIXI.Point): Element[] {
		const out: Element[] = [];
		for (const elem of elements) {
			const newStartPos = new PIXI.Point(elem.pos.x + dif.x, elem.pos.y + dif.y);
			const newEndPos = new PIXI.Point(elem.endPos.x + dif.x, elem.endPos.y + dif.y);
			const others = this.elementsInChunks(newStartPos, newEndPos);
			if (others.length > 0)
				out.push(elem);
		}
		return out;
	}



	public addElement(elem: Element, id?: number): Element {
		elem.id = id || this.getNextId();
		this._model.set(elem.id, elem);
		if (elem.typeId === ElementTypeId.INPUT) {
			elem.plugIndex = this.numInputs++;
			this._inputPlugs.push(elem);
			for (const plug of this._outputPlugs) {
				plug.plugIndex++;
			}
		} else if (elem.typeId === ElementTypeId.OUTPUT) {
			elem.plugIndex = this.numInputs + this.numOutputs++;
			this._outputPlugs.push(elem);
		}
		this.loadIntoChunks(elem);
		return elem;
	}

	public removeElement(elementId: number): Element {
		const outElem = this._model.get(elementId);
		if (!outElem)
			return null;
		this._model.delete(elementId);

		if (outElem.typeId === ElementTypeId.INPUT) {
			this.numInputs--;
			this._inputPlugs = this._inputPlugs.filter(e => e.id !== elementId);
			for (const plug of this._inputPlugs) {
				if (plug.plugIndex > outElem.plugIndex) {
					plug.plugIndex--;
				}
			}
			for (const plug of this._outputPlugs) {
				plug.plugIndex--;
			}
		} else if (outElem.typeId === ElementTypeId.OUTPUT) {
			this.numOutputs--;
			this._outputPlugs = this._outputPlugs.filter(e => e.id !== elementId);
			for (const plug of this._outputPlugs) {
				if (plug.plugIndex > outElem.plugIndex) {
					plug.plugIndex--;
				}
			}
		}
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
		this.removeFromChunks(element);
		element.rotation = rotation;
		element.endPos = endPos || Elements.calcEndPos(element, undefined, undefined, rotation);
		this.loadIntoChunks(element);
	}

	public setNumInputs(element: Element, numInputs: number, endPos?: PIXI.Point): void {
		this.removeFromChunks(element);
		element.numInputs = numInputs;
		element.endPos = endPos || Elements.calcEndPos(element, numInputs);
		this.loadIntoChunks(element);
	}


	public updateNumInputsOutputs(element: Element): void {
		element.numInputs = Elements.elementType(element.typeId).numInputs;
		element.numOutputs = Elements.elementType(element.typeId).numOutputs;
		element.endPos = Elements.calcEndPos(element);
	}



	public connectWires(wire0: Element, wire1: Element, intersection: PIXI.Point): Element[] {
		const out = wire0.typeId === ElementTypeId.WIRE ? this.splitWire(wire0, intersection) : [];
		return out.concat(wire1.typeId === ElementTypeId.WIRE ? this.splitWire(wire1, intersection) : []);
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
		if (doneWires.length !== wires.length) {
			for (const wire of wires) {
				if (!doneWires.includes(wire))
					outWires.push(wire);
			}
		}
		return outWires;
	}

	public splitWire(wire: Element, pos: PIXI.Point): Element[] {
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
		if (wire0.typeId !== 0 || wire1.typeId !== 0 || wire0.id === wire1.id || !CollisionFunctions.doWiresOverlap(wire0, wire1))
			return null;
		if (!doDisconnect) {
			if (wire0.pos.equals(wire1.endPos) && this.elemsOnPoint(wire0.pos).length > 2 ||
				wire1.pos.equals(wire0.endPos) && this.elemsOnPoint(wire1.pos).length > 2)
				return null;
		}
		const newElem = Elements.genNewElement(0, undefined, undefined);
		newElem.id = wire0.id;
		if (Elements.isVertical(wire0) && Elements.isVertical(wire1) && wire0.pos.x === wire1.pos.x) {
			Elements.mergeCheckedWiresVertical(wire0, wire1, newElem);
		} else if (Elements.isHorizontal(wire0) && Elements.isHorizontal(wire1) && wire0.pos.y === wire1.pos.y) {
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
		const oldElems = (elem.typeId === ElementTypeId.WIRE ? [elem] : []).concat(other.typeId === ElementTypeId.WIRE ? [other] : []);
		if (other.typeId === ElementTypeId.WIRE) {
			const wireEnds = this.wireEnds(elem);
			for (const endPoint of wireEnds) {
				if (CollisionFunctions.isPointOnWireNoEdge(other, endPoint)) {
					return {newElems: this.connectWires(elem, other, endPoint), oldElems};
				}
			}
		}
		if (elem.typeId === ElementTypeId.WIRE) {
			const wireEnds = this.wireEnds(other);
			for (const endPoint of wireEnds) {
				if (CollisionFunctions.isPointOnWireNoEdge(elem, endPoint)) {
					return {newElems: this.connectWires(other, elem, endPoint), oldElems};
				}
			}
		}
		return null;
	}

	public wiresOnPoint(pos: PIXI.Point): Element[] {
		const chunk = CollisionFunctions.gridPosToChunk(pos);
		const outWires: Element[] = [];
		for (const elem of this.elementsInChunk(chunk)) {
			if (elem.typeId === ElementTypeId.WIRE && CollisionFunctions.isPointOnWire(elem, pos))
				outWires.push(elem);
		}
		return outWires;
	}

	public componentsOnPoint(pos: PIXI.Point): Element[] {
		const chunk = CollisionFunctions.gridPosToChunk(pos);
		const outWires: Element[] = [];
		for (const elem of this.elementsInChunk(chunk)) {
			if (elem.typeId !== 0 && CollisionFunctions.isPointOnWire(elem, pos))
				outWires.push(elem);
		}
		return outWires;
	}

	private wireEnds(element: Element): PIXI.Point[] {
		const out = Elements.wireEnds(element);
		return out.filter(point => {
			for (const wire of this.elemsOnPoint(point)) {
				if (wire === element)
					continue;
				if (Elements.isSameDirection(element, wire)) {
					return false;
				}
			}
			return true;
		});
	}

	public elemsOnPoint(pos: PIXI.Point): Element[] {
		const chunk = CollisionFunctions.gridPosToChunk(pos);
		const outWires: Element[] = [];
		for (const elem of this.elementsInChunk(chunk)) {
			if (CollisionFunctions.elemHasWirePoint(elem, pos)) {
				outWires.push(elem);
			}
		}
		return outWires;
	}

	public wireEndsOnPoint(pos: PIXI.Point): WireEndOnElem {
		const chunk = CollisionFunctions.gridPosToChunk(pos);
		const out: WireEndOnElem = new Map<Element, number>();
		for (const elem of this.elementsInChunk(chunk)) {
			const index = CollisionFunctions.wirePointIndex(elem, pos);
			if (index >= 0) {
				out.set(elem, index);
			}
		}
		return out;
	}



	public withWiresOnEdges(elements: Element[]): Element[] {
		const out = [...elements];
		for (const element of elements) {
			for (const pos of Elements.wireEnds(element)) {
				const elemsOnPos = this.wiresOnPoint(pos);
				elemsOnPos.forEach(elem => {
					if (!out.includes(elem))
						out.push(elem);
				});
			}
		}
		return out;
	}



	public getElementById(elemId: number): Element {
		return this._model.get(elemId);
	}

	public getElementsById(ids: number[]): Element[] {
		const out: Element[] = [];
		for (const id of ids) {
			if (this._model.has(id))
				out.push(this._model.get(id));
		}
		return out;
	}

	public equals(other: ProjectState): boolean {
		if (other._model.size !== this._model.size)
			return false;
		for (const elem of this._model.values()) {
			if (!other._model.has(elem.id) || !Elements.equals(elem, other._model.get(elem.id)))
				return false;
		}
		for (let i = 0; i < this._chunks.length; i++) {
			for (let j = 0; j < this._chunks[i].length; j++) {
				const ownChunk = this._chunks[i][j];
				const otherChunk = other._chunks[i][j]; // might crash when test failing, did not happen but possible
				if (otherChunk.elements.length !== ownChunk.elements.length ||
					otherChunk.connectionPoints.length !== ownChunk.connectionPoints.length)
					return false;
				for (let k = 0; k < ownChunk.elements.length; k++) {
					if (!otherChunk.elements.find(e => Elements.equals(e, ownChunk.elements[k])))
						return false;
				}
				for (let k = 0; k < ownChunk.connectionPoints.length; k++) {
					const ownCp = ownChunk.connectionPoints[k];
					if (!otherChunk.connectionPoints.find(cp => cp.x === ownCp.x && cp.y === ownCp.y))
						return false;
				}
			}
		}
		return true;
	}

	public elementsInChunk(c: PIXI.Point): Element[] {
		return this._chunks[c.x] && this._chunks[c.x][c.y] ? this._chunks[c.x][c.y].elements : [];
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


	public elementsOverLine(from: PIXI.Point, to: PIXI.Point): Element[] {
		const out: Element[] = [];
		const chunks = this.chunksOverLine(from, to);
		for (const chunk of chunks) {
			if (!chunk) continue;
			for (const element of chunk.elements) {
				if (out.find(e => e.id === element.id))
					continue;
				if (CollisionFunctions.lineOverElem(element, from, to))
					out.push(element);
				else if (CollisionFunctions.isPointInRect(from, element.pos, element.endPos))
					out.push(element);
			}
		}
		return out;
	}

	private chunksOverLine(from: PIXI.Point, to: PIXI.Point): Chunk[] {
		const chunk1 = CollisionFunctions.gridPosToChunk(from);
		const chunk2 = CollisionFunctions.gridPosToChunk(to);
		let chunks: Chunk[];
		if (chunk1.equals(chunk2)) {
			chunks = [this.chunk(chunk1)];
		} else {
			if (Math.abs(chunk1.x - chunk2.x) > 1 || Math.abs(chunk1.y - chunk2.y) > 1)
				return [];

			chunks = [this.chunk(chunk1), this.chunk(chunk2)];
			const otherChunks = [new PIXI.Point(chunk1.x, chunk2.y), new PIXI.Point(chunk1.y, chunk2.x)];
			for (const c of otherChunks) {
				const {start, end} = CollisionFunctions.chunkToPoints(new PIXI.Point(chunk1.x, chunk2.y));
				if (CollisionFunctions.lineOverRect(start, end, from, to)) {
					chunks.push(this.chunk(c));
				}
			}
		}
		return chunks;
	}


	public inputOutputCount(): {numInputs: number, numOutputs: number} {
		let numInputs = 0;
		let numOutputs = 0;
		this._outputPlugs = [];
		this._inputPlugs = [];
		for (const elem of this._model.values()) {
			if (elem.typeId === ElementTypeId.INPUT) {
				if (elem.plugIndex === undefined)
					elem.plugIndex = numInputs;
				numInputs++;
				this._inputPlugs.push(elem);
			} else if (elem.typeId === ElementTypeId.OUTPUT) {
				if (elem.plugIndex === undefined)
					elem.plugIndex = numInputs + numOutputs;
				numOutputs++;
				this._outputPlugs.push(elem);
			}
		}
		this.numInputs = numInputs;
		this.numOutputs = numOutputs;
		return {numInputs, numOutputs};
	}

	public setPlugId(elem: Element, id: number): void {
		for (const plug of elem.typeId === ElementTypeId.INPUT ? this._inputPlugs : this._outputPlugs) {
			if (plug.plugIndex === id) {
				this.specialActions.push({
					name: 'plugInd',
					element: plug,
					numbers: [elem.plugIndex, plug.plugIndex]
				});
				plug.plugIndex = elem.plugIndex;
			}
		}
		elem.plugIndex = id;
	}

	public possiblePlugIds(elem: Element): number[] {
		const out: number[] = [];
		if (elem.typeId === ElementTypeId.INPUT) {
			for (let i = 0; i < this.numInputs; i++) {
				out.push(i);
			}
		} else if (elem.typeId === ElementTypeId.OUTPUT) {
			for (let i = 0; i < this.numOutputs; i++) {
				out.push(this.numInputs + i);
			}
		}
		return out;
	}

	public setOptions(element: Element, options: number[]): void {
		element.options = options;
		const elemType = getStaticDI(ElementProviderService).getElementById(element.typeId);
		if (elemType.onOptionsChanged) elemType.onOptionsChanged(element);
		element.endPos = Elements.calcEndPos(element);
	}

	public setData(element: Element, data: unknown): void {
		element.data = data;
	}

	public chunk(c: PIXI.Point): Chunk {
		return this._chunks[c.x] ? this._chunks[c.x][c.y] : null;
	}

	public allPlugs(): Element[] {
		return [
			...this._inputPlugs.sort((a, b) => {
				return a.plugIndex - b.plugIndex;
			}),
			...this._outputPlugs.sort((a, b) => {
				return a.plugIndex - b.plugIndex;
			})
		];
	}

	get allElements(): Element[] {
		return [...this._model.values()];
	}

	get chunks(): Chunk[][] {
		return this._chunks;
	}

	get model(): Map<number, Element> {
		return this._model;
	}
}
