import {Project} from '../project';
import {Log} from './logs';

export class Test {

	private _project: Project;

	constructor(project?: Project) {
		this._project = project || Project.empty();
	}

	public runLoggedTests(testData: string, printing?: boolean): void {
		const log = new Log(this._project, false, testData);
		log.doAllCalls(printing);
	}

}
