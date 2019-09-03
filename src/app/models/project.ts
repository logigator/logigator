import {ProjectState} from './project-state';
import {Action} from './action';
import {Component} from './component';
import {Chunk} from './chunk';
import {Observable, Subject} from 'rxjs';

export class Project {
	private MAX_ACTIONS = 2;

	private _id: number;
	private _name: string;

	private _oldState: ProjectState;
	private _actions: Action[];
	private _currActionPointer: number;

	private _currState: ProjectState;

	private changeSubject: Subject<any>;

	public constructor(projectState: ProjectState) {
		this._oldState = projectState;
		this._currState = projectState.copy();
		this._actions = [];
		for (let i = 0; i < this.MAX_ACTIONS; i++)
			this._actions.push(null);
		this._currActionPointer = -1;
		this.changeSubject = new Subject<any>();
	}

	protected static applyAction(projectState: ProjectState, action: Action): void {
		switch (action.name) {
			case 'addComp':
			case 'addWire':
				projectState.addComponent(action.component);
				break;
			case 'remComp':
			case 'remWire':
				projectState.removeComponent(action.id);
				break;
			case 'movComp':
			case 'movWire':
				projectState.moveComponent(action.component, action.pos);
				break;
		}
	}

	// TODO return component
	public addComponent(typeId: number, pos: PIXI.Point): void {
		this.newState({
			name: 'addComp',
			component: {
				id: -1,
				typeId,
				inputs: [],
				outputs: [],
				pos
			}
		});
	}

	public removeComponent(component: Component): void {
		this.removeComponentById(component.id);
	}

	public removeComponentById(id: number): void {
		this.newState({
			name: 'remComp',
			id
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
		Project.applyAction(this._currState, action);
		if (this._currActionPointer >= this.MAX_ACTIONS) {
			Project.applyAction(this._oldState, this._actions[0]);
			this._actions.shift();
		} else {
			this._currActionPointer++;
		}
		this._actions[this._currActionPointer] = action;
	}

	public stepBack(): void {
		if (this._currActionPointer < 0)
			return;
		this._currActionPointer--;
		this._currState = this._oldState.copy();
		for (let i = 0; i <= this._currActionPointer; i++) {
			Project.applyAction(this._currState, this._actions[i]);
		}
	}

	public stepForward(): void {
		if (this._currActionPointer >= this.MAX_ACTIONS || !this._actions[this._currActionPointer + 1])
			return;
		Project.applyAction(this._currState, this._actions[++this._currActionPointer]);
	}

	public onScreenChunks(startPos: PIXI.Point, endPos: PIXI.Point): {x: number, y: number}[] {
		return this.currState.onScreenChunks(startPos, endPos);
	}

	public getChunks(): Chunk[][] {
		return this.currState.chunks;
	}

	get changes(): Observable<any> {
		return this.changeSubject.asObservable();
	}

	get oldState(): ProjectState {
		return this._oldState;
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
