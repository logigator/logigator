import {Project} from '../../src/app/models/project';
import * as PIXI from 'pixi.js';
import {ProjectState} from '../../src/app/models/project-state';
import {CollisionFunctions} from '../../src/app/models/collision-functions';
import {Elements} from '../../src/app/models/element';

export class BoardRecorder {

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

	private correctType(arg: any): any {
		if (arg && arg.x)
			return new PIXI.Point(arg.x, arg.y);
		if (arg && arg[0] && arg[0].x && arg[1].x) {
			for (const elem of this._project.allElements) {
				if (CollisionFunctions.isElementInFloatRect(elem, arg[0], arg[1])) {
					return elem.id;
				}
			}
		}
		if (arg && arg[0] && arg[0][0] && arg[0][0].x && arg[0][1].x) {
			const ids: number[] = [];
			for (const elem of this._project.allElements) {
				for (const pos of arg) {
					if (elem.pos.x === pos[0].x && elem.pos.y === pos[0].y &&
						elem.endPos.x === pos[1].x && elem.endPos.y === pos[1].y) {
						ids.push(elem.id);
					}
				}
			}
			if (ids.length !== arg.length)
				console.log('something happened');
			return ids;
		}
		return arg;
	}

	public call(name: string, _args: any, idIndex?: number, idsIndex?: number): void {
		if (this._isReading) {
			const args = {..._args};
			this._names.push(name);
			this._args.push(args);
			if (idIndex !== undefined && idIndex > -1) {
				const elem = this._project.currState.getElementById(args[idIndex]);
				const positions = [elem.pos.clone(), elem.endPos.clone()];
				Elements.correctPosOrder(positions[0], positions[1]);
				args[idIndex] = positions;
			}
			if (idsIndex !== undefined && idsIndex > -1) {
				for (let i = 0; i < args[idsIndex].length; i++) {
					const elem = this._project.currState.getElementById(args[idsIndex][i]);
					const positions = [elem.pos.clone(), elem.endPos.clone()];
					Elements.correctPosOrder(positions[0], positions[1]);
					args[idsIndex] = [...args[idsIndex]];
					args[idsIndex][i] = positions;
				}
			}
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
			arr.push(this.correctType(args[p]));
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
	// tslint:disable:max-line-length

	public static autoConnect = '[["addElement","addElement","toggleWireConnection","moveElementsById","addElement","addElement","addElement","addElement","addElement","addElement","addElement","moveElementsById","addElement","addElement","addElement","addElement","moveElementsById","moveElementsById","addElement","addElement","rotateComponent","rotateComponent","moveElementsById","addElement","addElement","toggleWireConnection","moveElementsById","moveElementsById","toggleWireConnection"],[{"0":0,"1":null,"2":0,"3":0,"4":{"x":9,"y":5},"5":{"x":9,"y":24}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":1,"y":14},"5":{"x":16,"y":14}},{"0":{"x":9,"y":14}},{"0":[[{"x":9,"y":5},{"x":9,"y":14}],[{"x":9,"y":14},{"x":9,"y":24}],[{"x":1,"y":14},{"x":9,"y":14}],[{"x":9,"y":14},{"x":16,"y":14}]],"1":{"x":3,"y":-2}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":26,"y":3},"5":{"x":26,"y":22}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":34,"y":20},"5":{"x":26,"y":20}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":26,"y":18},"5":{"x":34,"y":18}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":34,"y":16},"5":{"x":26,"y":16}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":26,"y":13},"5":{"x":34,"y":13}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":34,"y":10},"5":{"x":26,"y":10}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":26,"y":6},"5":{"x":34,"y":6}},{"0":[[{"x":26,"y":18},{"x":34,"y":18}],[{"x":26,"y":16},{"x":34,"y":16}],[{"x":26,"y":13},{"x":34,"y":13}],[{"x":26,"y":10},{"x":34,"y":10}],[{"x":26,"y":6},{"x":34,"y":6}],[{"x":26,"y":20},{"x":34,"y":20}]],"1":{"x":0,"y":-2}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":40,"y":12},"5":{"x":61,"y":12}},{"0":3,"1":1,"2":2,"3":1,"4":{"x":41,"y":10}},{"0":3,"1":1,"2":2,"3":1,"4":{"x":44,"y":13}},{"0":3,"1":1,"2":2,"3":1,"4":{"x":44,"y":10}},{"0":[[{"x":41,"y":10},{"x":43,"y":12}],[{"x":44,"y":10},{"x":46,"y":12}]],"1":{"x":-1,"y":0}},{"0":[[{"x":44,"y":13},{"x":46,"y":15}]],"1":{"x":-2,"y":0}},{"0":2,"1":0,"2":2,"3":1,"4":{"x":48,"y":10}},{"0":2,"1":0,"2":2,"3":1,"4":{"x":52,"y":13}},{"0":[{"x":48,"y":10},{"x":50,"y":12}],"1":1},{"0":[{"x":52,"y":13},{"x":54,"y":15}],"1":1},{"0":[[{"x":40,"y":10},{"x":42,"y":12}],[{"x":43,"y":10},{"x":45,"y":12}],[{"x":48,"y":10},{"x":50,"y":12}]],"1":{"x":4,"y":0}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":47,"y":21},"5":{"x":47,"y":35}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":41,"y":28},"5":{"x":52,"y":28}},{"0":{"x":47,"y":28}},{"0":[[{"x":47,"y":21},{"x":47,"y":28}]],"1":{"x":0,"y":-1}},{"0":[[{"x":47,"y":28},{"x":52,"y":28}]],"1":{"x":1,"y":0}},{"0":{"x":47,"y":28}}],{"_highestTakenId":42,"specialActions":[],"_model":{"board":{"elements":[{"id":1,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":12,"y":3},"endPos":{"x":12,"y":12},"rotation":0},{"id":3,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":12,"y":12},"endPos":{"x":12,"y":22},"rotation":0},{"id":2,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":4,"y":12},"endPos":{"x":12,"y":12},"rotation":0},{"id":4,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":12,"y":12},"endPos":{"x":19,"y":12},"rotation":0},{"id":6,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":18},"endPos":{"x":34,"y":18},"rotation":0},{"id":8,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":16},"endPos":{"x":34,"y":16},"rotation":0},{"id":10,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":14},"endPos":{"x":34,"y":14},"rotation":0},{"id":11,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":16},"endPos":{"x":26,"y":18},"rotation":0},{"id":12,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":11},"endPos":{"x":34,"y":11},"rotation":0},{"id":14,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":8},"endPos":{"x":34,"y":8},"rotation":0},{"id":16,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":4},"endPos":{"x":34,"y":4},"rotation":0},{"id":7,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":18},"endPos":{"x":26,"y":22},"rotation":0},{"id":18,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":14},"endPos":{"x":26,"y":16},"rotation":0},{"id":19,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":11},"endPos":{"x":26,"y":14},"rotation":0},{"id":20,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":8},"endPos":{"x":26,"y":11},"rotation":0},{"id":13,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":3},"endPos":{"x":26,"y":4},"rotation":0},{"id":21,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":4},"endPos":{"x":26,"y":8},"rotation":0},{"id":23,"typeId":3,"numInputs":2,"numOutputs":1,"pos":{"x":44,"y":10},"endPos":{"x":46,"y":12},"rotation":1},{"id":25,"typeId":3,"numInputs":2,"numOutputs":1,"pos":{"x":42,"y":13},"endPos":{"x":44,"y":15},"rotation":1},{"id":28,"typeId":3,"numInputs":2,"numOutputs":1,"pos":{"x":47,"y":10},"endPos":{"x":49,"y":12},"rotation":1},{"id":31,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":42,"y":12},"endPos":{"x":43,"y":12},"rotation":0},{"id":32,"typeId":2,"numInputs":2,"numOutputs":1,"pos":{"x":52,"y":10},"endPos":{"x":54,"y":12},"rotation":1},{"id":33,"typeId":2,"numInputs":2,"numOutputs":1,"pos":{"x":52,"y":13},"endPos":{"x":54,"y":15},"rotation":1},{"id":35,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":53,"y":12},"endPos":{"x":61,"y":12},"rotation":0},{"id":36,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":52,"y":12},"endPos":{"x":53,"y":12},"rotation":0},{"id":22,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":40,"y":12},"endPos":{"x":42,"y":12},"rotation":0},{"id":34,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":43,"y":12},"endPos":{"x":45,"y":12},"rotation":0},{"id":37,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":45,"y":12},"endPos":{"x":48,"y":12},"rotation":0},{"id":38,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":48,"y":12},"endPos":{"x":52,"y":12},"rotation":0},{"id":39,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":47,"y":20},"endPos":{"x":47,"y":27},"rotation":0},{"id":41,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":47,"y":28},"endPos":{"x":47,"y":35},"rotation":0},{"id":40,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":41,"y":28},"endPos":{"x":47,"y":28},"rotation":0},{"id":42,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":48,"y":28},"endPos":{"x":53,"y":28},"rotation":0}]}},"_chunks":[[{"elements":[{"id":1,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":12,"y":3},"endPos":{"x":12,"y":12},"rotation":0},{"id":3,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":12,"y":12},"endPos":{"x":12,"y":22},"rotation":0},{"id":2,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":4,"y":12},"endPos":{"x":12,"y":12},"rotation":0},{"id":4,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":12,"y":12},"endPos":{"x":19,"y":12},"rotation":0}],"connectionPoints":[{"x":12,"y":12}]},{"elements":[{"id":3,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":12,"y":12},"endPos":{"x":12,"y":22},"rotation":0}],"connectionPoints":[]}],[{"elements":[{"id":11,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":16},"endPos":{"x":26,"y":18},"rotation":0},{"id":6,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":18},"endPos":{"x":34,"y":18},"rotation":0},{"id":8,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":16},"endPos":{"x":34,"y":16},"rotation":0},{"id":10,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":14},"endPos":{"x":34,"y":14},"rotation":0},{"id":12,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":11},"endPos":{"x":34,"y":11},"rotation":0},{"id":14,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":8},"endPos":{"x":34,"y":8},"rotation":0},{"id":16,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":4},"endPos":{"x":34,"y":4},"rotation":0},{"id":7,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":18},"endPos":{"x":26,"y":22},"rotation":0},{"id":18,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":14},"endPos":{"x":26,"y":16},"rotation":0},{"id":19,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":11},"endPos":{"x":26,"y":14},"rotation":0},{"id":20,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":8},"endPos":{"x":26,"y":11},"rotation":0},{"id":13,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":3},"endPos":{"x":26,"y":4},"rotation":0},{"id":21,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":4},"endPos":{"x":26,"y":8},"rotation":0}],"connectionPoints":[{"x":26,"y":18},{"x":26,"y":16},{"x":26,"y":14},{"x":26,"y":11},{"x":26,"y":8},{"x":26,"y":4}]},{"elements":[{"id":7,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":26,"y":18},"endPos":{"x":26,"y":22},"rotation":0}],"connectionPoints":[]}],[{"elements":[{"id":25,"typeId":3,"numInputs":2,"numOutputs":1,"pos":{"x":42,"y":13},"endPos":{"x":44,"y":15},"rotation":1},{"id":31,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":42,"y":12},"endPos":{"x":43,"y":12},"rotation":0},{"id":33,"typeId":2,"numInputs":2,"numOutputs":1,"pos":{"x":52,"y":13},"endPos":{"x":54,"y":15},"rotation":1},{"id":35,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":53,"y":12},"endPos":{"x":61,"y":12},"rotation":0},{"id":36,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":52,"y":12},"endPos":{"x":53,"y":12},"rotation":0},{"id":23,"typeId":3,"numInputs":2,"numOutputs":1,"pos":{"x":44,"y":10},"endPos":{"x":46,"y":12},"rotation":1},{"id":28,"typeId":3,"numInputs":2,"numOutputs":1,"pos":{"x":47,"y":10},"endPos":{"x":49,"y":12},"rotation":1},{"id":32,"typeId":2,"numInputs":2,"numOutputs":1,"pos":{"x":52,"y":10},"endPos":{"x":54,"y":12},"rotation":1},{"id":22,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":40,"y":12},"endPos":{"x":42,"y":12},"rotation":0},{"id":34,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":43,"y":12},"endPos":{"x":45,"y":12},"rotation":0},{"id":37,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":45,"y":12},"endPos":{"x":48,"y":12},"rotation":0},{"id":38,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":48,"y":12},"endPos":{"x":52,"y":12},"rotation":0}],"connectionPoints":[{"x":43,"y":12},{"x":42,"y":12},{"x":53,"y":12},{"x":52,"y":12},{"x":45,"y":12},{"x":48,"y":12}]},{"elements":[{"id":41,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":47,"y":28},"endPos":{"x":47,"y":35},"rotation":0},{"id":40,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":41,"y":28},"endPos":{"x":47,"y":28},"rotation":0},{"id":39,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":47,"y":20},"endPos":{"x":47,"y":27},"rotation":0},{"id":42,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":48,"y":28},"endPos":{"x":53,"y":28},"rotation":0}],"connectionPoints":[]}],[{"elements":[{"id":35,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":53,"y":12},"endPos":{"x":61,"y":12},"rotation":0}],"connectionPoints":[]}]]}]';
	public static mergeAfterRemove = '[["addElement","addElement","toggleWireConnection","removeElementsById","addElement","addElement","addElement","addElement","addElement","addElement","addElement","addElement","addElement","addElement","moveElementsById","removeElementsById","removeElementsById","addElement","addElement","addElement","addElement","addElement","addElement","removeElementsById","addElement","addElement","addElement","addElement","removeElementsById","addElement","addElement","addElement","addElement","removeElementsById","addElement","addElement","addElement","addElement","removeElementsById","addElement","addElement","toggleWireConnection","removeElementsById","removeElementsById","addElement","addElement","toggleWireConnection","removeElementsById","removeElementsById"],[{"0":0,"1":null,"2":0,"3":0,"4":{"x":12,"y":4},"5":{"x":12,"y":15}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":7,"y":10},"5":{"x":16,"y":10}},{"0":{"x":12,"y":10}},{"0":[1,3,2,4]},{"0":0,"1":null,"2":0,"3":0,"4":{"x":23,"y":2},"5":{"x":23,"y":18}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":31,"y":4},"5":{"x":23,"y":4}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":24,"y":6},"5":{"x":30,"y":6}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":29,"y":8},"5":{"x":23,"y":8}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":23,"y":10},"5":{"x":29,"y":10}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":29,"y":12},"5":{"x":23,"y":12}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":23,"y":14},"5":{"x":18,"y":14}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":23,"y":16},"5":{"x":20,"y":16}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":23,"y":5},"5":{"x":19,"y":5}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":23,"y":4},"5":{"x":19,"y":4}},{"0":[8],"1":{"x":-1,"y":0}},{"0":[6,9,11,13,8]},{"0":[15,19,21,17]},{"0":0,"1":null,"2":0,"3":0,"4":{"x":40,"y":4},"5":{"x":40,"y":22}},{"0":3,"1":0,"2":2,"3":1,"4":{"x":38,"y":6}},{"0":3,"1":0,"2":2,"3":1,"4":{"x":38,"y":9}},{"0":3,"1":0,"2":2,"3":1,"4":{"x":38,"y":12}},{"0":3,"1":0,"2":2,"3":1,"4":{"x":38,"y":15}},{"0":3,"1":0,"2":2,"3":1,"4":{"x":38,"y":18}},{"0":[24,26,28,30,32]},{"0":3,"1":0,"2":2,"3":1,"4":{"x":41,"y":6}},{"0":3,"1":0,"2":2,"3":1,"4":{"x":41,"y":11}},{"0":3,"1":0,"2":2,"3":1,"4":{"x":41,"y":15}},{"0":3,"1":0,"2":2,"3":1,"4":{"x":41,"y":19}},{"0":[34,37,40,43]},{"0":0,"1":null,"2":0,"3":0,"4":{"x":15,"y":23},"5":{"x":15,"y":39}},{"0":3,"1":0,"2":2,"3":1,"4":{"x":16,"y":26}},{"0":3,"1":0,"2":2,"3":1,"4":{"x":16,"y":30}},{"0":3,"1":0,"2":2,"3":1,"4":{"x":16,"y":35}},{"0":[46,48,49,51,52,54,55]},{"0":3,"1":0,"2":2,"3":1,"4":{"x":34,"y":29}},{"0":3,"1":2,"2":2,"3":1,"4":{"x":34,"y":33}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":33,"y":27},"5":{"x":33,"y":37}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":36,"y":27},"5":{"x":36,"y":36}},{"0":[56,57]},{"0":0,"1":null,"2":0,"3":0,"4":{"x":64,"y":22},"5":{"x":64,"y":10}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":59,"y":15},"5":{"x":68,"y":15}},{"0":{"x":64,"y":15}},{"0":[66]},{"0":[69]},{"0":0,"1":null,"2":0,"3":0,"4":{"x":55,"y":22},"5":{"x":55,"y":31}},{"0":0,"1":null,"2":0,"3":0,"4":{"x":59,"y":27},"5":{"x":51,"y":27}},{"0":{"x":55,"y":27}},{"0":[72]},{"0":[70]}],{"_highestTakenId":73,"specialActions":[],"_model":{"board":{"elements":[{"id":16,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":23,"y":2},"endPos":{"x":23,"y":18},"rotation":0},{"id":31,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":40,"y":4},"endPos":{"x":40,"y":22},"rotation":0},{"id":47,"typeId":3,"numInputs":2,"numOutputs":1,"pos":{"x":16,"y":26},"endPos":{"x":18,"y":28},"rotation":0},{"id":50,"typeId":3,"numInputs":2,"numOutputs":1,"pos":{"x":16,"y":30},"endPos":{"x":18,"y":32},"rotation":0},{"id":53,"typeId":3,"numInputs":2,"numOutputs":1,"pos":{"x":16,"y":35},"endPos":{"x":18,"y":37},"rotation":0},{"id":58,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":33,"y":27},"endPos":{"x":33,"y":37},"rotation":0},{"id":62,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":36,"y":27},"endPos":{"x":36,"y":36},"rotation":0},{"id":68,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":64,"y":15},"endPos":{"x":64,"y":22},"rotation":0},{"id":67,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":59,"y":15},"endPos":{"x":64,"y":15},"rotation":0},{"id":71,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":51,"y":27},"endPos":{"x":59,"y":27},"rotation":0}]}},"_chunks":[[{"elements":[],"connectionPoints":[]},{"elements":[{"id":47,"typeId":3,"numInputs":2,"numOutputs":1,"pos":{"x":16,"y":26},"endPos":{"x":18,"y":28},"rotation":0},{"id":50,"typeId":3,"numInputs":2,"numOutputs":1,"pos":{"x":16,"y":30},"endPos":{"x":18,"y":32},"rotation":0},{"id":53,"typeId":3,"numInputs":2,"numOutputs":1,"pos":{"x":16,"y":35},"endPos":{"x":18,"y":37},"rotation":0}],"connectionPoints":[]}],[{"elements":[{"id":16,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":23,"y":2},"endPos":{"x":23,"y":18},"rotation":0}],"connectionPoints":[]},{"elements":[{"id":58,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":33,"y":27},"endPos":{"x":33,"y":37},"rotation":0},{"id":62,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":36,"y":27},"endPos":{"x":36,"y":36},"rotation":0}],"connectionPoints":[]}],[{"elements":[{"id":31,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":40,"y":4},"endPos":{"x":40,"y":22},"rotation":0},{"id":67,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":59,"y":15},"endPos":{"x":64,"y":15},"rotation":0}],"connectionPoints":[]},{"elements":[{"id":31,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":40,"y":4},"endPos":{"x":40,"y":22},"rotation":0},{"id":71,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":51,"y":27},"endPos":{"x":59,"y":27},"rotation":0}],"connectionPoints":[]}],[{"elements":[{"id":68,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":64,"y":15},"endPos":{"x":64,"y":22},"rotation":0},{"id":67,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":59,"y":15},"endPos":{"x":64,"y":15},"rotation":0}],"connectionPoints":[]},{"elements":[{"id":68,"typeId":0,"numInputs":0,"numOutputs":0,"pos":{"x":64,"y":15},"endPos":{"x":64,"y":22},"rotation":0}],"connectionPoints":[]}]]}]';
}
