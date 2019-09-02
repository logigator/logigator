import {ProjectState} from './project-state';
import {Action} from './action';
import {ComponentProviderService} from '../services/component-provider/component-provider.service';
import {Component} from './component';
import {Chunk} from './chunk';

export class Project {
	private MAX_ACTIONS = 2;

	private _id: number;
	private _name: string;

	private _oldState: ProjectState;
	private _actions: Action[];
	private _currActionPointer: number;

	private _currState: ProjectState;

	public constructor(private compProvService: ComponentProviderService, projectState: ProjectState) {
		this._oldState = projectState;
		this._currState = projectState.copy();
		this._actions = [];
		for (let i = 0; i < this.MAX_ACTIONS; i++)
			this._actions.push(null);
		this._currActionPointer = -1;
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
				projectState.moveComponent(action.component, action.posX, action.posY);
				break;
		}
	}

	public addComponent(typeId: number, posX: number, posY: number): void {
		this.newState({
			name: 'addComp',
			component: {
				id: -1,
				typeId,
				inputs: [],
				outputs: [],
				posX,
				posY
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

	public moveComponent(component: Component): void {
		this.newState({
			name: 'movComp',
			component
		});
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
		if (this._currActionPointer >= this.MAX_ACTIONS)
			return;
		Project.applyAction(this._currState, this._actions[++this._currActionPointer]);
	}

	public getChunks(): Chunk[][] {
		return this.currState.chunks;
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
