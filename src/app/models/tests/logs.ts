import {Project} from '../project';
import * as PIXI from 'pixi.js';

export class Log {

	private readonly _project: Project;

	private readonly _isReading: boolean;

	private readonly _names: string[];
	private readonly _args: any[];

	constructor(project: Project, isReading: boolean, dataString?: string) {
		this._project = project;
		this._isReading = isReading;
		this._names = [];
		this._args = [];
		if (dataString) {
			const data = JSON.parse(dataString);
			this._names = data[0];
			this._args = data[1];
		}
	}

	private static correctType(arg: any): any {
		if (arg && arg.x)
			return new PIXI.Point(arg.x, arg.y);
		return arg;
	}

	public call(name: string, args: any): void {
		if (this._isReading) {
			this._names.push(name);
			this._args.push(args);
		}
	}

	public doAllCalls(printing?: boolean): void {
		for (let i = 0; i < this._args.length; i++) {
			this.doCall(i, printing);
		}
	}

	public doCall(index: number, printing?: boolean): void {
		const name = this._names[index];
		const args = this._args[index];
		const arr = [];
		for (const p in args)
			arr.push(Log.correctType(args[p]));
		if (printing)
			console.log('calling', name, 'with', ...arr);
		this._project[name](...arr);
	}

	public stringify(): string {
		const relevant = [this._names, this._args];
		return JSON.stringify(relevant, (k, v) => v === undefined ? null : v);
	}
}

export abstract class ManuallyLogged {

	// paste copied Log.stringify data here
	// tslint:disable-next-line:max-line-length
	public static firstAllRound = '[["addWire","addElement","toggleWireConnection","moveElementsById"],[{"0":{"x":9,"y":5},"1":{"x":9,"y":5},"2":{"x":9,"y":26}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":15,"y":15},"5":{"x":3,"y":15}},{"0":{"x":9,"y":15}},{"0":[1,4,3,5],"1":{"x":4,"y":-4}}]]';
}
