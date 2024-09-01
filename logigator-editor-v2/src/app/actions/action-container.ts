import { Action } from './action';
import { Project } from '../project/project';

export class ActionContainer extends Action {
	private readonly actions: Action[];

	constructor(...actions: Action[]) {
		super();
		this.actions = actions;
	}

	public do(project: Project): void {
		for (const action of this.actions) {
			action.do(project);
		}
	}

	public undo(project: Project): void {
		for (let i = this.actions.length - 1; i >= 0; i--) {
			this.actions[i].undo(project);
		}
	}

	public add(action: Action): void {
		this.actions.push(action);
	}

	public get length(): number {
		return this.actions.length;
	}
}
