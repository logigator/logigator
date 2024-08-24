import { Project } from '../project/project';

export abstract class Action {
	abstract do(project: Project): void;
	abstract undo(project: Project): void;
}
