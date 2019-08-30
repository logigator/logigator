import {ProjectState} from './project-state';
import {ProjectModel} from './project-model';
import {Action} from './action';

export class Project {

	private MAX_ACTIONS = 10;

	private id: number;
	private name: string;

	private oldState: ProjectState;
	private actions: Action[];

	private currState: ProjectState;

	public static applyAction(projectState: ProjectState, action: Action): void {
		switch (action.name) {
			case 'addComp':
				projectState.addComponent(action.objId, action.posX, action.posY);
				break;
			case 'remComp':
				projectState.removeComponent(action.objId);
				break;
		}
	}

	public newState(action: Action): void {
		this.actions.push(action);
		Project.applyAction(this.oldState, this.actions[0]);
		this.actions.slice(1, this.actions.length);
		Project.applyAction(this.currState, action);
	}
}
