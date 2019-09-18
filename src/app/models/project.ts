import {ProjectState} from './project-state';
import {Action, Actions, ChangeType} from './action';
import {Element} from './element';
import {Chunk} from './chunk';
import {Observable, Subject} from 'rxjs';
import * as PIXI from 'pixi.js';
import {environment} from '../../environments/environment';
import {CollisionFunctions} from './collision-functions';
import {ElementProviderService} from '../services/element-provider/element-provider.service';

export class Project {

	private MAX_ACTIONS = 100;

	private _id: number;
	private _name: string;

	private _actions: Action[][];
	private _currActionPointer: number;
	private _currMaxActionPointer: number;

	private _currState: ProjectState;

	private changeSubject: Subject<Action[]>;

	public constructor(projectState: ProjectState, id?: number, name?: string) {
		this._currState = projectState;
		this._id = id;
		this._name = name;
		this._actions = [];
		for (let i = 0; i < this.MAX_ACTIONS; i++)
			this._actions.push(null);
		this._currActionPointer = -1;
		this._currMaxActionPointer = -1;
		this.changeSubject = new Subject<Action[]>();
		this._currState.setChangeSubject(this.changeSubject);
	}

	public static genNewElement(typeId: number, _pos: PIXI.Point, _endPos: PIXI.Point): Element {
		const pos = _pos ? _pos.clone() : undefined;
		const endPos = _endPos ? _endPos.clone() : undefined;
		if (pos && endPos)
			CollisionFunctions.correctPosOrder(pos, endPos);
		return {
			id: -1,
			typeId,
			inputs: [],
			outputs: [],
			pos,
			endPos
		};
	}

	private static gen2Wires(_pos: PIXI.Point, _cornerPos: PIXI.Point, _endPos: PIXI.Point): {wire0: Element, wire1: Element} {
		const wire0 = Project.genNewElement(0, _pos, _cornerPos);
		const wire1 = Project.genNewElement(0, _cornerPos, _endPos);
		CollisionFunctions.correctPosOrder(wire0.pos, wire0.endPos);
		CollisionFunctions.correctPosOrder(wire1.pos, wire1.endPos);
		return {wire0, wire1};
	}

	private static calcEndPos(pos: PIXI.Point, typeId: number): PIXI.Point {
		const type = ElementProviderService.staticInstance.getElementById(typeId);
		return new PIXI.Point(pos.x + environment.componentWidth,
			pos.y + Math.max(type.numInputs, type.numOutputs));
	}

	protected applyActions(actions: Action[]): void {
		actions.forEach(action => this.applyAction(action));
	}

	protected applyAction(action: Action): void {
		switch (action.name) {
			case 'addComp':
			case 'addWire':
				this._currState.addElement(action.element, action.element.id);
				break;
			case 'remComp':
			case 'remWire':
				this._currState.removeElement(action.element.id);
				break;
			case 'movMult':
				for (const elem of action.others) {
					this._currState.moveElement(elem, action.pos);
				}
				break;
			case 'conWire':
				break;
			case 'dcoWire':
				break;
		}
	}

	public getOpenActions(): Action[] {
		const out: Action[] = [];
		for (const element of this.allElements) {
			out.push({
				name: element.typeId === 0 ? 'addWire' : 'addComp',
				id: element.id,
				pos: element.pos,
				endPos: element.endPos,
				element
			});
		}
		return out;
	}

	public chunksToRender(start: PIXI.Point, end: PIXI.Point): {x: number, y: number}[] {
		const out = CollisionFunctions.inRectChunks(start, end);
		for (const chunk of this._currState.chunksFromCoords(out)) {
			for (const elem of chunk.elements) {
				const chunkX = CollisionFunctions.gridPosToChunk(elem.pos.x);
				const chunkY = CollisionFunctions.gridPosToChunk(elem.pos.y);
				if (!out.find(c => c.x === chunkX && c.y === chunkY))
					out.push({x: chunkX, y: chunkY});
			}
		}
		return out;
	}

	public addWire(_pos: PIXI.Point, _cornerPos: PIXI.Point, _endPos?: PIXI.Point): Element[] {
		if (!_endPos) {
			const elem = this.addElement(0, _pos, _cornerPos);
			return elem ? [elem] : null;
		}
		const {wire0, wire1} = Project.gen2Wires(_pos, _cornerPos, _endPos);
		if (!this._currState.allSpacesFree([wire0, wire1], new PIXI.Point(0, 0)))
			return null;
		this._currState.addElement(wire0);
		this._currState.addElement(wire1);
		const actions = this.actionsFromAddWires([wire0, wire1]);
		this.newState(actions);
		this.changeSubject.next(actions);
		return [wire0, wire1];
	}

	private actionsFromAddWires(wires: Element[]): Action[] {
		const actions: Action[] = [];
		wires.forEach(wire => actions.push({name: 'addWire', element: wire}));
		actions.push(...this.autoAssemble(wires));
		return actions;
	}

	public addElements(elements: Element[]): boolean {
		return false;
	}

	public addElement(typeId: number, _pos: PIXI.Point, _endPos?: PIXI.Point): Element {
		if (typeId === 0 && !_endPos)
			return null;
		if (typeId === 0 && _pos.equals(_endPos))
			return null;
		const elem = Project.genNewElement(typeId, _pos, _endPos || Project.calcEndPos(_pos, typeId));
		if (!this._currState.isFreeSpace(elem.pos, elem.endPos, typeId === 0))
			return null;
		this._currState.addElement(elem);
		const actions: Action[] = [{
			name: elem.typeId === 0 ? 'addWire' : 'addComp',
			element: elem
		}];
		actions.push(...this.autoAssemble([elem]));
		this.newState(actions);
		this.changeSubject.next(actions);
		return elem;
	}

	public removeElement(element: Element): void {
		this.removeElementById(element.id);
	}

	public removeElementById(id: number): void {
		const elem = this._currState.removeElement(id);
		const action: Action = {
			name: elem.typeId === 0 ? 'remWire' : 'remComp',
			element: elem
		};
		this.newState([action]);
		this.changeSubject.next([action]);
	}

	public moveElementsById(ids: number[], dif: PIXI.Point): boolean {
		if (dif.x === 0 && dif.y === 0)
			return true;
		const elements = this._currState.getElementsById(ids);
		const changed = this.withWiresOnEdges(elements);
		if (!this._currState.allSpacesFree(elements, dif))
			return false;
		for (const elem of elements) {
			this._currState.moveElement(elem, dif);
		}
		const actions: Action[] = [{
			name: 'movMult',
			others: elements,
			pos: dif
		}];
		actions.push(...this.autoAssemble(changed));
		this.newState(actions);
		this.changeSubject.next(actions);
		return true;
	}

	public moveConnectionPoints(cons: PIXI.Point[], dif: PIXI.Point): boolean {

	}

	public toggleWireConnection(pos: PIXI.Point): void {
		const wiresOnPoint = this._currState.wiresOnPoint(pos);
		let actions: Action[];
		if (wiresOnPoint.length === 2) {
			actions = this.connectWires(pos, wiresOnPoint);
		} else if (wiresOnPoint.length === 4) {
			actions = this.disconnectWires(pos, wiresOnPoint);
		} else {
			console.log('where are you clicking??', wiresOnPoint);
		}
		this.newState(actions);
		this.changeSubject.next(actions);
	}

	private connectWires(pos: PIXI.Point, wiresToConnect?: Element[]): Action[] {
		if (!wiresToConnect)
			wiresToConnect = this._currState.wiresOnPoint(pos);
		const newWires = this.currState.connectWires(wiresToConnect[0], wiresToConnect[1], pos);
		const actions = Actions.connectWiresToActions(wiresToConnect, newWires);
		actions.push({name: 'conWire', pos});
		return actions;
	}

	private disconnectWires(pos: PIXI.Point, wiresOnPoint: Element[]): Action[] {
		const newWires = this._currState.disconnectWires(wiresOnPoint);
		const actions = Actions.connectWiresToActions(wiresOnPoint, newWires);
		// actions.push({name: 'dcoWire', pos});
		return actions;
	}

	private autoConnect(elements: Element[]): {actions: Action[], elements: Element[]} {
		const out: Action[] = [];
		let outElements = [...elements];
		const elemChanges = this._currState.connectToBoard(elements);
		outElements = Actions.applyChangeOnArrayAndActions(elemChanges, out, outElements);
		return {actions: out, elements: outElements};
	}

	private autoMerge(elements: Element[]): {actions: Action[], elements: Element[]} {
		const out: Action[] = [];
		let outElements = [...elements];
		const elemChanges = this._currState.mergeToBoard(elements);
		outElements = Actions.applyChangeOnArrayAndActions(elemChanges, out, outElements);
		return {actions: out, elements: outElements};
	}

	private withWiresOnEdges(elements: Element[]): Element[] {
		const out = [...elements];
		for (const element of elements) {
			if (element.typeId !== 0) continue;
			const elemsOnPos = this._currState.wiresOnPoint(element.pos);
			elemsOnPos.forEach(elem => {
				if (!out.includes(elem))
					out.push(elem);
			});
			const elemsOnEndPos = this._currState.wiresOnPoint(element.endPos);
			elemsOnEndPos.forEach(elem => {
				if (!out.includes(elem))
					out.push(elem);
			});
		}
		return out;
	}

	private autoAssemble(elements: Element[]): Action[] {
		const out: Action[] = [];
		// debugger;
		const merged = this.autoMerge(elements);
		out.push(...merged.actions);
		const connected = this.autoConnect(merged.elements);
		out.push(...connected.actions);
		return out;
	}

	private newState(actions: Action[]): void {
		if (this._currActionPointer >= this.MAX_ACTIONS) {
			this._actions.shift();
		} else {
			this._currActionPointer++;
		}
		this._currMaxActionPointer = this._currActionPointer;
		this._actions[this._currActionPointer] = actions;
	}

	public stepBack(): Action[] {
		if (this._currActionPointer < 0)
			return;
		const backActions = Actions.reverseActions(this._actions[this._currActionPointer]);
		this._currActionPointer--;
		this.applyActions(backActions);
		this.changeSubject.next(backActions);
		return backActions;
	}

	public stepForward(): Action[] {
		if (this._currActionPointer >= this.MAX_ACTIONS || this._currActionPointer === this._currMaxActionPointer)
			return;
		const outActions = this._actions[++this._currActionPointer];
		this.applyActions(outActions);
		this.changeSubject.next(outActions);
		return outActions;
	}

	public getChunks(): Chunk[][] {
		return this.currState.chunks;
	}

	public get allElements(): Element[] {
		return this._currState.model.board.elements;
	}

	get changes(): Observable<Action[]> {
		return this.changeSubject.asObservable();
	}

	get currState(): ProjectState {
		return this._currState;
	}

	get id(): number {
		return this._id;
	}

	get name(): string {
		return this._name;
	}
}
