import {ProjectState} from './project-state';
import {Action, ActionType} from './action';
import {Element} from './element';
import {Chunk} from './chunk';
import {Observable, Subject} from 'rxjs';
import * as PIXI from 'pixi.js';
import {environment} from '../../environments/environment';
import {CollisionFunctions} from './collision-functions';
import {ElementProviderService} from '../services/element-provider/element-provider.service';

export class Project {

	private static readonly REVERSE_ACTION: Map<ActionType, ActionType[]> = new Map<ActionType, ActionType[]>([
		['addComp', ['remComp']],
		['addWire', ['remWire']],
		['addText', ['remText']],
		['remComp', ['addComp']],
		['remWire', ['addWire']],
		['remText', ['addText']],
		['movMult', ['movMult']],
		['conWire', ['dcoWire']],
		['dcoWire', ['conWire']],
		['setComp', ['setComp']]
	]);

	private MAX_ACTIONS = 100;

	private _id: number;
	private _name: string;

	private _actions: Action[][];
	private _currActionPointer: number;
	private _currMaxActionPointer: number;

	private _currState: ProjectState;

	private changeSubject: Subject<Action[]>;

	public constructor(projectState: ProjectState, id?: number) {
		this._currState = projectState;
		this._id = id;
		this._actions = [];
		for (let i = 0; i < this.MAX_ACTIONS; i++)
			this._actions.push(null);
		this._currActionPointer = -1;
		this._currMaxActionPointer = -1;
		this.changeSubject = new Subject<Action[]>();
	}

	protected static applyActions(projectState: ProjectState, actions: Action[]): void {
		actions.forEach(action => Project.applyAction(projectState, action));
	}

	protected static applyAction(projectState: ProjectState, action: Action): void {
		switch (action.name) {
			case 'addComp':
			case 'addWire':
				projectState.addElement(action.element, action.element.id);
				break;
			case 'remComp':
			case 'remWire':
				projectState.removeElement(action.element.id);
				break;
			case 'movMult':
				for (const elem of action.others) {
					projectState.moveElement(elem, action.pos);
				}
				break;
			case 'conWire':
				const wiresOnPointCon = projectState.wiresOnPoint(action.pos);
				projectState.connectWires(wiresOnPointCon[0], wiresOnPointCon[1], action.pos);
				break;
			case 'dcoWire':
				const wiresOnPointDco = projectState.wiresOnPoint(action.pos);
				projectState.disconnectWires(wiresOnPointDco);
				break;
		}
	}

	protected static reverseActions(actions: Action[]): Action[] {
		const out: Action[] = [];
		for (let i = actions.length; i > -1; i--) {
			out.push(...Project.reverseAction(actions[i]));
		}
		return out;
	}

	protected static reverseAction(action: Action): Action[] {
		const revActions = [{...action}];
		revActions[0].name = Project.REVERSE_ACTION.get(action.name)[0];
		for (const revAction of revActions) {
			revAction.pos = action.pos ? action.pos.clone() : undefined;
			revAction.endPos = action.endPos ? action.endPos.clone() : undefined;
			if (revAction.name === 'movMult') {
				revAction.pos.x *= -1;
				revAction.pos.y *= -1;
			}
		}
		return revActions;
	}

	private static connectWiresToActions(oldWires, newWires): Action[] {
		const outActions: Action[] = [];
		for (const oldWire of oldWires) {
			outActions.push({
				name: 'remComp',
				element: oldWire
			});
		}
		for (const newWire of newWires) {
			outActions.push({
				name: 'addComp',
				element: newWire
			});
		}
		return outActions;
	}

	private static genNewElement(typeId: number, pos: PIXI.Point, endPos: PIXI.Point): Element {
		return {
			id: -1,
			typeId,
			inputs: [],
			outputs: [],
			pos,
			endPos
		};
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

	public addElements(elements: Element[]): boolean {
		return false;
	}

	public addWire(_pos: PIXI.Point, _cornerPos: PIXI.Point, _endPos?: PIXI.Point): Element[] {
		const wire0 = Project.genNewElement(0, _pos.clone(), _cornerPos.clone());
		const wire1 = Project.genNewElement(0, _cornerPos.clone(), _endPos.clone());
		CollisionFunctions.correctPosOrder(wire0.pos, wire0.endPos);
		CollisionFunctions.correctPosOrder(wire1.pos, wire1.endPos);
		if (!this._currState.isFreeSpace(_pos, _cornerPos) || _endPos && !this._currState.isFreeSpace(_cornerPos, _endPos))
			return null;
		this._currState.addElement(wire0);
		this._currState.addElement(wire1);
		this.newState([{ name: 'addWire', element: wire0 }, { name: 'addWire', element: wire1 }]);
		return [wire0, wire1];
	}

	public addElement(typeId: number, pos: PIXI.Point, endPos?: PIXI.Point): Element {
		if (!endPos) {
			const type = ElementProviderService.staticInstance.getElementById(typeId);
			endPos = new PIXI.Point(pos.x + environment.componentWidth,
									pos.y + Math.max(type.numInputs, type.numOutputs));
		}
		CollisionFunctions.correctPosOrder(pos, endPos);
		const elem = Project.genNewElement(typeId, pos, endPos);
		if (!this._currState.isFreeSpace(elem.pos, elem.endPos))
			return null;
		this._currState.addElement(elem);
		this.newState([{
			name: elem.typeId === 0 ? 'addWire' : 'addComp',
			element: elem
		}]);
		return elem;
	}

	public removeElement(element: Element): void {
		this.removeElementById(element.id);
	}

	public removeElementById(id: number): void {
		const elem = this._currState.removeElement(id);
		this.newState([{
			name: elem.typeId === 0 ? 'remWire' : 'remComp',
			element: elem
		}]);
	}

	public moveElementsById(ids: number[], dif: PIXI.Point): boolean {
		const elements = this._currState.getElementsById(ids);
		if (!this._currState.allSpacesFree(elements, dif))
			return false;
		for (const elem of elements) {
			this._currState.moveElement(elem, dif);
		}
		const action: Action = {
			name: 'movMult',
			others: elements,
			pos: dif
		};
		this.newState([action]);
		this.changeSubject.next([action]);
		return true;
	}

	public connectWires(pos: PIXI.Point): void {
		const wiresToConnect = this._currState.wiresOnPoint(pos);
		if (wiresToConnect.length !== 2) {
			console.log('tf you doin while connecting?');
			console.log(wiresToConnect);
			return;
		}
		const newWires = this.currState.connectWires(wiresToConnect[0], wiresToConnect[1], pos);
		this.newState([{
			name: 'conWire',
			pos
		}]);
		this.changeSubject.next(Project.connectWiresToActions(wiresToConnect, newWires));
	}

	public disconnectWires(pos: PIXI.Point): void {
		const wiresOnPoint = this._currState.wiresOnPoint(pos);
		if (wiresOnPoint.length !== 4) {
			console.log('tf you doin while disconnecting?');
			console.log(wiresOnPoint);
			return;
		}
		const newWires = this._currState.disconnectWires(wiresOnPoint);
		this.newState([{
			name: 'dcoWire',
			pos
		}]);
		this.changeSubject.next(Project.connectWiresToActions(wiresOnPoint, newWires));
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
		const backActions = Project.reverseActions(this._actions[this._currActionPointer]);
		for (const backAction of backActions) {
			Project.applyAction(this._currState, backAction);
		}
		this._currActionPointer--;
		this.changeSubject.next(backActions);
		return backActions;
	}

	public stepForward(): Action[] {
		if (this._currActionPointer >= this.MAX_ACTIONS || this._currActionPointer === this._currMaxActionPointer)
			return;
		Project.applyActions(this._currState, this._actions[++this._currActionPointer]);
		const outActions = this._actions[this._currActionPointer];
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
