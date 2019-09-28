import {Project} from '../../src/app/models/project';
import {BoardRecorder, ManuallyLogged} from './logs';

export class Test {

	private readonly _name: string;
	private readonly _project: Project;
	private _log: BoardRecorder;

	constructor(name: string, project?: Project) {
		this._name = name;
		this._project = project || Project.empty();
	}

	public static runAndCheck(name: string, printing?: boolean): void {
		if (!ManuallyLogged.hasOwnProperty(name)) {
			console.log(`Log ${name} does not exist`);
			return;
		}
		const test = new Test(name);
		test.runLoggedTests(ManuallyLogged[name], printing);
		test.checkEquality();
	}

	public runLoggedTests(testData: string, printing?: boolean): void {
		this._log = new BoardRecorder(this._project, false, testData);
		this._log.doAllCalls(printing);
	}

	public checkEquality(): void {
		if (this._project.currState.equals(this._log.expectedState)) {
			console.log(`${this._name} succeeded`);
		} else {
			console.log(`${this._name} failed`);
			console.log('expected', this._log.expectedState);
			console.log('received', this._project.currState);
		}
	}

}
