import { Action } from '../action';
import { Project } from '../../project/project';

export class ChangeOptionAction<T = unknown> extends Action {
	constructor(
		private readonly componentId: number,
		private readonly optionKey: string,
		private readonly oldValue: T,
		private readonly newValue: T
	) {
		super();
	}

	do(project: Project): void {
		this._set(project, this.newValue);
	}

	undo(project: Project): void {
		this._set(project, this.oldValue);
	}

	private _set(project: Project, value: T): void {
		const option = project.getComponentById(this.componentId)?.options[
			this.optionKey
		];
		if (!option) return;
		option.value = value;
	}
}
