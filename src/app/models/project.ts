import {ProjectState} from './project-state';
import {Action, ActionType} from './action';
import {Element} from './element';
import {Chunk} from './chunk';
import {Observable, Subject} from 'rxjs';
import * as PIXI from 'pixi.js';
import {environment} from '../../environments/environment';

export class Project {

	private static readonly REVERSE_ACTION: Map<ActionType, ActionType[]> = new Map<ActionType, ActionType[]>([
		['addComp', ['remComp']],
		['addWire', ['remWire']],
		['addText', ['remText']],
		['remComp', ['addComp']],
		['remWire', ['addWire']],
		['remText', ['addText']],
		['movComp', ['movComp']],
		['movWire', ['movWire']],
		['movText', ['movText']],
		['conWire', ['dcoWire']],
		['dcoWire', ['conWire']],
		['setComp', ['setComp']]
	]);

	private MAX_ACTIONS = 2000;

	private _id: number;
	private _name: string;

	private _actions: Action[];
	private _currActionPointer: number;

	private _currState: ProjectState;

	private changeSubject: Subject<Action[]>;

	public constructor(projectState: ProjectState, id?: number) {
		this._currState = projectState;
		this._id = id;
		this._actions = [];
		for (let i = 0; i < this.MAX_ACTIONS; i++)
			this._actions.push(null);
		this._currActionPointer = -1;
		this.changeSubject = new Subject<Action[]>();
	}

	// TODO auslagern
	public static isPointOnWire(wire: Element, point: PIXI.Point): boolean {
		return point.y === wire.pos.y && point.y === wire.endPos.y &&
			(point.x >= wire.pos.x && point.x <= wire.endPos.x || point.x <= wire.pos.x && point.x >= wire.endPos.x)
			||
			point.x === wire.pos.x && point.x === wire.endPos.x &&
			(point.y >= wire.pos.y && point.y <= wire.endPos.y || point.y <= wire.pos.y && point.y >= wire.endPos.y);
	}

	// TODO auslagern
	public static isPointOnWireNoEdge(wire: Element, point: PIXI.Point): boolean {
		return point.y === wire.pos.y && point.y === wire.endPos.y &&
			(point.x > wire.pos.x && point.x < wire.endPos.x || point.x < wire.pos.x && point.x > wire.endPos.x)
			||
			point.x === wire.pos.x && point.x === wire.endPos.x &&
			(point.y > wire.pos.y && point.y < wire.endPos.y || point.y < wire.pos.y && point.y > wire.endPos.y);
	}

	// TODO auslagern
	public static isHorizontal(wire: Element): boolean {
		return wire.pos.y === wire.endPos.y;
	}

	// TODO auslagern
	public static isVertical(wire: Element): boolean {
		return wire.pos.x === wire.endPos.x;
	}


	// TODO auslagern
	public static inRectChunks(startPos: PIXI.Point, endPos: PIXI.Point): {x: number, y: number}[] {
		const out: {x: number, y: number}[] = [];
		const startChunkX = Project.gridPosToChunk(startPos.x);
		const startChunkY = Project.gridPosToChunk(startPos.y);
		const endChunkX = Project.gridPosToChunk(endPos.x);
		const endChunkY = Project.gridPosToChunk(endPos.y);
		for (let x = startChunkX; x <= endChunkX; x++)
			for (let y = startChunkY; y <= endChunkY; y++)
				// if ((x < endChunkX || endPos.x % environment.chunkSize !== 0) && (y < endChunkY || endPos.y % environment.chunkSize !== 0))
				out.push({x, y});
		return out;
	}

	// TODO auslagern
	public static gridPosToChunk(pos: number): number {
		return Math.floor(pos / environment.chunkSize);
	}

	protected static applyActions(projectState: ProjectState, actions: Action[]): void {
		for (const action of actions) {
			Project.applyAction(projectState, action);
		}
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
			case 'movComp':
			case 'movWire':
				projectState.moveElement(action.element, action.pos);
				break;
			case 'conWire':
				projectState.connectWires(action.element, action.element1, action.pos);
				break;
		}
	}

	// TODO make the complicated ones like connectWire
	protected static reverseAction(action: Action): Action[] {
		const revActions = [{...action}];
		revActions[0].name = Project.REVERSE_ACTION.get(action.name)[0];
		for (const revAction of revActions) {
			revAction.pos = action.pos ? action.pos.clone() : undefined;
			revAction.endPos = action.endPos ? action.endPos.clone() : undefined;
			if (revAction.name === 'movComp' || revAction.name === 'movWire') {
				revAction.pos.x *= -1;
				revAction.pos.y *= -1;
			} else if (revAction.name === 'conWire') {
				// TODO
			}
		}
		return revActions;
	}


	private static connectWiresToActions(oldWires, newWires): Action[] {
		const outActions: Action[] = [
			{
				name: 'remComp',
				element: oldWires[0]
			},
			{
				name: 'remComp',
				element: oldWires[1]
			}
		];
		for (const newWire of newWires) {
			outActions.push({
				name: 'addComp',
				element: newWire
			});
		}
		return outActions;
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
		const out = Project.inRectChunks(start, end);
		for (const chunk of this._currState.chunksFromCoords(out)) {
			for (const elem of chunk.elements) {
				const chunkX = Project.gridPosToChunk(elem.pos.x);
				const chunkY = Project.gridPosToChunk(elem.pos.y);
				if (!out.find(c => c.x === chunkX && c.y === chunkY))
					out.push({x: chunkX, y: chunkY});
			}
		}
		return out;
	}

	public addElement(typeId: number, pos: PIXI.Point, endPos?: PIXI.Point): Element {
		const elem = {
			id: -1,
			typeId,
			inputs: [],
			outputs: [],
			pos,
			endPos
		};
		this._currState.addElement(elem);
		this.newState({
			name: elem.typeId === 0 ? 'addWire' : 'addComp',
			element: elem
		});
		return elem;
	}

	public removeElement(element: Element): void {
		this.removeElementById(element.id);
	}

	public removeElementById(id: number): void {
		const elem = this._currState.removeElement(id);
		this.newState({
			name: elem.typeId === 0 ? 'remWire' : 'remComp',
			element: elem
		});
	}

	public moveElement(elem: Element, dif: PIXI.Point): void {
		this.currState.moveElement(elem, dif);
		this.newState({
			name: elem.typeId === 0 ? 'movWire' : 'movComp',
			element: elem,
			pos: dif
		});
	}

	public moveElementById(id: number, dif: PIXI.Point): void {
		this.moveElement(this._currState.getElementById(id), dif);
	}

	public connectWires(pos: PIXI.Point): void {
		const wiresToConnect = this.wiresOnPoint(pos);
		if (wiresToConnect.length !== 2) {
			console.log('tf you doin?');
			console.log(wiresToConnect);
			return;
		}
		const newWires = this.currState.connectWires(wiresToConnect[0], wiresToConnect[1], pos);
		this.newState({
			name: 'conWire',
			element: wiresToConnect[0],
			element1: wiresToConnect[1],
			pos
		});
		this.changeSubject.next(Project.connectWiresToActions(wiresToConnect, newWires));
	}

	private wiresOnPoint(pos: PIXI.Point): Element[] {
		const chunkX = Project.gridPosToChunk(pos.x);
		const chunkY = Project.gridPosToChunk(pos.y);
		const outWires: Element[] = [];
		for (const elem of this.getChunks()[chunkX][chunkY].elements) {
			if (elem.typeId === 0 && Project.isPointOnWire(elem, pos))
				outWires.push(elem);
		}
		return outWires;
	}

	private newState(action: Action): void {
		// Project.applyAction(this._currState, action);
		if (this._currActionPointer >= this.MAX_ACTIONS) {
			// Project.applyAction(this._oldState, this._actions[0]);
			this._actions.shift();
		} else {
			this._currActionPointer++;
		}
		this._actions[this._currActionPointer] = action;
	}

	public stepBack(): Action[] {
		if (this._currActionPointer < 0)
			return;
		const backActions = Project.reverseAction(this._actions[this._currActionPointer]);
		for (const backAction of backActions) {
			Project.applyAction(this._currState, backAction);
		}
		this._currActionPointer--;
		this.changeSubject.next(backActions);
		return backActions;
	}

	public stepForward(): Action[] {
		if (this._currActionPointer >= this.MAX_ACTIONS || !this._actions[this._currActionPointer + 1])
			return;
		Project.applyAction(this._currState, this._actions[++this._currActionPointer]);
		const outActions = [this._actions[this._currActionPointer]];
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
