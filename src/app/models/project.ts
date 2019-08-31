import {ProjectState} from './project-state';
import {ProjectModel} from './project-model';
import {Action} from './action';
import {ComponentProviderService} from '../services/component-provider/component-provider.service';

export class Project {

	private MAX_ACTIONS = 2;

	private id: number;
	private name: string;

	private _oldState: ProjectState;
	private actions: Action[];
	private currActionPointer: number;

	private _currState: ProjectState;

	public constructor(private compProvService: ComponentProviderService, projectState: ProjectState) {
		this._oldState = projectState;
		this._currState = projectState.copy();
		this.actions = [];
		for (let i = 0; i < this.MAX_ACTIONS; i++)
			this.actions.push(null);
		this.currActionPointer = -1;
	}

	public static applyAction(projectState: ProjectState, action: Action): void {
		switch (action.name) {
			case 'addComp':
			case 'addWire':
				projectState.addComponent(action.component);
				break;
			case 'remComp':
			case 'remWire':
				projectState.removeComponent(action.component);
				break;
			case 'movComp':
			case 'movWire':
				projectState.moveComponent(action.component, action.posX, action.posY);
				break;
		}
	}

	public newState(action: Action): void {
		Project.applyAction(this._currState, action);
		if (this.currActionPointer >= this.MAX_ACTIONS) {
			Project.applyAction(this._oldState, this.actions[0]);
			this.actions.shift();
		} else {
			this.currActionPointer++;
		}
		this.actions[this.currActionPointer] = action;
	}

	public stepBack(): void {
		if (this.currActionPointer < 0)
			return;
		this.currActionPointer--;
		this._currState = this._oldState.copy();
		for (let i = 0; i <= this.currActionPointer; i++) {
			Project.applyAction(this._currState, this.actions[i]);
		}
	}

	public stepForward(): void {
		if (this.currActionPointer >= this.MAX_ACTIONS)
			return;
		Project.applyAction(this._currState, this.actions[++this.currActionPointer]);
	}

	get oldState(): ProjectState {
		return this._oldState;
	}

	get currState(): ProjectState {
		return this._currState;
	}
}
