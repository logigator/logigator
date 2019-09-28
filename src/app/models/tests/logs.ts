import {Project} from '../project';
import * as PIXI from 'pixi.js';
import {ProjectState} from '../project-state';

export class Log {

	private readonly _project: Project;

	private readonly _isReading: boolean;

	private readonly _names: string[];
	private readonly _args: any[];

	private readonly _expectedState: ProjectState;

	constructor(project: Project, isReading: boolean, dataString?: string) {
		this._project = project;
		this._isReading = isReading;
		this._names = [];
		this._args = [];
		if (dataString) {
			const data = JSON.parse(dataString);
			this._names = data[0];
			this._args = data[1];
			this._expectedState = data[2];
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
		const relevant = [this._names, this._args, this._project.currState];
		return JSON.stringify(relevant, (k, v) => v === undefined ? null : v);
	}

	get expectedState(): ProjectState {
		return this._expectedState;
	}
}

export abstract class ManuallyLogged {

	// paste copied Log.stringify data here
	// tslint:disable-next-line:max-line-length
	public static autoConnect = '[["addElement","addElement","toggleWireConnection","moveElementsById","addElement","addElement","addElement","addElement","addElement","addElement","addElement","moveElementsById","addElement","addElement","addElement","addElement","moveElementsById","moveElementsById","addElement","addElement","rotateComponent","rotateComponent","moveElementsById","addElement","addElement","toggleWireConnection","moveElementsById","moveElementsById","toggleWireConnection"],[{"0":0,"1":null,"2":0,"3":0,"4":{"x":9,"y":5},"5":{"x":9,"y":24}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":1,"y":14},"5":{"x":16,"y":14}},{"0":{"x":9,"y":14}},{"0":[1,3,2,4],"1":{"x":3,"y":-2}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":26,"y":3},"5":{"x":26,"y":22}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":34,"y":20},"5":{"x":26,"y":20}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":26,"y":18},"5":{"x":34,"y":18}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":34,"y":16},"5":{"x":26,"y":16}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":26,"y":13},"5":{"x":34,"y":13}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":34,"y":10},"5":{"x":26,"y":10}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":26,"y":6},"5":{"x":34,"y":6}},{"0":[8,10,12,14,16,6],"1":{"x":0,"y":-2}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":40,"y":12},"5":{"x":61,"y":12}},{"0":3,"1":1,"2":2,"3":1,"4":{"x":41,"y":10}},{"0":3,"1":1,"2":2,"3":1,"4":{"x":44,"y":13}},{"0":3,"1":1,"2":2,"3":1,"4":{"x":44,"y":10}},{"0":[23,28],"1":{"x":-1,"y":0}},{"0":[25],"1":{"x":-2,"y":0}},{"0":2,"1":0,"2":2,"3":1,"4":{"x":48,"y":10}},{"0":2,"1":0,"2":2,"3":1,"4":{"x":52,"y":13}},{"0":32,"1":1},{"0":33,"1":1},{"0":[23,28,32],"1":{"x":4,"y":0}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":47,"y":21},"5":{"x":47,"y":35}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":41,"y":28},"5":{"x":52,"y":28}},{"0":{"x":47,"y":28}},{"0":[39],"1":{"x":0,"y":-1}},{"0":[42],"1":{"x":1,"y":0}},{"0":{"x":47,"y":28}}],{"_highestTakenId":42,"specialActions":[],"_model":{"board":{"elements":[{"id":1,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":12,"y":3},"endPos":{"x":12,"y":12},"rotation":0},{"id":3,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":12,"y":12},"endPos":{"x":12,"y":22},"rotation":0},{"id":2,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":4,"y":12},"endPos":{"x":12,"y":12},"rotation":0},{"id":4,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":12,"y":12},"endPos":{"x":19,"y":12},"rotation":0},{"id":6,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":18},"endPos":{"x":34,"y":18},"rotation":0},{"id":8,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":16},"endPos":{"x":34,"y":16},"rotation":0},{"id":10,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":14},"endPos":{"x":34,"y":14},"rotation":0},{"id":11,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":16},"endPos":{"x":26,"y":18},"rotation":0},{"id":12,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":11},"endPos":{"x":34,"y":11},"rotation":0},{"id":14,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":8},"endPos":{"x":34,"y":8},"rotation":0},{"id":16,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":4},"endPos":{"x":34,"y":4},"rotation":0},{"id":7,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":18},"endPos":{"x":26,"y":22},"rotation":0},{"id":18,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":14},"endPos":{"x":26,"y":16},"rotation":0},{"id":19,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":11},"endPos":{"x":26,"y":14},"rotation":0},{"id":20,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":8},"endPos":{"x":26,"y":11},"rotation":0},{"id":13,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":3},"endPos":{"x":26,"y":4},"rotation":0},{"id":21,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":4},"endPos":{"x":26,"y":8},"rotation":0},{"id":23,"typeId":3,"numInputs":2,"numOutputs":1,"pos":{"x":44,"y":10},"endPos":{"x":46,"y":12},"rotation":1},{"id":25,"typeId":3,"numInputs":2,"numOutputs":1,"pos":{"x":42,"y":13},"endPos":{"x":44,"y":15},"rotation":1},{"id":28,"typeId":3,"numInputs":2,"numOutputs":1,"pos":{"x":47,"y":10},"endPos":{"x":49,"y":12},"rotation":1},{"id":31,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":42,"y":12},"endPos":{"x":43,"y":12},"rotation":0},{"id":32,"typeId":2,"numInputs":2,"numOutputs":1,"pos":{"x":52,"y":10},"endPos":{"x":54,"y":12},"rotation":1},{"id":33,"typeId":2,"numInputs":2,"numOutputs":1,"pos":{"x":52,"y":13},"endPos":{"x":54,"y":15},"rotation":1},{"id":35,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":53,"y":12},"endPos":{"x":61,"y":12},"rotation":0},{"id":36,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":52,"y":12},"endPos":{"x":53,"y":12},"rotation":0},{"id":22,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":40,"y":12},"endPos":{"x":42,"y":12},"rotation":0},{"id":34,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":43,"y":12},"endPos":{"x":45,"y":12},"rotation":0},{"id":37,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":45,"y":12},"endPos":{"x":48,"y":12},"rotation":0},{"id":38,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":48,"y":12},"endPos":{"x":52,"y":12},"rotation":0},{"id":39,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":47,"y":20},"endPos":{"x":47,"y":27},"rotation":0},{"id":41,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":47,"y":28},"endPos":{"x":47,"y":35},"rotation":0},{"id":40,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":41,"y":28},"endPos":{"x":47,"y":28},"rotation":0},{"id":42,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":48,"y":28},"endPos":{"x":53,"y":28},"rotation":0}]}},"_chunks":[[{"elements":[{"id":1,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":12,"y":3},"endPos":{"x":12,"y":12},"rotation":0},{"id":3,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":12,"y":12},"endPos":{"x":12,"y":22},"rotation":0},{"id":2,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":4,"y":12},"endPos":{"x":12,"y":12},"rotation":0},{"id":4,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":12,"y":12},"endPos":{"x":19,"y":12},"rotation":0}],"connectionPoints":[{"x":12,"y":12}]},{"elements":[{"id":3,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":12,"y":12},"endPos":{"x":12,"y":22},"rotation":0}],"connectionPoints":[]}],[{"elements":[{"id":11,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":16},"endPos":{"x":26,"y":18},"rotation":0},{"id":6,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":18},"endPos":{"x":34,"y":18},"rotation":0},{"id":8,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":16},"endPos":{"x":34,"y":16},"rotation":0},{"id":10,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":14},"endPos":{"x":34,"y":14},"rotation":0},{"id":12,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":11},"endPos":{"x":34,"y":11},"rotation":0},{"id":14,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":8},"endPos":{"x":34,"y":8},"rotation":0},{"id":16,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":4},"endPos":{"x":34,"y":4},"rotation":0},{"id":7,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":18},"endPos":{"x":26,"y":22},"rotation":0},{"id":18,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":14},"endPos":{"x":26,"y":16},"rotation":0},{"id":19,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":11},"endPos":{"x":26,"y":14},"rotation":0},{"id":20,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":8},"endPos":{"x":26,"y":11},"rotation":0},{"id":13,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":3},"endPos":{"x":26,"y":4},"rotation":0},{"id":21,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":4},"endPos":{"x":26,"y":8},"rotation":0}],"connectionPoints":[{"x":26,"y":18},{"x":26,"y":16},{"x":26,"y":14},{"x":26,"y":11},{"x":26,"y":8},{"x":26,"y":4}]},{"elements":[{"id":7,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":18},"endPos":{"x":26,"y":22},"rotation":0}],"connectionPoints":[]}],[{"elements":[{"id":25,"typeId":3,"numInputs":2,"numOutputs":1,"pos":{"x":42,"y":13},"endPos":{"x":44,"y":15},"rotation":1},{"id":31,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":42,"y":12},"endPos":{"x":43,"y":12},"rotation":0},{"id":33,"typeId":2,"numInputs":2,"numOutputs":1,"pos":{"x":52,"y":13},"endPos":{"x":54,"y":15},"rotation":1},{"id":35,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":53,"y":12},"endPos":{"x":61,"y":12},"rotation":0},{"id":36,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":52,"y":12},"endPos":{"x":53,"y":12},"rotation":0},{"id":23,"typeId":3,"numInputs":2,"numOutputs":1,"pos":{"x":44,"y":10},"endPos":{"x":46,"y":12},"rotation":1},{"id":28,"typeId":3,"numInputs":2,"numOutputs":1,"pos":{"x":47,"y":10},"endPos":{"x":49,"y":12},"rotation":1},{"id":32,"typeId":2,"numInputs":2,"numOutputs":1,"pos":{"x":52,"y":10},"endPos":{"x":54,"y":12},"rotation":1},{"id":22,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":40,"y":12},"endPos":{"x":42,"y":12},"rotation":0},{"id":34,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":43,"y":12},"endPos":{"x":45,"y":12},"rotation":0},{"id":37,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":45,"y":12},"endPos":{"x":48,"y":12},"rotation":0},{"id":38,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":48,"y":12},"endPos":{"x":52,"y":12},"rotation":0}],"connectionPoints":[{"x":43,"y":12},{"x":42,"y":12},{"x":53,"y":12},{"x":52,"y":12},{"x":45,"y":12},{"x":48,"y":12}]},{"elements":[{"id":41,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":47,"y":28},"endPos":{"x":47,"y":35},"rotation":0},{"id":40,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":41,"y":28},"endPos":{"x":47,"y":28},"rotation":0},{"id":39,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":47,"y":20},"endPos":{"x":47,"y":27},"rotation":0},{"id":42,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":48,"y":28},"endPos":{"x":53,"y":28},"rotation":0}],"connectionPoints":[]}],[{"elements":[{"id":35,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":53,"y":12},"endPos":{"x":61,"y":12},"rotation":0}],"connectionPoints":[]}]]}]';
}
