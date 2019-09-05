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
		['conWire', ['remWire']],
		['setComp', ['setComp']]
	]);

	private MAX_ACTIONS = 2;

	private _id: number;
	private _name: string;

	private _actions: Action[];
	private _currActionPointer: number;

	private _currState: ProjectState;

	private changeSubject: Subject<Action[]>;

	public constructor(projectState: ProjectState) {
		this._currState = projectState;
		this._actions = [];
		for (let i = 0; i < this.MAX_ACTIONS; i++)
			this._actions.push(null);
		this._currActionPointer = -1;
		this.changeSubject = new Subject<Action[]>();
	}


	public static chunksToRender(startPos: PIXI.Point, endPos: PIXI.Point): {x: number, y: number}[] {
		// TODO return all chunks to render
		return Project.onScreenChunks(startPos, endPos);
	}

	// TODO auslagern
	public static onScreenChunks(startPos: PIXI.Point, endPos: PIXI.Point): {x: number, y: number}[] {
		const out: {x: number, y: number}[] = [];
		const startChunkX = Project.gridPosToChunk(startPos.x);
		const startChunkY = Project.gridPosToChunk(startPos.y);
		const endChunkX = Project.gridPosToChunk(endPos.x);
		const endChunkY = Project.gridPosToChunk(endPos.y);
		for (let x = startChunkX; x <= endChunkX; x++)
			for (let y = startChunkY; y <= endChunkY; y++)
				if ((x < endChunkX || endPos.x % environment.chunkSize !== 0) && (y < endChunkY || endPos.y % environment.chunkSize !== 0))
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
				projectState.addElement(action.element);
				break;
			case 'remComp':
			case 'remWire':
				projectState.removeElement(action.element.id);
				break;
			case 'movComp':
			case 'movWire':
				projectState.moveElement(action.element, action.pos);
				break;
		}
	}

	// TODO make the complicated ones like connectWire
	protected static reverseAction(action: Action): Action[] {
		const revAction = [{...action}];
		revAction[0].name = Project.REVERSE_ACTION.get(action.name)[0];
		return revAction;
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
			name: 'addComp',
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
			name: 'remComp',
			element: elem
		});
	}

	public moveElement(element: Element, dif: PIXI.Point): void {
		this.newState({
			name: 'movComp',
			element,
			pos: dif
		});
	}

	public moveElementById(id: number, dif: PIXI.Point): void {
		this.moveElement(this._currState.getElementById(id), dif);
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
