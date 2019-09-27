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
	public static firstAllRound = '[["addElement","addElement","toggleWireConnection","addElement","addElement","addElement","addElement","addElement","addElement","moveElementsById","moveElementsById","stepBack","addElement","addElement","addElement","addElement","addElement","addElement","addElement","addElement","addElement","addElement","addElement","addElement","rotateComponent","rotateComponent","moveElementsById"],[{"0":0,"1":null,"2":0,"3":0,"4":{"x":10,"y":4},"5":{"x":10,"y":22}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":2,"y":12},"5":{"x":17,"y":12}},{"0":{"x":10,"y":12}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":24,"y":5},"5":{"x":24,"y":22}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":31,"y":19},"5":{"x":24,"y":19}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":31,"y":17},"5":{"x":24,"y":17}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":31,"y":15},"5":{"x":24,"y":15}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":31,"y":12},"5":{"x":24,"y":12}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":31,"y":8},"5":{"x":24,"y":8}},{"0":[6,8,10,12,14],"1":{"x":0,"y":-2}},{"0":[16],"1":{"x":5,"y":-1}},{},{"0":0,"1":null,"2":0,"3":0,"4":{"x":44,"y":6},"5":{"x":44,"y":22}},{"0":3,"1":0,"2":2,"3":1,"4":{"x":45,"y":22}},{"0":3,"1":0,"2":2,"3":1,"4":{"x":45,"y":20}},{"0":3,"1":0,"2":2,"3":1,"4":{"x":42,"y":17}},{"0":3,"1":0,"2":2,"3":1,"4":{"x":45,"y":13}},{"0":3,"1":0,"2":2,"3":1,"4":{"x":42,"y":10}},{"0":3,"1":0,"2":2,"3":1,"4":{"x":45,"y":7}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":54,"y":15},"5":{"x":70,"y":15}},{"0":3,"1":1,"2":2,"3":1,"4":{"x":56,"y":13}},{"0":3,"1":1,"2":2,"3":1,"4":{"x":59,"y":16}},{"0":3,"1":0,"2":2,"3":1,"4":{"x":63,"y":13}},{"0":3,"1":0,"2":2,"3":1,"4":{"x":66,"y":16}},{"0":40,"1":3},{"0":41,"1":1},{"0":[1,3,2,4,11,6,8,10,12,14,7,17,5,18,16,24,25,26,27,28,29,30,31,19,32,33,35,34,37,36,39,20,21,22,23,40,41,38,42,44,43,45],"1":{"x":0,"y":2}}]]';
}
