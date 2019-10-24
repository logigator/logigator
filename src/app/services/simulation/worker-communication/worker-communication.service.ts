import {Injectable} from '@angular/core';
import {Observable, Subject} from 'rxjs';
import {PowerChangesOutWire, PowerChangesOutWireEnd} from '../../../models/simulation/power-changes';
import {ProjectsService} from '../../projects/projects.service';
import {StateCompilerService} from '../state-compiler/state-compiler.service';
import {WasmMethod, WasmRequest, WasmResponse} from '../../../models/simulation/wasm-interface';
import {SimulationUnit} from '../../../models/simulation/simulation-unit';
import { Element } from '../../../models/element';

@Injectable({
	providedIn: 'root'
})
export class WorkerCommunicationService {

	private _powerSubjectsWires: Map<string, Subject<PowerChangesOutWire>>;
	private _powerSubjectsWireEnds: Map<string, Subject<PowerChangesOutWireEnd>>;
	private readonly _worker: Worker;

	private _frameTime: number;

	private _compiledBoard: SimulationUnit[]; // TODO

	private _userInputChanges: Map<number, boolean>;

	constructor(
		private projectsService: ProjectsService,
		private stateCompiler: StateCompilerService
	) {
		this._worker = new Worker('../../../simulation-worker/simulation.worker', { type: 'module' });
		// this._worker.postMessage({kek: '_worker'});
		this._worker.addEventListener('message', (event) => this.handleResponse(event as any));

		this._powerSubjectsWires = new Map<string, Subject<PowerChangesOutWire>>();
		this._powerSubjectsWireEnds = new Map<string, Subject<PowerChangesOutWireEnd>>();
	}

	private handleResponse(event: any): void {
		const data = event.data as WasmResponse;
		if (data.success) {
			// const powerChangesOutWire = new Map<string, PowerChangesOutWire>();
			// const powerChangesOutWirEnd = new Map<string, PowerChangesOutWireEnd>();
			if (data.state.length !== this.stateCompiler.highestLinkId) {
				console.error(`Response data length does not match component count`, data, this._compiledBoard);
				// return;
			}
			// TODO save projects containing specific link
			for (let link = 0; link < data.state.length; link++) {
				const singleState: boolean = !!data.state[link];
				for (const projId of this._powerSubjectsWires.keys()) {
					const powerChangesWire: PowerChangesOutWire = new Map<Element, boolean>();
					const powerChangesWireEnd: PowerChangesOutWireEnd = new Map<{component: Element, wireIndex: number}, boolean>();
					for (const wire of this.stateCompiler.wiresOnLinks.get(projId).get(link)) {
						powerChangesWire.set(wire, singleState);
					}
					for (const wireEnd of this.stateCompiler.wireEndsOnLinks.get(projId).get(link)) {
						powerChangesWireEnd.set(wireEnd, singleState);
					}
					this._powerSubjectsWires.get(projId).next(powerChangesWire);
					this._powerSubjectsWireEnds.get(projId).next(powerChangesWireEnd);
					console.log('next', projId, powerChangesWire, powerChangesWireEnd);
				}
			}
			// for (const state of data.state) {
				// for (const obj of this.stateCompiler.elementsOnLink.get(link)) {
				// 	if (!powerChangesOut.has(obj.projectId))
				// 		powerChangesOut.set(obj.projectId, new Map<Element, boolean>());
				// 	powerChangesOut.get(obj.projectId).set(obj.element, state);
				// }
			// }
			// for (const [k, v] of powerChangesOutWire.entries()) {
			// 	this._powerSubjectsWires.get(k).next(v);
			// }
			// for (const [k, v] of powerChangesOutWirEnd.entries()) {
			// 	this._powerSubjectsWireEnds.get(k).next(v);
			// }
		} else {
			console.error('error', data);
		}
	}

	public async init(): Promise<boolean> {
		this._userInputChanges = new Map<number, boolean>();
		const project = this.projectsService.mainProject;
		// this changes in a future version of stateCompiler
		this._compiledBoard = await this.stateCompiler.compile(project);
		console.log(this._compiledBoard);
		if (!this._compiledBoard)
			return false;
		const board = {
			links: this.stateCompiler.highestLinkId + 1,
			components: this._compiledBoard
		};
		console.log(JSON.stringify(board));
		const request: WasmRequest = {
			method: WasmMethod.init,
			board
		};
		this._worker.postMessage(request);
		return true;
	}

	public stop(): void {
		const request: WasmRequest = {
			method: WasmMethod.stop
		};
		this._worker.postMessage(request);
	}

	public pause(): void {
		const request: WasmRequest = {
			method: WasmMethod.pause
		};
		this._worker.postMessage(request);
	}

	public continue(): void {
		const request: WasmRequest = {
			method: WasmMethod.cont,
			time: this._frameTime,
			userInputs: this._userInputChanges
		};
		this._worker.postMessage(request);
		this._userInputChanges.clear();
	}

	public singleStep(): void {
		const request: WasmRequest = {
			method: WasmMethod.single,
			userInputs: this._userInputChanges
		};
		this._worker.postMessage(request);
		this._userInputChanges.clear();
	}



	public setFrameTime(frameTime: number): void {
		this._frameTime = frameTime;
	}

	public setUserInput(element: Element, state: boolean): void {
		// const unit = this._compiledBoard.get(element);
		// for (const link of SimulationUnits.concat(unit)) {
		for (const link of [0, 1, 2]) {
			this._userInputChanges.set(link, state);
		}
	}

	public boardStateWires(projectId: string): Observable<PowerChangesOutWire> {
		return this._powerSubjectsWires.get(projectId).asObservable();
	}

	public boardStateWireEnds(projectId: string): Observable<PowerChangesOutWireEnd> {
		return this._powerSubjectsWireEnds.get(projectId).asObservable();
	}

	public subscribe(projectId: string): void {
		if (!this._powerSubjectsWires.has(projectId)) {
			this._powerSubjectsWires.set(projectId, new Subject<PowerChangesOutWire>());
			this._powerSubjectsWireEnds.set(projectId, new Subject<PowerChangesOutWireEnd>());
		}
	}

	public unsubscribe(projectId: string): void {
		this._powerSubjectsWires.delete(projectId);
		this._powerSubjectsWireEnds.delete(projectId);
	}
}
