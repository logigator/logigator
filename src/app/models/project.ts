import {ProjectState} from './project-state';
import {Action, ActionType} from './action';
import {Component} from './component';
import {Chunk} from './chunk';
import {Observable, Subject} from 'rxjs';
import * as PIXI from 'pixi.js';

export class Project {

	private static readonly REVERSE_ACTION: Map<ActionType, ActionType> = new Map([
		['addComp', 'remComp'],
		['addWire', 'remWire'],
		['addText', 'remText'],
		['remComp', 'addComp'],
		['remWire', 'addWire'],
		['remText', 'addText'],
		['movComp', 'movComp'],
		['movWire', 'movWire'],
		['movText', 'movText'],
		['conWire', 'remWire'],
		['setComp', 'setComp']
	]);

	private MAX_ACTIONS = 2;

	private _id: number;
	private _name: string;

	private _actions: Action[];
	private _currActionPointer: number;

	private _currState: ProjectState;

	private changeSubject: Subject<Action>;

	public constructor(projectState: ProjectState) {
		this._currState = projectState;
		this._actions = [];
		for (let i = 0; i < this.MAX_ACTIONS; i++)
			this._actions.push(null);
		this._currActionPointer = -1;
		this.changeSubject = new Subject<Action>();
	}

	protected static applyAction(projectState: ProjectState, action: Action): void {
		switch (action.name) {
			case 'addComp':
			case 'addWire':
				projectState.addComponent(action.component);
				break;
			case 'remComp':
			case 'remWire':
				projectState.removeComponent(action.component.id);
				break;
			case 'movComp':
			case 'movWire':
				projectState.moveComponent(action.component, action.pos);
				break;
		}
	}

	protected static reverseAction(action: Action): Action {
		const revAction = {...action};
		revAction.name = Project.REVERSE_ACTION.get(action.name);
		return revAction;
	}

	// TODO test return id
	public addComponent(typeId: number, pos: PIXI.Point): Component {
		const comp = {
			id: -1,
			typeId,
			inputs: [],
			outputs: [],
			pos
		};
		this._currState.addComponent(comp);
		this.newState({
			name: 'addComp',
			component: comp
		});
		return comp;
	}

	public removeComponent(component: Component): void {
		this.removeComponentById(component.id);
	}

	public removeComponentById(id: number): void {
		const comp = this._currState.removeComponent(id);
		this.newState({
			name: 'remComp',
			component: comp
		});
	}

	public moveComponent(component: Component, dif: PIXI.Point): void {
		this.newState({
			name: 'movComp',
			component,
			pos: dif
		});
	}

	public moveComponentById(id: number, dif: PIXI.Point): void {
		this.moveComponent(this._currState.getComponentById(id), dif);
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
		Project.applyAction(this._currState, Project.reverseAction(this._actions[this._currActionPointer]));
		this._currActionPointer--;
		return [];
	}

	public stepForward(): Action[] {
		if (this._currActionPointer >= this.MAX_ACTIONS || !this._actions[this._currActionPointer + 1])
			return;
		Project.applyAction(this._currState, this._actions[++this._currActionPointer]);
		// Project.applyAction(this._currState, this._actions[++this._currActionPointer]);
		return [];
	}

	public onScreenChunks(startPos: PIXI.Point, endPos: PIXI.Point): {x: number, y: number}[] {
		return this.currState.onScreenChunks(startPos, endPos);
	}

	public getChunks(): Chunk[][] {
		return this.currState.chunks;
	}

	get changes(): Observable<Action> {
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
