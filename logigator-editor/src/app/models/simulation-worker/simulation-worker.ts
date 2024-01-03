// @ts-strict-ignore
import { Board, BoardStatus, InputEvent } from './board';
import { SimulationModule, TypedArray } from './simulation-module';
import { Pointer } from './wasm-interface';

export class SimulationWorker {
	private _components: Int32Array;
	private _links: number;
	private _simulationModule: SimulationModule;
	private _linkPointer: number = undefined;

	constructor(board: Board, simulationModule: SimulationModule) {
		this._links = board.links;
		this._components = new Int32Array(board.components);
		this._simulationModule = simulationModule;

		simulationModule.initLinks(this._links);
		simulationModule.initComponents(this._components[0]);

		let counter = 0;
		for (let i = 1; i < this._components.length; ) {
			const typeId = this._components[i++];
			const opCount = this._components[i++];
			const inputCount = this._components[i++];
			const outputCount = this._components[i++];
			const ops = this._components.slice(i, (i += opCount));
			const inputs = this._components.slice(i, (i += inputCount));
			const outputs = this._components.slice(i, (i += outputCount));

			const inputPtr = this._arrayToHeap(inputs);
			const outputPtr = this._arrayToHeap(outputs);
			const opsPtr = opCount > 0 ? this._arrayToHeap(ops) : 0;

			simulationModule.initComponent(
				counter++,
				typeId,
				inputPtr,
				outputPtr,
				inputCount,
				outputCount,
				opCount,
				opsPtr
			);

			this._simulationModule._free(inputPtr);
			this._simulationModule._free(outputPtr);
			if (opCount > 0) this._simulationModule._free(opsPtr);
		}
		simulationModule.initBoard();
	}

	public get getBoard() {
		return {
			links: this._links,
			components: this._components
		} as Board;
	}

	public start(ticks?: number, ms?: number) {
		this._simulationModule.start(
			ticks !== undefined ? ticks : Number.MAX_SAFE_INTEGER,
			ms !== undefined ? ms : 4294967295
		);
	}

	public getLinks(): Int8Array {
		if (this._linkPointer === undefined)
			this._linkPointer = this._simulationModule.getLinks();

		return this._simulationModule.HEAP8.slice(
			this._linkPointer,
			this._linkPointer + this._links
		);
	}

	public getComponents(): Array<{ inputs: Int8Array; outputs: Int8Array }> {
		const ptr = this._simulationModule.getComponents();

		let ptrPosition = ptr;
		const components = new Array(this._components[0]);
		for (let i = 0, j = 4; i < components.length; i++, j += 5) {
			components[i] = {
				inputs: this._simulationModule.HEAP8.slice(
					ptrPosition,
					(ptrPosition += this._components[j])
				),
				outputs: this._simulationModule.HEAP8.slice(
					ptrPosition,
					(ptrPosition += this._components[j + 1])
				)
			};
			j += this._components[j] + this._components[j + 1];
		}
		this._simulationModule._free(ptr);
		return components;
	}

	public triggerInput(index: number, inputEvent: InputEvent, state: Int8Array) {
		const ptr = this._arrayToHeap(state);
		this._simulationModule.triggerInput(index, inputEvent, ptr);
		this._simulationModule._free(ptr);
	}

	public stop() {
		this._simulationModule.stop();
	}

	public getStatus(): BoardStatus {
		return this._simulationModule.getStatus();
	}

	public printHeap() {
		const map = new Map<number, number>();
		this._simulationModule.HEAP8.forEach((y, z) => {
			if (y !== 0) map.set(z, y);
		});
		console.log(map);
	}

	private _arrayToHeap(typedArray: TypedArray): Pointer {
		const numBytes = typedArray.length * typedArray.BYTES_PER_ELEMENT;
		const ptr = this._simulationModule._malloc(numBytes);
		const heapBytes = new Uint8Array(
			this._simulationModule.HEAPU8.buffer,
			ptr,
			numBytes
		);
		heapBytes.set(new Uint8Array(typedArray.buffer));
		return ptr;
	}

	public destroy() {
		this._simulationModule.destroy();
	}
}
